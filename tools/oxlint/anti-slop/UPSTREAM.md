# Upstream provenance — anti-slop Oxlint plugin

- **Source**: local skill bundle `install-anti-slop`, asset tree
  `assets/anti-slop/` (38 files, copied verbatim via the skill's
  `scripts/install.mjs`).
- **Source revision**: unknown. The bundle carries no repository URL or
  commit hash, so per policy this is recorded as unknown rather than
  guessed. Nested vendored provenance travels with the copy — see
  `vendor/eslint-stylistic/UPSTREAM.md` and its `LICENSE`.
- **Installed paths**: `tools/oxlint/anti-slop/` (`index.ts` entry point,
  `rules/`, `shared/`, `effect/`, `vendor/`).
- **Registered as**: `anti-slop` jsPlugin in the repository-root
  `oxlint.config.ts`.
- **Intentional deviations from the skill defaults**:
  - `rules/require-readable-spacing.ts` appends a trailing `"any"` entry
    letting adjacent single-line `let`/`const`/`var` stay grouped without
    blank lines (last match wins, so it overrides the Program-level
    `"always"` entries for short bindings only; multiline declarations
    still require blanks). The rule's own docstring already promised
    grouped short bindings; the vendored options did not.
  - Added `.svelte-kit/**` to `ignorePatterns` (SvelteKit generated
    output; nothing else in the repo needed ignoring).
  - Did **not** register the opt-in `anti-slop-effect` plugin: the
    repository has no direct `effect` dependency (only `numify`, `yaml`).
  - Companion deps pinned exactly: `oxlint@1.86.0`,
    `@oxlint/plugins@1.86.0` (devDependencies).
