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

                    if (now - lastUpdate >= 300) {
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

// Track memory allocations for better management
let nextMemoryOffset = 0;
let memoryReserveSize = 1024; // Reserve 1KB for WASM internal use

// Helper function to allocate memory in WASM
function allocateInWasm(exports: any, size: number): number {
    const memory = exports.memory as WebAssembly.Memory;
    const totalMemory = memory.buffer.byteLength;

    // Initialize offset if this is the first allocation
    if (nextMemoryOffset === 0)
        // Start allocations at 80% of memory to avoid conflicts with WASM stack/heap
        nextMemoryOffset = Math.floor(totalMemory * 0.8);

    // Ensure size is at least 1 byte
    const bytesToAllocate = Math.max(1, size);

    // Check if we have enough space left
    if (nextMemoryOffset + bytesToAllocate + memoryReserveSize > totalMemory)
        // Could grow memory here if needed using memory.grow()
        console.warn("Warning: Running low on WASM memory");

    // Save the current offset for returning to caller
    const allocatedOffset = nextMemoryOffset;

    // Move the offset forward for the next allocation (with 8-byte alignment)
    nextMemoryOffset += Math.ceil(bytesToAllocate / 8) * 8;

    return allocatedOffset;
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
        const requiredExports = ["solve_challenge", "memory"];
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

        // Call the solve_challenge function - now returns the nonce value directly
        const nonceValue = exports.solve_challenge(prefixOffset, prefixBytes.length, targetOffset, targetBytes.length);

        if (nonceValue === 0) {
            throw new Error("WASM solve_challenge returned 0 (error)");
        }

        // Convert the numeric nonce to a string
        const nonce = nonceValue.toString();

        const totalTime = Date.now() - startTime;
        console.log(`Challenge solved! Nonce: ${nonce}, Time: ${totalTime}ms`);

        self.postMessage({
            type: "success",
            nonce,
            totalTime,
            finalAttempts: Number(nonceValue) + 1, // Use the numeric value directly
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
