# LRCLIBpub Project Overview

## Purpose
LRCLIBpub is a modern web application for publishing lyrics to the LRCLIB database. It provides a user-friendly interface for submitting both plain and synchronized (LRC) lyrics.

## Main Technologies
- **Frontend Framework**: SvelteKit
- **Styling**: TailwindCSS
- **Build Tool**: Vite
- **Deployment**: Cloudflare Workers
- **Performance**: WebAssembly (Zig) for proof-of-work computation

## Key Features
- Clean interface for submitting lyrics
- Support for both plain and synced (LRC) lyrics
- LRC file upload and parsing
- High-performance proof-of-work using WebAssembly
- Real-time progress tracking during proof-of-work

## Architecture
- **Frontend**: SvelteKit application with a main page (`+page.svelte`) handling form submission and UI logic.
- **WebAssembly**: A WASM module (`lrclibpub.wasm`) handles the computationally intensive proof-of-work challenge solving, interfacing through a web worker (`worker.ts`).
- **API Routes**: Server-side API endpoints (`/api/challenge`, `/api/publish`) handle communication with the LRCLIB API for security and to manage the publishing process.
- **Lyrics Parsing**: Utilities (`lrc.ts`) for parsing LRC files into plain and synced lyrics formats.

## Development Workflow
1.  Fill in track and artist information.
2.  Add lyrics by pasting text or uploading an LRC file.
3.  Click "Publish Lyrics" and wait for the proof-of-work (handled by WASM in a web worker) to complete.
4.  The server-side API endpoints handle the final submission to LRCLIB.

## Prerequisites for Development
- Node.js/Bun
- For WASM development: Zig compiler (latest stable)