# Agent Instructions

This document provides instructions for agentic coding agents working in this repository.

## Build, Lint, and Test Commands

- **Development:** `bun run dev` - Starts development server with hot reload.
- **Build:** `bun run build` - Compiles the application for production (SvelteKit + Cloudflare Workers).
- **Build WASM:** `bun run build:wasm` - Builds Zig solver to WASM (requires Zig toolchain).
- **Lint & Type-Check:** `bun run check` - Runs Svelte Check with TypeScript to catch errors.
- **Watch Mode:** `bun run check:watch` - Continuous type checking during development.
- **Deploy:** `bun run deploy` - Builds and deploys to Cloudflare Workers.
- **Local CF Dev:** `bun run cf:dev` - Test Cloudflare Workers locally.
- **Test:** No dedicated test framework. Use `bun run check` for type validation.
- **Run a single test:** Not applicable - use type checking instead.

## Code Style Guidelines

- **Package Manager:** Use Bun for all package operations (`bun install`, `bun add`, etc.).
- **Formatting:** Follow Svelte 5 and TypeScript standards, auto-formatted via `vitePreprocess`.
- **Imports:** ES modules only. Use `$lib` alias for library imports (configured in SvelteKit).
- **Types:** Strict TypeScript with `strict: true`. All code must be strongly typed.
- **Naming:** Consistent file casing enforced (`forceConsistentCasingInFileNames: true`).
- **Error Handling:** Proper async/await error handling required for all operations.
- **Styling:** Tailwind CSS v4 with Vite plugin for all styling.
- **WASM Integration:** Use top-level await for WASM loading in workers.
- **Architecture:** SvelteKit app with Cloudflare Workers backend, Zig-compiled WASM solver.