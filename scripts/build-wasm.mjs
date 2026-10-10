#!/usr/bin/env node

import { execFile, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function run(command, args, options) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { stdio: ['inherit', 'pipe', 'pipe'], ...options });
        let lines = 0;
        const onData = (chunk) => {
            const text = chunk.toString();
            lines += text.split('\n').length - 1;
            process.stdout.write(text);
        };
        child.stdout.on('data', onData);
        child.stderr.on('data', onData);
        child.on('error', reject);
        child.on('exit', (code) => {
            if (code !== 0) {
                reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
                return;
            }
            if (process.stdout.isTTY && lines > 0) process.stdout.write(`\x1b[${lines}A\x1b[0J`);
            resolve();
        });
    });
}

try {
    console.log('🔨 Building WASM module...');

    // Get project root (parent of scripts directory)
    const projectRoot = dirname(__dirname);

    // Verify Zig is installed
    try {
        const { stdout } = await execFileAsync('zig', ['version']);
        console.log(`ℹ️  Zig version: ${stdout.trim()}`);
    } catch {
        throw new Error(
            'Zig is not installed or not in PATH. Please install Zig from https://ziglang.org/'
        );
    }

    // Change to solver directory and build
    const solverDir = join(projectRoot, 'solver');

    if (!existsSync(solverDir)) {
        throw new Error(`Solver source directory not found: ${solverDir}`);
    }

    console.log(`📁 Working directory: ${solverDir}`);

    // Run zig build
    console.log('⚡ Running zig build...');
    await run('zig', ['build'], { cwd: solverDir });

    // Smoke-test before shipping
    console.log('🧪 Running solver smoke test...');
    await run('node', ['smoke-test.mjs'], { cwd: solverDir });
    console.log('✅ Smoke test passed');

    // Copy the built WASM file
    const srcPath = join(solverDir, 'zig-out', 'bin', 'solver.wasm');
    const destDir = join(projectRoot, 'src', 'lib', 'wasm');
    const destPath = join(destDir, 'solver.wasm');

    if (!existsSync(srcPath)) {
        throw new Error(`Built WASM file not found: ${srcPath}`);
    }

    // Ensure destination directory exists
    mkdirSync(destDir, { recursive: true });

    // Copy file
    console.log(`📦 Copying WASM file to: ${destPath}`);
    copyFileSync(srcPath, destPath);
    chmodSync(destPath, 0o644);

    const bytes = readFileSync(destPath);
    const sha = createHash('sha256').update(bytes).digest('hex');
    console.log(
        `📏 solver.wasm: ${bytes.length} bytes (${(bytes.length / 1024).toFixed(1)} KiB), sha256: ${sha}`
    );

    console.log('✅ WASM build completed successfully!');
} catch (error) {
    console.error('❌ WASM build failed:', error.message);
    process.exit(1);
}
