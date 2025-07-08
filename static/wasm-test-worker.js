let wasmModule = null;
let hashCount = 0;
let lastUpdate = Date.now();

async function initWasm() {
  if (!wasmModule) {
    const wasmResponse = await fetch('/wasm/lrclibup_wasm.wasm');
    const wasmBytes = await wasmResponse.arrayBuffer();
    
    const importObject = {
      env: {
        console_log: (value) => {
          console.log('WASM Progress:', value);
          hashCount += 10000;
          const now = Date.now();
          if (now - lastUpdate >= 1000) {
            self.postMessage({
              type: "progress",
              attempts: hashCount,
              time: now,
            });
            hashCount = 0;
            lastUpdate = now;
          }
        }
      }
    };
    
    wasmModule = await WebAssembly.instantiate(wasmBytes, importObject);
  }
}

self.onmessage = async (e) => {
  const { prefix, target } = e.data;
  hashCount = 0;
  lastUpdate = Date.now();

  try {
    await initWasm();

    if (!wasmModule) {
      throw new Error("WASM module not initialized");
    }

    const instance = wasmModule.instance;
    const exports = instance.exports;

    console.log("WASM exports:", Object.keys(exports));

    if (!exports.solve_challenge || !exports.get_result_length || !exports.memory) {
      throw new Error("Required WASM functions not found");
    }

    // Encode strings to bytes
    const prefixBytes = new TextEncoder().encode(prefix);
    const targetBytes = new TextEncoder().encode(target);

    // Allocate memory in WASM and copy data
    const memory = exports.memory;
    const memoryView = new Uint8Array(memory.buffer);

    // Write prefix to memory at offset 0
    const prefixOffset = 0;
    memoryView.set(prefixBytes, prefixOffset);

    // Write target to memory after prefix
    const targetOffset = prefixBytes.length;
    memoryView.set(targetBytes, targetOffset);

    // Call the solve_challenge function
    const resultOffset = exports.solve_challenge(
      prefixOffset,
      prefixBytes.length,
      targetOffset,
      targetBytes.length
    );

    if (resultOffset === 0) {
      throw new Error("WASM solve_challenge returned 0 (error)");
    }

    // Get the result length
    const resultLength = exports.get_result_length();

    // Read the result from WASM memory
    const resultBytes = memoryView.slice(resultOffset, resultOffset + resultLength);
    const nonce = new TextDecoder().decode(resultBytes);

    self.postMessage({ type: "success", nonce });
  } catch (err) {
    self.postMessage({
      type: "error",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
};
