// Strided multi-worker PoW solving.
//
// Each nonce trial is independent, so N workers cover disjoint nonce sets:
// worker i tries startNonce=i with stride=N (i, i+N, i+2N, ...). The first
// worker to post success wins; the rest are terminated. Expected wall-time
// speedup is ~Nx for N cores.

export interface SolverProgress {
  /** Estimated total hashes tried across all workers. */
  attempts: number;
  /** Combined hashes/sec across all workers. */
  rate: number;
  /** Number of workers contributing. */
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

// Cap at 8: PoW pins a core per worker; beyond this the UX cost (heat,
// battery, jank on shared cores) outweighs the marginal speedup.
const MAX_WORKERS = 8;

let jobSeq = 0;

export function startSolve(
  prefix: string,
  target: string,
  onProgress?: (p: SolverProgress) => void,
): ActiveSolve {
  const jobId = ++jobSeq;
  const startTime = Date.now();
  const workers: Worker[] = [];
  // Latest absolute nonce + rate per worker, for aggregation.
  const latest = new Map<Worker, { attempts: number; rate: number }>();
  let settled = false;

  // Attempts arrive in hashes-tried units (converted worker-side), so the
  // total is a plain sum across workers.
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

    const count = Math.max(
      1,
      Math.min(navigator.hardwareConcurrency ?? 4, MAX_WORKERS),
    );

    for (let i = 0; i < count; i++) {
      const w = new Worker(new URL("./worker.ts", import.meta.url), {
        type: "module",
      });
      workers.push(w);
      latest.set(w, { attempts: 0, rate: 0 });

      w.onmessage = (e: MessageEvent) => {
        if (settled) return;
        const msg = e.data;
        if (msg.jobId !== jobId) return;

        if (msg.type === "progress") {
          latest.set(w, { attempts: msg.attempts, rate: msg.rate });
          let rate = 0;
          for (const v of latest.values()) rate += v.rate;
          onProgress?.({
            attempts: totalAttempts(),
            rate,
            workers: count,
          });
        } else if (msg.type === "success") {
          settled = true;
          // The winner may have solved before its first progress report
          // (fast solves < 10k hashes), so seed its final attempt count
          // from the message itself before aggregating.
          const prev = latest.get(w);
          latest.set(w, {
            attempts: msg.attempts ?? prev?.attempts ?? 0,
            rate: prev?.rate ?? 0,
          });
          const result: SolverResult = {
            nonce: msg.nonce,
            attempts: totalAttempts(),
            totalTime: Date.now() - startTime,
          };
          cleanup();
          resolve(result);
        } else if (msg.type === "error") {
          // Input validation happens identically in every worker, so one
          // error means the challenge itself is bad: abort all workers.
          fail(new Error(msg.error));
        }
      };

      w.onerror = () => fail(new Error("Solver worker crashed"));

      w.postMessage({ jobId, prefix, target, startNonce: i, stride: count });
    }
  });

  return {
    promise,
    cancel: () => {
      if (settled) return;
      settled = true;
      cleanup();
      cancelReject(new Error("Solve cancelled"));
    },
  };
}
