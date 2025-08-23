## Build, Lint, and Test

- **Build:** `bun run build`
- **Build (fresh):** `bun run build:new` (clears Cloudflare cache)
- **Build WebAssembly:** `bun run build:wasm` (requires Zig compiler)
- **Lint & Type-check:** `bun run check`
- **Watch mode:** `bun run check:watch`
- **Run single test:** No test runner configured. Use `bun run check` to type-check individual files.
- **Dev server:** `bun run dev`
- **Preview:** `bun run preview`
- **Deploy:** `bun run deploy` (builds and deploys to Cloudflare)
- **Cloudflare dev:** `bun run cf:dev`

## Code Style

- **Framework:** SvelteKit with TypeScript and Tailwind CSS
- **Formatting:** Use standard Svelte/Prettier formatting
- **Imports:** Use ES module imports. Sort imports alphabetically. Use `$lib/` alias for internal imports
- **Types:** Use TypeScript for all new code. Strict mode enabled. Add types to existing JavaScript code where possible
- **Naming:**
    - Components: `PascalCase.svelte`
    - Variables/Functions: `camelCase`
    - Types/Interfaces: `PascalCase`
    - Files: `kebab-case` for routes, `camelCase` for utilities
- **Error Handling:** Use SvelteKit's `error` helper from `@sveltejs/kit` for server-side errors (in `+server.ts` files). Use standard `try/catch` for client-side logic
- **Styling:** Use Tailwind CSS utility classes. Custom styles in `src/app.css`
- **WebAssembly:** Zig-based WebAssembly in `solver/` directory. Build script: `scripts/build-wasm.mjs`. Output: `src/lib/wasm/lrclibpub.wasm`
- **Dependencies:** Use `bun` for package management. Install with `bun install`
- **API Routes:** Server-side endpoints in `src/routes/api/`. Use `+server.ts` files
- **Project Structure:**
    - `src/lib/` - Reusable components, utilities, and types
    - `src/routes/` - SvelteKit routes and API endpoints
    - `src/lib/wasm/` - WebAssembly modules
    - `solver/` - Zig source code for WebAssembly
    - `scripts/` - Build scripts
- **Configuration:** Cloudflare adapter configured. Vite plugins for WebAssembly and Tailwind
