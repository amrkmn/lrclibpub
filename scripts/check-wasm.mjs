#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const wasmPath = join(projectRoot, 'src', 'lib', 'wasm', 'solver.wasm');

if (!existsSync(wasmPath)) {
    console.error('❌ solver.wasm is missing.');
    console.error('   Run `nub run build:wasm` first (requires zig 0.17.0).');
    process.exit(1);
}
