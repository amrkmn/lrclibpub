const std = @import("std");
const sha2 = std.crypto.hash.sha2;

/// Error return: invalid input, overlong prefix, u64 wrap, or cancellation.
/// Never a valid solution (nonce 0 is valid).
pub const ERROR_SENTINEL: u64 = std.math.maxInt(u64);

/// u64 needs at most 20 decimal digits; the prefix must leave room.
const MAX_NONCE_DIGITS = 20;
const MAX_PREFIX_LEN = 64 - MAX_NONCE_DIGITS;

const PROGRESS_INTERVAL: u32 = 10_000;

// JS progress callback, at most every PROGRESS_INTERVAL hashes.
extern "env" fn print(value: f64) void;

// Set by requestCancel() (reset on entry); checked once per hash.
var cancelled: bool = false;

export fn requestCancel() void {
    cancelled = true;
}

// Decimal rendering of value into buf (capacity >= 20); returns length.
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

    std.mem.reverse(u8, buf[0..i]);
    return i;
}

// Add one to tail[0..len] in place (needs capacity len + 1); returns length.
fn incrementDecimalInPlace(tail: []u8, len: usize) usize {
    var i = len;
    while (i > 0) {
        i -= 1;
        if (tail[i] != '9') {
            tail[i] += 1;
            return len;
        }
        tail[i] = '0';
    }
    // All 9s: shift right and prepend '1' ("999" -> "1000").
    @memcpy(tail[1 .. len + 1], tail[0..len]);
    tail[0] = '1';
    return len + 1;
}

// True when hash < target (lexicographic order is numeric order here).
fn verifyNonce(result: []const u8, target: []const u8) bool {
    return std.mem.order(u8, result, target) == .lt;
}

// Hex string into out, which must be half the hex length.
fn hexToBytes(out: []u8, hex_str: []const u8) !void {
    if (hex_str.len % 2 != 0 or out.len != hex_str.len / 2)
        return error.InvalidLength;

    for (0..out.len) |i| {
        const high = try std.fmt.charToDigit(hex_str[i * 2], 16);
        const low = try std.fmt.charToDigit(hex_str[i * 2 + 1], 16);
        out[i] = (high << 4) | low;
    }
}

// Find nonce N in start_nonce, start_nonce + stride, ... with
// SHA256(prefix ++ decimal(N)) < target. Returns the nonce, or
// ERROR_SENTINEL on invalid input, overflow, or cancellation.
export fn solveChallenge(
    prefix_ptr: [*]const u8,
    prefix_len: u32,
    target_hex_ptr: [*]const u8,
    target_hex_len: u32,
    start_nonce: u64,
    stride: u64,
) u64 {
    cancelled = false;

    const step: u64 = if (stride == 0) 1 else stride;

    if (prefix_len > MAX_PREFIX_LEN) return ERROR_SENTINEL;

    var hashed: [32]u8 = undefined;
    var target: [32]u8 = undefined;
    var input_buffer: [64]u8 = undefined;

    const prefix = prefix_ptr[0..prefix_len];
    const target_hex = target_hex_ptr[0..target_hex_len];

    hexToBytes(&target, target_hex) catch return ERROR_SENTINEL;

    const prefix_len_usize = @as(usize, prefix_len);
    @memcpy(input_buffer[0..prefix_len_usize], prefix);

    // Nonce digits live in the input tail: no memcpy and no division per hash.
    var nonce: u64 = start_nonce;
    const tail = input_buffer[prefix_len_usize..];
    var nonce_len = writeNonceDecimal(tail, nonce);

    const step_usize = @as(usize, @intCast(@min(step, std.math.maxInt(usize))));

    var progress_counter: u32 = PROGRESS_INTERVAL;

    while (true) {
        if (cancelled) return ERROR_SENTINEL;

        const input = input_buffer[0 .. prefix_len_usize + nonce_len];

        // Fresh context per hash; cloning a pre-fed one costs more here.
        var ctx = sha2.Sha256.init(.{});
        ctx.update(input);
        ctx.final(&hashed);

        // Down-counter: one fewer 64-bit division per hash.
        progress_counter -= 1;
        if (progress_counter == 0) {
            print(@floatFromInt(nonce));
            progress_counter = PROGRESS_INTERVAL;
        }

        if (verifyNonce(&hashed, &target)) break;

        // Bail instead of wrapping past u64.
        if (nonce > ERROR_SENTINEL - step) return ERROR_SENTINEL;
        nonce += step;
        if (nonce == ERROR_SENTINEL) return ERROR_SENTINEL;
        if (step_usize <= 64) {
            // Small stride: repeated +1 steps, zero divisions.
            for (0..step_usize) |_| {
                nonce_len = incrementDecimalInPlace(tail, nonce_len);
            }
        } else {
            nonce_len = writeNonceDecimal(tail, nonce);
        }
    }

    return nonce;
}
