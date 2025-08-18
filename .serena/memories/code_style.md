# Code Style and Conventions for LRCLIBpub

## Frontend (SvelteKit/TypeScript)

- **Language**: TypeScript is used throughout the SvelteKit application for type safety.
- **State Management**: Uses Svelte 5's runes (`$state`, `$derived`, etc.) for local component state management (e.g., `let formData = $state(...)` in `+page.svelte`).
- **Component Structure**: Svelte components (`.svelte` files) are used for UI. Logic is typically contained within `<script lang="ts">` blocks.
- **Event Handling**: Standard Svelte event handling (e.g., `onsubmit={handleSubmit}`, `onchange={...}`).
- **Reactivity**: Fine-grained reactivity is achieved through Svelte's runes and standard reactivity.

## Backend/API Routes (SvelteKit)

- **Language**: TypeScript.
- **API Endpoints**: Server-side API routes are defined in `src/routes/api/` using the `+server.ts` convention. They export `RequestHandler` functions (e.g., `POST`).
- **HTTP Handling**: Uses `@sveltejs/kit` utilities like `json()` for responses and `error()` for handling errors.
- **Request/Response**: Typed request handlers (`RequestHandler`) and explicit handling of request bodies and headers.

## Web Worker (TypeScript)

- **Language**: TypeScript.
- **Purpose**: The web worker (`worker.ts`) is responsible for running the WebAssembly proof-of-work computation off the main thread to keep the UI responsive.
- **Communication**: Uses `postMessage` to communicate progress and results back to the main thread.

## WebAssembly (Zig)

- **Language**: Zig.
- **Purpose**: Provides high-performance computation for the proof-of-work challenge required by LRCLIB.
- **Integration**: Compiled to a `.wasm` file and loaded/instantiated in the web worker (`worker.ts`).
- **Memory Management**: The TypeScript worker handles WASM memory allocation and interaction.

## General

- **Formatting**: While no explicit formatter is configured in `package.json` scripts (like Prettier), the code generally follows a consistent style.
- **Linting**: TypeScript checking is performed via `svelte-check`.
- **Imports**: Uses absolute imports with `$lib` alias for code within the `src/lib` directory (e.g., `import { parseLRCFile } from "$lib/lrc"`).