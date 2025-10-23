#!/usr/bin/env bun

import { $ } from "bun";
import { copyFileSync, mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
    console.log("🔨 Building WASM module...");

    // Get project root (parent of scripts directory)
    const projectRoot = dirname(__dirname);

    // Verify Zig is installed
    try {
        const version = await $`zig version`.text();
        console.log(`ℹ️  Zig version: ${version.trim()}`);
    } catch (error) {
        throw new Error("Zig is not installed or not in PATH. Please install Zig from https://ziglang.org/");
    }

    // Change to solver directory and build
    const solverDir = join(projectRoot, "solver");
    if (!existsSync(solverDir)) {
        throw new Error(`Solver source directory not found: ${solverDir}`);
    }

    console.log(`📁 Working directory: ${solverDir}`);
    process.chdir(solverDir);

    // Run zig build
    console.log("⚡ Running zig build...");
    await $`zig build`;

    // Copy the built WASM file
    const srcPath = join(solverDir, "zig-out", "bin", "solver.wasm");
    const destDir = join(projectRoot, "src", "lib", "wasm");
    const destPath = join(destDir, "solver.wasm");

    if (!existsSync(srcPath)) {
        throw new Error(`Built WASM file not found: ${srcPath}`);
    }

    // Ensure destination directory exists
    mkdirSync(destDir, { recursive: true });

    // Copy file
    console.log(`📦 Copying WASM file to: ${destPath}`);
    copyFileSync(srcPath, destPath);

    console.log("✅ WASM build completed successfully!");
} catch (error) {
    console.error("❌ WASM build failed:", error.message);
    process.exit(1);
}
