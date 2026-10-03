// PoW solver worker — reusable across submits, striding-capable.
//
// Protocol (main -> worker): { jobId, prefix, target, startNonce?, stride? }
// Protocol (worker -> main): { type: "progress", jobId, attempts, rate }
//                            { type: "success", jobId, nonce, totalTime }
//                            { type: "error", jobId, error }
//
// The exported solveChallenge returns u64; the u64-max error sentinel reads
// back as signed i64, so any negative BigInt means failure. Nonce 0 is valid.

// Fixed linear-memory layout: inputs are tiny (prefix <= 44 bytes,
// target hex = 64 bytes), so fixed offsets replace the old bump allocator.
const PREFIX_OFFSET = 0;
const TARGET_OFFSET = 512;
const MAX_PREFIX_BYTES = 44;
const TARGET_HEX_RE = /^[0-9a-fA-F]{64}$/;

// Progress state for the currently running solve (reset per message).
let activeJobId: number | null = null;
let lastReportedHashes = 0;
let lastProgressTime = 0;
// Nonce space partition for this job: nonces are start + k*stride, so
// (nonce - start) / stride == hashes tried. Rate math must use hashes,
// not raw nonce deltas (which overstate throughput by stride-x).
let jobStartNonce = 0;

let jobStride = 1;

let wasmPromise: Promise<WebAssembly.Instance> | null = null;

async function getInstance(): Promise<WebAssembly.Instance> {
  if (!wasmPromise) {
    wasmPromise = (async () => {
      const url = new URL("./wasm/solver.wasm", import.meta.url);

      const importObject: WebAssembly.Imports = {
        env: {
          // Zig calls this at most once per 10k hashes with the absolute
          // nonce. Convert to hashes tried before diffing; throttle to ~300ms.
          print: (value: number) => {
            const now = Date.now();
            const elapsed = (now - lastProgressTime) / 1000;

            if (elapsed >= 0.3) {
              const hashes = (value - jobStartNonce) / jobStride;
              const delta = hashes - lastReportedHashes;
              self.postMessage({
                type: "progress",
                jobId: activeJobId,
                attempts: hashes,
                rate: elapsed > 0 ? Math.round(delta / elapsed) : 0,
              });
              lastProgressTime = now;
              lastReportedHashes = hashes;
            }
          },
        },
      };

      // Streaming compile is faster (compiles during download) but needs
      // the server to serve application/wasm. Fall back to buffered
      // instantiate on any failure (e.g. wrong MIME).
      try {
        if (typeof WebAssembly.instantiateStreaming === "function") {
          const streaming = await WebAssembly.instantiateStreaming(
            fetch(url),
            importObject,
          );

          return streaming.instance;
        }
      } catch {
        // fall through to buffered path
      }

      const bytes = await (await fetch(url)).arrayBuffer();

      return (await WebAssembly.instantiate(bytes, importObject)).instance;
    })();
  }

  return wasmPromise;
}

self.onmessage = async (e: MessageEvent) => {
  const { jobId, prefix, target, startNonce = 0, stride = 1 } = e.data;
  activeJobId = jobId ?? null;
  lastReportedHashes = 0;
  lastProgressTime = Date.now();
  jobStartNonce = Number(startNonce);
  jobStride = Number(stride) || 1;
  const startTime = Date.now();

  try {
    if (
      typeof prefix !== "string" ||
      typeof target !== "string" ||
      prefix.length === 0 ||
      target.length === 0
    ) {
      throw new Error("Invalid challenge: prefix and target are required");
    }

    const prefixBytes = new TextEncoder().encode(prefix);
    const targetBytes = new TextEncoder().encode(target);

    if (prefixBytes.length > MAX_PREFIX_BYTES) {
      throw new Error(
        `Prefix too long (${prefixBytes.length} bytes, max ${MAX_PREFIX_BYTES})`,
      );
    }

    if (!TARGET_HEX_RE.test(target)) {
      throw new Error("Invalid target: expected 64 hex characters");
    }

    const instance = await getInstance();
    const exports = instance.exports as unknown as {
      solveChallenge: (
        prefixOffset: number,
        prefixLen: number,
        targetOffset: number,
        targetLen: number,
        start: bigint,
        step: bigint,
      ) => bigint;
      memory: WebAssembly.Memory;
    };

    if (typeof exports.solveChallenge !== "function" || !exports.memory) {
      throw new Error(
        `Required WASM exports missing. Available: ${Object.keys(exports).join(", ")}`,
      );
    }

    const memory = exports.memory;
    if (
      PREFIX_OFFSET + prefixBytes.length > memory.buffer.byteLength ||
      TARGET_OFFSET + targetBytes.length > memory.buffer.byteLength
    ) {
      throw new Error("Challenge does not fit in WASM linear memory");
    }

    // Fresh view per solve (safe against any future memory.grow detach).
    const memoryView = new Uint8Array(memory.buffer);
    memoryView.set(prefixBytes, PREFIX_OFFSET);
    memoryView.set(targetBytes, TARGET_OFFSET);

    console.log(
      `Starting challenge: prefix="${prefix}", start=${startNonce}, stride=${stride}`,
    );

    const raw = exports.solveChallenge(
      PREFIX_OFFSET,
      prefixBytes.length,
      TARGET_OFFSET,
      targetBytes.length,
      BigInt(startNonce),
      BigInt(stride),
    );

    // u64-max sentinel arrives as signed -1n; any negative is failure.
    // (Nonce 0 is a legitimate solution and must NOT be treated as error.)
    if (raw < 0n) {
      throw new Error("Solver rejected the challenge (invalid input)");
    }

    const nonce = raw.toString();
    const totalTime = Date.now() - startTime;
    console.log(`Challenge solved! Nonce: ${nonce}, Time: ${totalTime}ms`);

    self.postMessage({
      type: "success",
      jobId,
      nonce,
      totalTime,
      attempts: (Number(raw) - jobStartNonce) / jobStride,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    console.error("Worker error:", error);
    self.postMessage({ type: "error", jobId, error });
  }
};
