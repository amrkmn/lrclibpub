const std = @import("std");
const sha2 = std.crypto.hash.sha2;

// Console log function imported from JavaScript (can be disabled for performance)
extern "env" fn print(value: f64) void;

// Fast decimal conversion - write backwards, then reverse
fn writeNonceDecimal(buf: []u8, value: u64) usize {
    if (value == 0) {
        buf[0] = '0';
        return 1;
    }

    var i: usize = 0;
    var v = value;
    while (v > 0) {
        buf[i] = '0' + @as(u8, @intCast(v % 10));
        v /= 10;
        i += 1;
    }

    // Reverse the digits
    std.mem.reverse(u8, buf[0..i]);
    return i;
}

// Compare hash result with target (hash must be <= target)
fn verifyNonce(result: []const u8, target: []const u8) bool {
    return std.mem.order(u8, result, target) == .lt;
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

        // Write nonce as decimal into buffer (fast path)
        const nonce_len = writeNonceDecimal(input_buffer[start..], nonce);
        const input = input_buffer[0 .. start + nonce_len];

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
