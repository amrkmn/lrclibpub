# Project Overview

This project, named `lrclibpub`, is a SvelteKit application with a Cloudflare Workers backend. It also includes a WebAssembly (WASM) module written in Zig, which appears to be a solver of some kind.

## Architecture

- **Frontend:** The frontend is built with Svelte 5 and styled with Tailwind CSS v4.
- **Backend:** The backend is powered by Cloudflare Workers, providing a serverless API.
- **WASM:** A Zig-based solver is compiled to WASM and integrated into the application, likely for performance-critical tasks.
- **Build System:** The project uses Vite for building and Bun as the package manager and runtime.

## Codebase Structure

- `src/routes`: Contains the SvelteKit page and API routes.
- `src/lib`: Holds shared library code, including the worker script (`worker.ts`) and TypeScript type definitions (`types.ts`).
- `solver/`: Contains the Zig source code for the WASM module.
- `scripts/`: Includes helper scripts, such as the one for building the WASM module.