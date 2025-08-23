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

    if (builtin.zig_version.major == 0 and builtin.zig_version.minor < 14) {
        @compileError("Building requires Zig 0.14.0 or later");
    }

    // Set entry to disabled for WebAssembly library
    wasm_lib.entry = .disabled;

    // Set initial memory and enable memory export
    wasm_lib.initial_memory = 2 * 1024 * 1024; // 2MB initial memory
    wasm_lib.max_memory = 16 * 1024 * 1024; // 16MB max memory
    wasm_lib.export_memory = true;

    // Enable function exports - remove import_symbols as it's for imports, not exports
    wasm_lib.rdynamic = true;

    b.installArtifact(wasm_lib);
}
