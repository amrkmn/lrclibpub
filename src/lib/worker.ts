// Cache for the WebAssembly module
let wasmModule: WebAssembly.WebAssemblyInstantiatedSource | null = null;
let lastProgressUpdate = 0;
let startTime = 0;

// Initialize WebAssembly module
async function initWasm() {
    if (!wasmModule) {
        const wasmResponse = await fetch(new URL("./wasm/lrclibpub.wasm", import.meta.url));

        // Define JavaScript functions that WebAssembly can call
        const importObject = {
            env: {
                print: (nonce: number) => {
                    // Send progress updates to main thread (throttled)
                    const now = performance.now();
                    if (now - lastProgressUpdate >= 500) {
                        const elapsed = now - startTime;
                        const rate = nonce / (elapsed / 1000);

                        self.postMessage({
                            type: "progress",
                            attempts: nonce,
                            time: now,
                            rate: Math.round(rate),
                            elapsed: elapsed,
                        });
                        lastProgressUpdate = now;
                    }
                },
            },
        };

        // Load and compile WebAssembly module
        wasmModule = await WebAssembly.instantiateStreaming(wasmResponse, importObject);
    }
}

// Simple memory allocation in WebAssembly
let nextMemoryOffset = 0;

function allocateInWasm(exports: any, size: number): number {
    const memory = exports.memory as WebAssembly.Memory;
    const totalMemory = memory.buffer.byteLength;

    // Start allocating at 70% of memory to avoid conflicts
    if (nextMemoryOffset === 0) {
        nextMemoryOffset = Math.floor(totalMemory * 0.7);
    }

    // Align to 8-byte boundaries for better performance
    const alignedSize = Math.ceil(Math.max(1, size) / 8) * 8;

    // Check if we have enough space
    if (nextMemoryOffset + alignedSize + 2048 > totalMemory) {
        // Reset to 30% if we run out of space
        nextMemoryOffset = Math.floor(totalMemory * 0.3);
        if (nextMemoryOffset + alignedSize + 2048 > totalMemory) {
            console.warn("Warning: Not enough WASM memory");
            return 0;
        }
    }

    const offset = nextMemoryOffset;
    nextMemoryOffset += alignedSize;
    return offset;
}

// Convert string to bytes efficiently
function stringToBytes(str: string): Uint8Array {
    const encoder = new TextEncoder();
    return encoder.encode(str);
}

// Handle messages from main thread
self.onmessage = async (e) => {
    const { prefix, target } = e.data;
    startTime = performance.now();
    lastProgressUpdate = startTime;

    try {
        // Initialize WebAssembly module
        const initStart = performance.now();
        await initWasm();
        const initTime = performance.now() - initStart;

        if (!wasmModule) {
            throw new Error("Failed to initialize WebAssembly module");
        }

        const instance = wasmModule.instance;
        const exports = instance.exports as any;

        // Check that required functions are available
        if (!exports.solveChallenge || !exports.memory) {
            throw new Error("WebAssembly module missing required exports");
        }

        // Convert strings to bytes
        const encodingStart = performance.now();
        const prefixBytes = stringToBytes(prefix);
        const targetBytes = stringToBytes(target);
        const encodingTime = performance.now() - encodingStart;

        // Allocate memory in WebAssembly
        const allocationStart = performance.now();
        const prefixOffset = allocateInWasm(exports, prefixBytes.length);
        const targetOffset = allocateInWasm(exports, targetBytes.length);
        const allocationTime = performance.now() - allocationStart;

        if (prefixOffset === 0 || targetOffset === 0) {
            throw new Error("Failed to allocate WebAssembly memory");
        }

        // Copy data to WebAssembly memory
        const memory = exports.memory as WebAssembly.Memory;
        const memoryView = new Uint8Array(memory.buffer);
        memoryView.set(prefixBytes, prefixOffset);
        memoryView.set(targetBytes, targetOffset);

        // Run the proof-of-work solver
        const computationStart = performance.now();
        const nonceValue = exports.solveChallenge(prefixOffset, prefixBytes.length, targetOffset, targetBytes.length);
        const computationTime = performance.now() - computationStart;

        if (nonceValue === 0) {
            throw new Error("WebAssembly solver failed");
        }

        const totalTime = performance.now() - startTime;
        const nonce = nonceValue.toString();

        // Send success result back to main thread
        self.postMessage({
            type: "success",
            nonce,
            totalTime: Math.round(totalTime),
            finalAttempts: Number(nonceValue) + 1,
            performance: {
                initTime: Math.round(initTime),
                encodingTime: Math.round(encodingTime),
                allocationTime: Math.round(allocationTime),
                computationTime: Math.round(computationTime),
                totalTime: Math.round(totalTime),
            },
        });
    } catch (err) {
        const error = err instanceof Error ? err.message : "Unknown error";
        console.error("Worker error:", error);

        // Send error back to main thread
        self.postMessage({
            type: "error",
            error,
        });
    }
};

// Cleanup when worker is terminated
self.addEventListener("beforeunload", () => {
    wasmModule = null;
});
