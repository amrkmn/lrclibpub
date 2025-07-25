#!/usr/bin/env bun

import { $ } from "bun";
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
    console.log("🔨 Building Rust WASM module...");

    // Get project root (parent of scripts directory)
    const projectRoot = dirname(__dirname);

    // Verify Zig is installed
    try {
        const version = await $`rustc --version`.text();
        console.log(`ℹ️  Rust version: ${version.trim()}`);
    } catch (error) {
        throw new Error("Rust is not installed or not in PATH. Please install Rust from https://rustup.rs/");
    }

    // Change to wasm directory and build
    const wasmDir = join(projectRoot, "solver");
    if (!existsSync(wasmDir)) {
        throw new Error(`WASM source directory not found: ${wasmDir}`);
    }

    console.log(`📁 Working directory: ${wasmDir}`);
    process.chdir(wasmDir);

    // Run zig build
    console.log("⚡ Running wasm-pack build...");
    await $`wasm-pack build --release --target web`;

    // Copy all contents from pkg directory
    const srcDir = join(wasmDir, "pkg");
    const destDir = join(projectRoot, "src", "lib", "wasm");

    if (!existsSync(srcDir)) {
        throw new Error(`Built WASM directory not found: ${srcDir}`);
    }

    // Ensure destination directory exists
    mkdirSync(destDir, { recursive: true });

    // Copy all files from pkg directory
    console.log(`📦 Copying all files from ${srcDir} to ${destDir}`);
    copyRecursive(srcDir, destDir);

    console.log("✅ WASM build completed successfully!");
} catch (error) {
    console.error("❌ WASM build failed:", error.message);
    process.exit(1);
}

function copyRecursive(src, dest) {
    const items = readdirSync(src);

    for (const item of items) {
        // Skip .gitignore files
        if (item === ".gitignore") {
            continue;
        }

        const srcPath = join(src, item);
        const destPath = join(dest, item);

        if (statSync(srcPath).isDirectory()) {
            mkdirSync(destPath, { recursive: true });
            copyRecursive(srcPath, destPath);
        } else {
            copyFileSync(srcPath, destPath);
        }
    }
}
