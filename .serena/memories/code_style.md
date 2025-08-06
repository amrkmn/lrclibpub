# Code Style and Conventions

This document outlines the code style and conventions to be followed in the `lrclibpub` project.

## Formatting

- **Svelte & TypeScript:** Code is automatically formatted using `vitePreprocess`, which enforces Svelte 5 and TypeScript standards.

## Naming

- **File Casing:** Consistent file casing is enforced, as specified by `forceConsistentCasingInFileNames: true` in `tsconfig.json`.

## Types

- **Strict TypeScript:** The project uses a strict TypeScript configuration (`strict: true`), and all code must be strongly typed.

## Imports

- **ES Modules:** Only ES modules are used for imports.
- **Path Aliases:** The `$lib` alias should be used for library imports, as configured in SvelteKit.

## Error Handling

- **Async/Await:** Proper `async/await` error handling is required for all asynchronous operations.

## Styling

- **Tailwind CSS:** All styling is done using Tailwind CSS v4 with the Vite plugin.