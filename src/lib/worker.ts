import init, { solveChallenge, setProgressCallback } from "$lib/wasm/lrclibpub";

let module: WebAssembly.Module | null = null;
let lastUpdate = Date.now();
let startTime = Date.now();

async function initWasm() {
    if (!module) {
        module = await init();

        // Set up the progress callback after WASM initialization
        const progressCallback = (value: number) => {
            const now = Date.now();
            const elapsed = now - startTime;
            const rate = value / (elapsed / 1000); // hashes per second

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
        };

        setProgressCallback(progressCallback);
    }
}

self.onmessage = async (e) => {
    const { prefix, target } = e.data;

    try {
        // Reset timing for this solve session
        startTime = Date.now();
        lastUpdate = startTime;

        await initWasm();

        console.log(`Starting challenge: prefix="${prefix}", target="${target}"`);
        const nonce = solveChallenge(prefix, target);
        const totalTime = Date.now() - startTime;
        const finalAttempts = Number(nonce) + 1;
        console.log(`Challenge solved! Nonce: ${nonce}, Time: ${totalTime}ms`);

        self.postMessage({ type: "success", nonce, totalTime, finalAttempts });
    } catch (error) {
        self.postMessage({
            type: "error",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
