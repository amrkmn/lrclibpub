const std = @import("std");

// Console log function imported from JavaScript environment
// Used to report progress back to the web worker
extern "env" fn console_log(value: f64) void;

// Verify if the hash result meets the target difficulty
fn verify_nonce(result: []const u8, target: []const u8) bool {
    if (result.len != target.len) {
        return false;
    }
    var i: usize = 0;
    while (i < result.len - 1) : (i += 1) {
        if (result[i] > target[i]) {
            return false;
        } else if (result[i] < target[i]) {
            break;
        }
    }
    return true;
}

// Convert hex string to bytes (equivalent to Rust's HEXUPPER.decode)
fn hexToBytes(out: []u8, hex_str: []const u8) !void {
    if (hex_str.len % 2 != 0) return error.InvalidLength;
    if (out.len != hex_str.len / 2) return error.InvalidLength;

    for (0..out.len) |i| {
        const high = try std.fmt.charToDigit(hex_str[i * 2], 16);
        const low = try std.fmt.charToDigit(hex_str[i * 2 + 1], 16);
        out[i] = (high << 4) | low;
    }
}

// Main proof-of-work solving function
// Takes prefix and target as memory pointers and lengths
// Returns offset to result string in WASM memory
export fn solve_challenge(prefix_ptr: [*]const u8, prefix_len: u32, target_hex_ptr: [*]const u8, target_hex_len: u32) u32 {
    var nonce: u64 = 0;
    var hashed: [32]u8 = undefined;
    var target: [32]u8 = undefined;

    const prefix = prefix_ptr[0..prefix_len];
    const target_hex = target_hex_ptr[0..target_hex_len];

    // Convert hex target to bytes
    hexToBytes(&target, target_hex) catch {
        return 0; // Return 0 on error
    };

    // Proof-of-work loop: increment nonce until hash meets target
    while (true) {
        var context = std.crypto.hash.sha2.Sha256.init(.{});

        // Format input string: prefix + nonce
        var input_buffer: [256]u8 = undefined;
        const input = std.fmt.bufPrint(&input_buffer, "{s}{d}", .{ prefix, nonce }) catch {
            return 0; // Return 0 on error
        };

        context.update(input);
        context.final(&hashed);

        // Report progress every 10,000 attempts
        if (nonce % 10000 == 0) {
            console_log(@floatFromInt(nonce));
        }

        if (verify_nonce(&hashed, &target)) {
            break;
        } else {
            nonce += 1;
        }
    }

    // Store the winning nonce as string in global buffer
    const result_str = std.fmt.bufPrint(&result_buffer, "{d}", .{nonce}) catch {
        return 0;
    };
    result_len = @intCast(result_str.len);
    return @intFromPtr(&result_buffer);
}

// Global buffer for storing the result nonce string
var result_buffer: [64]u8 = undefined;
var result_len: u32 = 0;

// Get the length of the result string
export fn get_result_length() u32 {
    return result_len;
}
