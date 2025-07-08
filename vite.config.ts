import { defineConfig } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import devtoolsJson from "vite-plugin-devtools-json";

export default defineConfig({
    plugins: [sveltekit(), wasm(), topLevelAwait(), devtoolsJson()],
    worker: {
        format: "es",
        plugins: () => [wasm()],
    },
    optimizeDeps: {
        exclude: ["@sveltejs/kit"],
    },
    build: {
        target: "esnext",
    },
    server: {
        fs: {
            allow: [".", "../wasm"],
        },
    },
});
