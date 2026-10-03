// N strided workers cover disjoint nonces (worker i tries i, i+N, ...);
// first success wins, rest are terminated.

export interface SolverProgress {
    /** Total hashes tried across all workers. */
    attempts: number;
    /** Combined hashes/sec. */
    rate: number;
    /** Contributing worker count. */
    workers: number;
}

export interface WorkerStats {
    /** Hashes tried by one worker. */
    attempts: number;
    /** Hashes/sec for one worker. */
    rate: number;
}

export interface SolverResult {
    nonce: string;
    attempts: number;
    totalTime: number;
}

export interface ActiveSolve {
    promise: Promise<SolverResult>;
    cancel: () => void;
}

// PoW pins a core per worker; more than 8 costs more UX than it gains.
const MAX_WORKERS = 8;
let jobSeq = 0;

/** Clamp raw hardware concurrency into [1, MAX_WORKERS]; nullish means 4. */
export function resolveWorkerCount(hardwareConcurrency: number | null | undefined): number {
    return Math.max(1, Math.min(hardwareConcurrency ?? 4, MAX_WORKERS));
}

/** Disjoint strided assignments — worker i tries i, i+N, .... */
export function workerAssignments(count: number): { startNonce: number; stride: number }[] {
    return Array.from({ length: count }, (_, i) => ({
        startNonce: i,
        stride: count
    }));
}

/** Fail fast only when every worker has errored; a lone error is transient. */
export function shouldFail(errorCount: number, workerCount: number): boolean {
    return errorCount >= workerCount;
}

/** Attempts arrive as hashes tried; total is a floored sum, negatives clamped. */
export function sumAttempts(stats: Iterable<WorkerStats>): number {
    let total = 0;

    for (const s of stats) total += Math.max(0, s.attempts);

    return Math.floor(total);
}

/** Combined hashes/sec is a plain sum. */
export function sumRate(stats: Iterable<WorkerStats>): number {
    let rate = 0;

    for (const s of stats) rate += s.rate;

    return rate;
}

/** Stale-job guard — only messages tagged with the active jobId count. */
export function isCurrentJob(messageJobId: number, jobId: number): boolean {
    return messageJobId === jobId;
}

export function startSolve(
    prefix: string,
    target: string,
    onProgress?: (p: SolverProgress) => void
): ActiveSolve {
    const jobId = ++jobSeq;
    const startTime = Date.now();
    const workers: Worker[] = [];
    // Latest per-worker attempts + rate, for aggregation.
    const latest = new Map<Worker, { attempts: number; rate: number }>();
    // Workers that have errored; fail only when every worker has errored.
    const workerErrors = new Map<Worker, Error>();
    let settled = false;

    function cleanup() {
        for (const w of workers) w.terminate();
    }

    let cancelReject!: (err: Error) => void;

    const promise = new Promise<SolverResult>((resolve, reject) => {
        cancelReject = reject;

        const fail = (err: Error) => {
            if (settled) return;
            settled = true;
            cleanup();
            reject(err);
        };

        const onWorkerError = (w: Worker, err: Error) => {
            if (settled) return;

            if (workerErrors.has(w)) return;

            workerErrors.set(w, err);
            // Free the failed core; survivors keep solving.
            w.terminate();
            // Drop the dead worker's rate so survivors' combined rate stays
            // honest; attempts are cumulative work already done, preserved.
            const last = latest.get(w);

            if (last) latest.set(w, { attempts: last.attempts, rate: 0 });

            if (shouldFail(workerErrors.size, count)) {
                fail(workerErrors.values().next().value ?? err);
            }
        };

        const count = resolveWorkerCount(navigator.hardwareConcurrency);
        const slots = workerAssignments(count);

        for (let i = 0; i < count; i++) {
            const w = new Worker(new URL('./worker.ts', import.meta.url), {
                type: 'module'
            });

            workers.push(w);
            latest.set(w, { attempts: 0, rate: 0 });

            w.onmessage = (e: MessageEvent) => {
                if (settled) return;
                const msg = e.data;

                if (!isCurrentJob(msg.jobId, jobId)) return;

                if (msg.type === 'progress') {
                    latest.set(w, { attempts: msg.attempts, rate: msg.rate });
                    onProgress?.({
                        attempts: sumAttempts(latest.values()),
                        rate: sumRate(latest.values()),
                        workers: count
                    });
                } else if (msg.type === 'success') {
                    settled = true;
                    // Fast solves may finish before any progress report, so seed
                    // the winner's final count from the message itself.
                    const prev = latest.get(w);
                    latest.set(w, {
                        attempts: msg.attempts ?? prev?.attempts ?? 0,
                        rate: prev?.rate ?? 0
                    });

                    const result: SolverResult = {
                        nonce: msg.nonce,
                        attempts: sumAttempts(latest.values()),
                        totalTime: Date.now() - startTime
                    };

                    cleanup();
                    resolve(result);
                } else if (msg.type === 'error') {
                    // All workers validate identically, so a bad challenge
                    // errors everywhere; a lone error is transient — fail
                    // only on unanimous errors so healthy workers continue.
                    onWorkerError(w, new Error(msg.error));
                }
            };

            w.onerror = () => onWorkerError(w, new Error('Solver worker crashed'));

            w.postMessage({
                jobId,
                prefix,
                target,
                startNonce: slots[i].startNonce,
                stride: slots[i].stride
            });
        }
    });

    return {
        promise,
        cancel: () => {
            if (settled) return;
            settled = true;
            cleanup();
            cancelReject(new Error('Solve cancelled'));
        }
    };
}
