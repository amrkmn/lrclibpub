const std = @import("std");
const sha2 = std.crypto.hash.sha2;

/// Returned when inputs are invalid, the prefix is too long, the search
/// wraps past u64, or a cancellation was requested. Distinct from any
/// plausible solution nonce (nonce 0 IS a valid solution).
pub const ERROR_SENTINEL: u64 = std.math.maxInt(u64);

/// Max decimal digits of a u64 (20) — input_buffer is 64 bytes, so the
/// prefix must leave room for the longest possible nonce suffix.
const MAX_NONCE_DIGITS = 20;
const MAX_PREFIX_LEN = 64 - MAX_NONCE_DIGITS;

const PROGRESS_INTERVAL: u32 = 10_000;

// Progress callback imported from JavaScript. Called at most once per
// PROGRESS_INTERVAL hashes; the worker throttles further.
extern "env" fn print(value: f64) void;

// Cancellation flag. Set via requestCancel() from JS for graceful abort;
// solveChallenge() resets it on entry. Checked once per hash (one
// predictable branch) so a hung/long solve can be abandoned without
// terminating the worker.
var cancelled: bool = false;

export fn requestCancel() void {
    cancelled = true;
}

// Write value as decimal into buf (which must have capacity >= 20).
// Returns the number of bytes written.
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

    // Digits were produced least-significant-first; reverse in place.
    std.mem.reverse(u8, buf[0..i]);
    return i;
}

// Add one to the decimal string tail[0..len] in place (O(1) amortized).
// Handles carry ("199" -> "200") and growth ("999" -> "1000").
// tail must have capacity for len + 1 bytes. Returns the new length.
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
    // Every digit was '9': "999" is now "000", shift right and prepend '1'.
    @memcpy(tail[1 .. len + 1], tail[0..len]);
    tail[0] = '1';
    return len + 1;
}

// Compare hash result with target (hash must be strictly less than target,
// big-endian lexicographic == numeric order for equal-length buffers).
fn verifyNonce(result: []const u8, target: []const u8) bool {
    return std.mem.order(u8, result, target) == .lt;
}

// Convert hex string to bytes. Out length must be exactly half the hex
// length (32 bytes / 64 hex chars for SHA-256 targets).
fn hexToBytes(out: []u8, hex_str: []const u8) !void {
    if (hex_str.len % 2 != 0 or out.len != hex_str.len / 2)
        return error.InvalidLength;

    for (0..out.len) |i| {
        const high = try std.fmt.charToDigit(hex_str[i * 2], 16);
        const low = try std.fmt.charToDigit(hex_str[i * 2 + 1], 16);
        out[i] = (high << 4) | low;
    }
}

// Solve the proof-of-work challenge: find a nonce N (N = start_nonce,
// start_nonce + stride, ...) such that
// SHA256(prefix ++ decimal(N)) < target.
//
// Returns the winning nonce, or ERROR_SENTINEL on invalid input,
// overflow, or cancellation. Nonce 0 is a legitimate solution.
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

    // Decode target hex string once (not per hash).
    hexToBytes(&target, target_hex) catch return ERROR_SENTINEL;

    const prefix_len_usize = @as(usize, prefix_len);
    @memcpy(input_buffer[0..prefix_len_usize], prefix);

    // Digits live directly in the input tail: no per-iteration memcpy,
    // no division after the initial conversion. Stride is applied as
    // repeated +1 odometer steps (stride is small: worker count).
    var nonce: u64 = start_nonce;
    const tail = input_buffer[prefix_len_usize..];
    var nonce_len = writeNonceDecimal(tail, nonce);

    const step_usize = @as(usize, @intCast(@min(step, std.math.maxInt(usize))));

    var progress_counter: u32 = PROGRESS_INTERVAL;

    while (true) {
        if (cancelled) return ERROR_SENTINEL;

        const input = input_buffer[0 .. prefix_len_usize + nonce_len];

        // Fresh context per hash: cheaper than cloning a pre-fed one for
        // short prefixes (struct copy costs more than it saves).
        var ctx = sha2.Sha256.init(.{});
        ctx.update(input);
        ctx.final(&hashed);

        // Down-counter instead of `nonce % 10_000`: removes one 64-bit
        // division (wasm32 libcall) per hash.
        progress_counter -= 1;
        if (progress_counter == 0) {
            print(@floatFromInt(nonce));
            progress_counter = PROGRESS_INTERVAL;
        }

        if (verifyNonce(&hashed, &target)) break;

        // Advance nonce; bail instead of wrapping past u64.
        if (nonce > ERROR_SENTINEL - step) return ERROR_SENTINEL;
        nonce += step;
        if (nonce == ERROR_SENTINEL) return ERROR_SENTINEL;
        if (step_usize <= 64) {
            // Small stride (the worker-count case): repeated +1 odometer
            // steps, zero divisions.
            for (0..step_usize) |_| {
                nonce_len = incrementDecimalInPlace(tail, nonce_len);
            }
        } else {
            // Absurdly large stride (defensive): plain conversion.
            nonce_len = writeNonceDecimal(tail, nonce);
        }
    }

    return nonce;
}
