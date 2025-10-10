const std = @import("std");
const sha2 = std.crypto.hash.sha2;

// Import console log function from JavaScript
extern "env" fn print(value: f64) void;

// Convert hex character to byte value
fn hexCharToByte(c: u8) u8 {
    return switch (c) {
        '0'...'9' => c - '0',
        'a'...'f' => c - 'a' + 10,
        'A'...'F' => c - 'A' + 10,
        else => 0,
    };
}

// Convert hex string to bytes array
fn hexToBytes(out: []u8, hex_str: []const u8) bool {
    if (hex_str.len % 2 != 0 or out.len != hex_str.len / 2)
        return false;

    for (0..out.len) |i| {
        const high = hexCharToByte(hex_str[i * 2]);
        const low = hexCharToByte(hex_str[i * 2 + 1]);
        out[i] = (high << 4) | low;
    }
    return true;
}

// Check if hash meets target difficulty (most significant bytes first)
fn verifyNonce(result: []const u8, target: []const u8) bool {
    for (0..result.len) |i| {
        if (result[i] > target[i]) return false;
        if (result[i] < target[i]) return true;
    }
    return true; // Hash is equal to or better than target
}

// Convert number to string for nonce
fn intToStr(buf: []u8, value: u64) usize {
    if (value == 0) {
        buf[0] = '0';
        return 1;
    }

    var v = value;
    var len: usize = 0;

    // Count how many digits we need
    while (v > 0) {
        len += 1;
        v /= 10;
    }

    // Convert number to string (reversed order)
    v = value;
    var i = len;
    while (v > 0) {
        i -= 1;
        buf[i] = @as(u8, @intCast(v % 10)) + '0';
        v /= 10;
    }

    return len;
}

// Main proof-of-work solver function
export fn solveChallenge(
    prefix_ptr: [*]const u8,
    prefix_len: u32,
    target_hex_ptr: [*]const u8,
    target_hex_len: u32,
) u64 {
    var nonce: u64 = 0;
    var hashed: [32]u8 = undefined;
    var target: [32]u8 = undefined;
    var input_buffer: [128]u8 = undefined;

    const prefix = prefix_ptr[0..prefix_len];
    const target_hex = target_hex_ptr[0..target_hex_len];

    // Convert target from hex to bytes
    if (!hexToBytes(&target, target_hex)) return 0;

    // Copy prefix to our input buffer
    const prefix_len_usize = @as(usize, prefix_len);
    @memcpy(input_buffer[0..prefix_len_usize], prefix);

    // Try different nonce values until we find one that works
    while (true) {
        // Add nonce to the input (convert number to string)
        const start = prefix_len_usize;
        const nonce_len = intToStr(input_buffer[start..], nonce);
        const input = input_buffer[0 .. start + nonce_len];

        // Calculate SHA-256 hash of prefix + nonce
        var ctx = sha2.Sha256.init(.{});
        ctx.update(input);
        ctx.final(&hashed);

        // Log progress occasionally
        if (nonce % 50_000 == 0) {
            print(@floatFromInt(nonce));
        }

        // Check if this nonce solves the challenge
        if (verifyNonce(&hashed, &target)) break;

        nonce += 1;

        // Safety limit to prevent infinite loops
        if (nonce > 1_000_000_000) return 0;
    }

    return nonce;
}
