# Suggested Commands

This file provides a list of the most important commands for developing and managing the `lrclibpub` project.

## Development

- `bun run dev`: Starts the development server with hot reload.
- `bun run check:watch`: Runs continuous type checking in watch mode.

## Building

- `bun run build`: Compiles the application for production.
- `bun run build:wasm`: Builds the Zig solver to WASM.

## Linting and Testing

- `bun run check`: Runs Svelte Check with TypeScript to catch errors. This is the primary method for testing, as there is no dedicated test framework.

## Deployment

- `bun run deploy`: Builds and deploys the application to Cloudflare Workers.
- `bun run cf:dev`: Tests the Cloudflare Worker locally.

## Package Management

- `bun install`: Installs dependencies.
- `bun add <package>`: Adds a new dependency.