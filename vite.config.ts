import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import devtoolsJson from 'vite-plugin-devtools-json';

export default defineConfig({
    plugins: [
        sveltekit({
            // Consult https://svelte.dev/docs/kit/integrations
            // for more information about preprocessors
            preprocess: vitePreprocess(),

            // Using static adapter for static site generation
            adapter: adapter()
        }),
        devtoolsJson(),
        tailwindcss()
    ],
    optimizeDeps: { exclude: ['@sveltejs/kit'] },
    build: { target: 'esnext', minify: true }
});
