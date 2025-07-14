# LRCLIBpub

A modern web application for publishing lyrics to the LRCLIB database. Built with SvelteKit, TailwindCSS, and WebAssembly.

> **_NOTE_**: This project is a fork of [lrclibup](https://github.com/boidushya/lrclibup) by [@boidushya](https://github.com/boidushya)

<img width="1552" alt="image" src="https://github.com/user-attachments/assets/f8a176e3-029e-44a8-909c-c23e6180fdd0" />

## Features

-   Clean interface for submitting lyrics
-   Support for both plain and synced (LRC) lyrics
-   LRC file upload and parsing
-   High-performance proof-of-work using WebAssembly
-   Real-time progress tracking
-   Server-side API endpoints for security

## Usage

1. Fill in track and artist information
2. Add lyrics by pasting text or uploading an LRC file
3. Click "Publish Lyrics" and wait for the proof-of-work to complete

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Deploy to Cloudflare
npm run deploy
```

## WebAssembly

The application uses WebAssembly (written in Zig) for fast proof-of-work computation. A pre-built WASM module is included, so you don't need to rebuild it unless modifying the Zig code.

**Prerequisites for WASM development:**
- Zig compiler (latest stable) - Download from: https://ziglang.org/download/

To rebuild WASM (requires Zig):
```bash
npm run build:wasm
```

## License

GPL-3.0 License

## Credits

Powered by [BetterLyrics](https://better-lyrics.boidu.dev) - A browser extension for enhanced lyrics display on YouTube Music.
