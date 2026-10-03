// Reusable strided PoW worker. In: { jobId, prefix, target, startNonce?, stride? }.
// Out: { type: "progress", attempts, rate }, { type: "success", nonce, totalTime, attempts },
// or { type: "error", error }. The u64-max sentinel reads back as signed
// i64, so any negative BigInt means failure; nonce 0 is valid.

// Fixed offsets: inputs are tiny, so no allocator is needed.
const PREFIX_OFFSET = 0;

const TARGET_OFFSET = 512;

const MAX_PREFIX_BYTES = 44;

const TARGET_HEX_RE = /^[0-9a-fA-F]{64}$/;

// Boundary decoders for untyped postMessage payloads and WASM exports.
function isNonEmptyString(v: unknown): v is string {
    return typeof v === 'string' && v.length > 0;
}

interface WasmSolverExports {
    solveChallenge: (
        prefixOffset: number,
        prefixLen: number,
        targetOffset: number,
        targetLen: number,
        start: bigint,
        step: bigint
    ) => bigint;
    memory: WebAssembly.Memory;
}

function hasSolverExports(v: unknown): v is WasmSolverExports {
    if (typeof v !== 'object' || v === null) return false;

    if (!('solveChallenge' in v) || !('memory' in v)) return false;
    // SAFETY: `in` checks above prove both keys exist; the checks below
    // narrow them before use.
    const e = v as { solveChallenge: unknown; memory: unknown };

    return typeof e.solveChallenge === 'function' && e.memory instanceof WebAssembly.Memory;
}

// Per-solve progress state, reset on every message.
let activeJobId: number | null = null;

let lastReportedHashes = 0;

let lastProgressTime = 0;

// Nonces run start + k*stride, so hashes tried = (nonce - start) / stride.
let jobStartNonce = 0;

let jobStride = 1;

let wasmPromise: Promise<WebAssembly.Instance> | null = null;

async function getInstance(): Promise<WebAssembly.Instance> {
    if (!wasmPromise) {
        wasmPromise = (async () => {
            const url = new URL('./wasm/solver.wasm', import.meta.url);

            const importObject: WebAssembly.Imports = {
                env: {
                    // Absolute nonce -> hashes tried; throttled to ~300ms.
                    print: (value: number) => {
                        const now = Date.now();
                        const elapsed = (now - lastProgressTime) / 1000;

                        if (elapsed >= 0.3) {
                            const hashes = (value - jobStartNonce) / jobStride;
                            const delta = hashes - lastReportedHashes;
                            self.postMessage({
                                type: 'progress',
                                jobId: activeJobId,
                                attempts: hashes,
                                rate: elapsed > 0 ? Math.round(delta / elapsed) : 0
                            });
                            lastProgressTime = now;
                            lastReportedHashes = hashes;
                        }
                    }
                }
            };

            // Streaming compile with buffered fallback (needs application/wasm).
            try {
                if (typeof WebAssembly.instantiateStreaming !== 'undefined') {
                    const streaming = await WebAssembly.instantiateStreaming(
                        fetch(url),
                        importObject
                    );

                    return streaming.instance;
                }
            } catch {
                // Wrong MIME and similar fall through to the buffered path below.
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
        if (!isNonEmptyString(prefix) || !isNonEmptyString(target)) {
            throw new Error('Invalid challenge: prefix and target are required');
        }

        const prefixBytes = new TextEncoder().encode(prefix);
        const targetBytes = new TextEncoder().encode(target);

        if (prefixBytes.length > MAX_PREFIX_BYTES) {
            throw new Error(
                `Prefix too long (${prefixBytes.length} bytes, max ${MAX_PREFIX_BYTES})`
            );
        }

        if (!TARGET_HEX_RE.test(target)) {
            throw new Error('Invalid target: expected 64 hex characters');
        }

        const instance = await getInstance();

        if (!hasSolverExports(instance.exports)) {
            throw new Error(
                `Required WASM exports missing. Available: ${Object.keys(instance.exports).join(', ')}`
            );
        }

        const exports = instance.exports;

        const memory = exports.memory;

        if (
            PREFIX_OFFSET + prefixBytes.length > memory.buffer.byteLength ||
            TARGET_OFFSET + targetBytes.length > memory.buffer.byteLength
        ) {
            throw new Error('Challenge does not fit in WASM linear memory');
        }

        // Fresh view per solve in case memory ever grows.
        const memoryView = new Uint8Array(memory.buffer);
        memoryView.set(prefixBytes, PREFIX_OFFSET);
        memoryView.set(targetBytes, TARGET_OFFSET);

        console.log(
            `Starting challenge: prefix="${prefix}", start=${startNonce}, stride=${stride}`
        );

        const raw = exports.solveChallenge(
            PREFIX_OFFSET,
            prefixBytes.length,
            TARGET_OFFSET,
            targetBytes.length,
            BigInt(startNonce),
            BigInt(stride)
        );

        // Signed -1n is the u64-max sentinel; nonce 0 is a valid solution.
        if (raw < 0n) {
            throw new Error('Solver rejected the challenge (invalid input)');
        }

        const nonce = raw.toString();
        const totalTime = Date.now() - startTime;
        console.log(`Challenge solved! Nonce: ${nonce}, Time: ${totalTime}ms`);

        self.postMessage({
            type: 'success',
            jobId,
            nonce,
            totalTime,
            attempts: (Number(raw) - jobStartNonce) / jobStride
        });
    } catch (err) {
        const error = err instanceof Error ? err.message : 'Unknown error';
        console.error('Worker error:', error);
        self.postMessage({ type: 'error', jobId, error });
    }
};
