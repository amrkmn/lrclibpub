import { defineConfig } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig({
  plugins: [sveltekit(), wasm(), topLevelAwait()],
  worker: {
    format: "es",
    plugins: () => [wasm()],
  },
  optimizeDeps: {
    exclude: ["@sveltejs/kit"],
    include: ["./src/lib/wasm/pkg/lrclibup_wasm.js"],
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
