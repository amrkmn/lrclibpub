const std = @import("std");
const builtin = @import("builtin");

pub fn build(b: *std.Build) void {
    const target = b.resolveTargetQuery(.{
        .cpu_arch = .wasm32,
        .os_tag = .freestanding,
    });

    const wasm_lib = b.addExecutable(.{
        .name = "solver",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = .ReleaseFast,
            // Strip debug info so the artifact is reproducible: otherwise
            // Zig bakes absolute source paths into `.debug_line`, and every
            // rebuild on a different machine/username shows up as a phantom diff.
            .strip = true,
        }),
    });

    if (builtin.zig_version.major == 0 and builtin.zig_version.minor < 17) {
        @compileError("Building requires Zig 0.17.0 or later");
    }

    // Set entry to disabled for WebAssembly library
    wasm_lib.entry = .disabled;

    // Static segments need ~1MB, so the floor is 17 pages; 20 gives headroom.
    wasm_lib.initial_memory = 20 * 64 * 1024; // 20 pages (~1.25MB)
    wasm_lib.max_memory = 16 * 1024 * 1024; // 16MB max memory
    wasm_lib.export_memory = true;

    // Enable function exports - remove import_symbols as it's for imports, not exports
    wasm_lib.rdynamic = true;

    b.installArtifact(wasm_lib);
}
