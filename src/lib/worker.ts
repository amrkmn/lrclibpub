let wasmModule: WebAssembly.WebAssemblyInstantiatedSource | null = null;
let hashCount = 0;
let lastUpdate = Date.now();
let startTime = Date.now();

async function initWasm() {
    if (!wasmModule) {
        const wasmResponse = await fetch("/wasm/lrclibpub.wasm");
        const wasmBytes = await wasmResponse.arrayBuffer();

        const importObject = {
            env: {
                print: (value: number) => {
                    // Track progress more efficiently
                    const now = Date.now();
                    const elapsed = now - startTime;
                    const rate = value / (elapsed / 1000);

                    // Report progress less frequently to reduce overhead
                    if (now - lastUpdate >= 2000) {
                        // Every 2 seconds instead of 1
                        self.postMessage({
                            type: "progress",
                            attempts: value,
                            time: now,
                            rate: Math.round(rate),
                            elapsed: elapsed,
                        });
                        lastUpdate = now;
                    }
                },
            },
        };

        wasmModule = await WebAssembly.instantiate(wasmBytes, importObject);
    }
}

// Helper function to safely get memory view
function getMemoryView(memory: WebAssembly.Memory): Uint8Array {
    return new Uint8Array(memory.buffer);
}

// Helper function to allocate memory in WASM
function allocateInWasm(exports: any, size: number): number {
    // Simple allocation strategy - use high memory addresses
    // This assumes your WASM module doesn't use the upper memory regions
    const memory = exports.memory as WebAssembly.Memory;
    const totalPages = memory.buffer.byteLength / 65536;
    const highOffset = Math.floor(totalPages * 65536 * 0.8); // Use upper 20% of memory
    return highOffset;
}

self.onmessage = async (e) => {
    const { prefix, target } = e.data;
    hashCount = 0;
    startTime = Date.now();
    lastUpdate = startTime;

    try {
        await initWasm();

        if (!wasmModule) {
            throw new Error("WASM module not initialized");
        }

        const instance = wasmModule.instance;
        const exports = instance.exports as any;

        // Validate required exports
        const requiredExports = ["solve_challenge", "get_result_length", "memory"];
        for (const exportName of requiredExports) {
            if (!exports[exportName]) {
                throw new Error(`Required WASM export '${exportName}' not found. Available: ${Object.keys(exports).join(", ")}`);
            }
        }

        // Encode strings to bytes
        const prefixBytes = new TextEncoder().encode(prefix);
        const targetBytes = new TextEncoder().encode(target);

        const memory = exports.memory as WebAssembly.Memory;

        // Allocate memory safely
        const prefixOffset = allocateInWasm(exports, prefixBytes.length);
        const targetOffset = prefixOffset + prefixBytes.length + 64; // Add padding

        // Get fresh memory view each time
        let memoryView = getMemoryView(memory);

        // Write data to allocated memory
        memoryView.set(prefixBytes, prefixOffset);
        memoryView.set(targetBytes, targetOffset);

        console.log(`Starting challenge: prefix="${prefix}", target="${target}"`);
        console.log(`Memory allocated - prefix: ${prefixOffset}, target: ${targetOffset}`);

        // Call the solve_challenge function
        const resultOffset = exports.solve_challenge(prefixOffset, prefixBytes.length, targetOffset, targetBytes.length);

        if (resultOffset === 0) {
            throw new Error("WASM solve_challenge returned 0 (error)");
        }

        // Get fresh memory view in case memory was reallocated during solving
        memoryView = getMemoryView(memory);

        // Get the result length
        const resultLength = exports.get_result_length();

        if (resultLength === 0 || resultLength > 64) {
            throw new Error(`Invalid result length: ${resultLength}`);
        }

        // Read the result from WASM memory
        const resultBytes = memoryView.slice(resultOffset, resultOffset + resultLength);
        const nonce = new TextDecoder().decode(resultBytes);

        const totalTime = Date.now() - startTime;
        console.log(`Challenge solved! Nonce: ${nonce}, Time: ${totalTime}ms`);

        self.postMessage({
            type: "success",
            nonce,
            totalTime,
            finalAttempts: parseInt(nonce) + 1,
        });
    } catch (err) {
        const error = err instanceof Error ? err.message : "Unknown error";
        console.error("Worker error:", error);
        self.postMessage({
            type: "error",
            error,
        });
    }
};
