const std = @import("std");
const builtin = @import("builtin");

pub fn build(b: *std.Build) void {
    const target = b.resolveTargetQuery(.{
        .cpu_arch = .wasm32,
        .os_tag = .freestanding,
    });

    const wasm_lib = b.addExecutable(.{
        .name = "lrclibpub",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = .ReleaseFast,
        }),
    });

    if (builtin.zig_version.major == 0 and builtin.zig_version.minor < 15) {
        @compileError("Building requires Zig 0.15.0 or later");
    }

    // Set entry to disabled for WebAssembly library
    wasm_lib.entry = .disabled;

    // Optimized memory settings for better performance
    wasm_lib.initial_memory = 1 * 1024 * 1024; // 1MB initial memory (reduced for faster startup)
    wasm_lib.max_memory = 8 * 1024 * 1024; // 8MB max memory (sufficient for our use case)
    wasm_lib.export_memory = true;

    // Enable WebAssembly optimizations
    wasm_lib.stack_size = 64 * 1024; // 64KB stack size (optimized for our algorithm)

    // Optimize for size and speed
    wasm_lib.root_module.strip = true; // Strip debug symbols for smaller binary
    wasm_lib.root_module.single_threaded = true; // Single-threaded optimization

    // Enable function exports - remove import_symbols as it's for imports, not exports
    wasm_lib.rdynamic = true;

    b.installArtifact(wasm_lib);
}
