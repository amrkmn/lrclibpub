import init, { solve_challenge } from "./wasm/pkg/lrclibup_wasm";

let wasmModule: any = null;
let hashCount = 0;
let lastUpdate = Date.now();

async function initWasm() {
  if (!wasmModule) {
    wasmModule = await init();
  }
}

// Override console.log to catch WASM progress reports
const originalLog = console.log;
console.log = function (...args) {
  if (typeof args[0] === "number") {
    hashCount += 10000;
    const now = Date.now();
    if (now - lastUpdate >= 1000) {
      // Update every second
      self.postMessage({
        type: "progress",
        attempts: hashCount,
        time: now,
      });
      hashCount = 0;
      lastUpdate = now;
    }
  }
  originalLog.apply(console, args);
};

self.onmessage = async (e) => {
  const { prefix, target } = e.data;
  hashCount = 0;
  lastUpdate = Date.now();

  try {
    await initWasm();

    const nonce = solve_challenge(prefix, target);
    self.postMessage({ type: "success", nonce });
  } catch (err) {
    self.postMessage({
      type: "error",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
};
