import { defineConfig } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import devtoolsJson from "vite-plugin-devtools-json";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
    plugins: [sveltekit(), wasm(), topLevelAwait(), devtoolsJson(), tailwindcss()],
    worker: {
        plugins: () => [wasm()],
    },
    optimizeDeps: {
        exclude: ["@sveltejs/kit"],
    },
    build: {
        target: "esnext",
    },
});
