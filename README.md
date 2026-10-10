# LRCLIBpub

A modern web application for publishing lyrics to the LRCLIB database. Built with SvelteKit, TailwindCSS, and WebAssembly.

> **_NOTE_**: This project is a fork of [lrclibup](https://github.com/boidushya/lrclibup) by [@boidushya](https://github.com/boidushya)

<img width="1552" alt="image" src="https://github.com/user-attachments/assets/f8a176e3-029e-44a8-909c-c23e6180fdd0" />

## Features

- Clean interface for submitting lyrics
- Support for both plain and synced (LRC) lyrics
- LRC file upload and parsing
- High-performance proof-of-work using WebAssembly
- Real-time progress tracking
- Server-side API endpoints for security

## Usage

1. Fill in track and artist information
2. Add lyrics by pasting text or uploading an LRC file
3. Click "Publish Lyrics" and wait for the proof-of-work to complete

## Package Manager

This project uses [nub](https://nubjs.com/) as its package manager and script runner. Install it first, then use `nub` for all commands below. Don't use `npm`, `pnpm`, or `yarn`, since they won't respect `nub.lock`.

## Development

```bash
# Install dependencies
nub install

# Build the WebAssembly module (required before first dev/build)
nub run build:wasm

# Start development server
nub run dev

# Build for production
nub run build

# Deploy to Cloudflare
nub run deploy
```

## WebAssembly

The application uses WebAssembly (written in Zig) for fast proof-of-work computation. The compiled module (`src/lib/wasm/solver.wasm`) is not committed; it is generated from `solver/` and must be built before running `dev` or `build`. CI builds it on every deploy.

**Prerequisites:**

- Zig 0.17.0 - Download from: https://ziglang.org/download/

To build the WASM module:

```bash
nub run build:wasm
```

## License

GPL-3.0 License

## Credits

Powered by [BetterLyrics](https://better-lyrics.boidu.dev) - A browser extension for enhanced lyrics display on YouTube Music.
