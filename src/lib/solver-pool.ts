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
    let settled = false;

    // Attempts already arrive as hashes tried; total is a plain sum.
    function totalAttempts() {
        let total = 0;

        for (const v of latest.values()) total += Math.max(0, v.attempts);

        return Math.floor(total);
    }

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

        const count = Math.max(1, Math.min(navigator.hardwareConcurrency ?? 4, MAX_WORKERS));

        for (let i = 0; i < count; i++) {
            const w = new Worker(new URL('./worker.ts', import.meta.url), {
                type: 'module'
            });

            workers.push(w);
            latest.set(w, { attempts: 0, rate: 0 });

            w.onmessage = (e: MessageEvent) => {
                if (settled) return;
                const msg = e.data;

                if (msg.jobId !== jobId) return;

                if (msg.type === 'progress') {
                    latest.set(w, { attempts: msg.attempts, rate: msg.rate });
                    let rate = 0;

                    for (const v of latest.values()) rate += v.rate;
                    onProgress?.({
                        attempts: totalAttempts(),
                        rate,
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
                        attempts: totalAttempts(),
                        totalTime: Date.now() - startTime
                    };

                    cleanup();
                    resolve(result);
                } else if (msg.type === 'error') {
                    // Any worker error means a bad challenge (all validate
                    // identically): abort everything.
                    fail(new Error(msg.error));
                }
            };

            w.onerror = () => fail(new Error('Solver worker crashed'));

            w.postMessage({ jobId, prefix, target, startNonce: i, stride: count });
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
