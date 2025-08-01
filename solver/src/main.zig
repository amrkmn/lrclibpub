const std = @import("std");
const sha2 = std.crypto.hash.sha2;

// Console log function imported from JavaScript (can be disabled for performance)
extern "env" fn print(value: f64) void;

// Global result buffer for nonce string
var result_buffer: [64]u8 = undefined;
var result_len: u32 = 0;

// Compare hash result with target (left-to-right, like Rust)
fn verifyNonce(result: []const u8, target: []const u8) bool {
    if (result.len != target.len) return false;

    // Compare from most significant bytes first
    for (0..result.len) |i| {
        if (result[i] > target[i]) return false;
        if (result[i] < target[i]) return true;
    }
    return true; // Equal to target
}

// Convert hex string to bytes
fn hexToBytes(out: []u8, hex_str: []const u8) !void {
    if (hex_str.len % 2 != 0 or out.len != hex_str.len / 2)
        return error.InvalidLength;

    for (0..out.len) |i| {
        const high = try std.fmt.charToDigit(hex_str[i * 2], 16);
        const low = try std.fmt.charToDigit(hex_str[i * 2 + 1], 16);
        out[i] = (high << 4) | low;
    }
}

// Solve the proof-of-work challenge
export fn solveChallenge(
    prefix_ptr: [*]const u8,
    prefix_len: u32,
    target_hex_ptr: [*]const u8,
    target_hex_len: u32,
) u64 {
    var nonce: u64 = 0;
    var hashed: [32]u8 = undefined;
    var target: [32]u8 = undefined;
    var input_buffer: [64]u8 = undefined;

    const prefix = prefix_ptr[0..prefix_len];
    const target_hex = target_hex_ptr[0..target_hex_len];

    // Decode target hex string
    hexToBytes(&target, target_hex) catch return 0;

    const prefix_len_usize = @as(usize, prefix_len);
    @memcpy(input_buffer[0..prefix_len_usize], prefix);

    // Precompute reusable context
    while (true) {
        const start = prefix_len_usize;

        // Write nonce as decimal into buffer
        const nonce_str = std.fmt.bufPrint(input_buffer[start..], "{}", .{nonce}) catch return 0;
        const input = input_buffer[0 .. start + nonce_str.len];

        // Hash
        var ctx = sha2.Sha256.init(.{});
        ctx.update(input);
        ctx.final(&hashed);

        // Optional logging (disable for performance)
        if (nonce % 10_000 == 0) {
            print(@floatFromInt(nonce));
        }

        if (verifyNonce(&hashed, &target)) break;

        nonce += 1;
    }

    // Return the nonce value directly
    return nonce;
}
