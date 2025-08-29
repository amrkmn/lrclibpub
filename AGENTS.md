# Repository Guidelines

This document provides a set of guidelines for contributors to this repository, covering project structure, development commands, coding style, and more.

## Project Structure & Module Organization

-   **Source Code:** `src/`
-   **Routes & API Endpoints:** `src/routes/`
-   **Reusable Components & Utilities:** `src/lib/`
-   **WebAssembly Modules:** `src/lib/wasm/`
-   **Zig Source for WebAssembly:** `solver/`
-   **Build Scripts:** `scripts/`

## Build, Lint, and Test

-   **Build:** `bun run build` - Creates a production build.
-   **Build (fresh):** `bun run build:new` - Clears the Cloudflare cache and builds.
-   **Build WebAssembly:** `bun run build:wasm` - Compiles Zig code to WebAssembly (requires Zig).
-   **Lint & Type-check:** `bun run check` - Runs linting and type-checking for the project.
-   **Dev Server:** `bun run dev` - Starts the development server.

## Coding Style & Naming Conventions

-   **Framework:** SvelteKit with TypeScript and Tailwind CSS.
-   **Formatting:** Standard Svelte/Prettier formatting is enforced.
-   **Imports:** Use ES module imports, sorted alphabetically. Use the `$lib/` alias for internal modules.
-   **Naming:**
    -   Components: `PascalCase.svelte`
    -   Variables/Functions: `camelCase`
    -   Types/Interfaces: `PascalCase`
    -   Files: `kebab-case` for routes, `camelCase` for utilities.
-   **Error Handling:** Use SvelteKit's `error` helper for server-side errors and `try/catch` for client-side logic.

## Testing Guidelines

There is no dedicated test runner configured for this project. Instead, use `bun run check` to perform static type-checking on individual files as a form of testing.

## Commit & Pull Request Guidelines

This project follows the **Conventional Commits** specification. Commit messages should be structured as follows:

```
<type>(<scope>): <subject>
```

-   **type:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
-   **scope:** A noun describing the section of the codebase (e.g., `search`, `build`, `wasm`)

**Example:**
`style(search): add cursor pointer to interactive elements`

Pull requests should include a clear description of the changes and link to any relevant issues.
