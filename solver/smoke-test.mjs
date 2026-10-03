// Smoke test for the freshly built solver.wasm (BigInt-aware).
// Run from the solver/ directory: `node smoke-test.mjs`.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const wasmBytes = readFileSync("zig-out/bin/solver.wasm");
const { instance } = await WebAssembly.instantiate(wasmBytes, {
  env: { print: () => {} },
});
const { solveChallenge, requestCancel, memory } = instance.exports;

function solve(prefix, targetHex, start = 0n, stride = 1n) {
  const mem = new Uint8Array(memory.buffer);
  const p = Buffer.from(prefix, "utf8");
  const t = Buffer.from(targetHex, "utf8");
  mem.set(p, 0);
  mem.set(t, 512);
  return solveChallenge(0, p.length, 512, t.length, start, stride);
}

function refSolve(prefix, target) {
  const tgt = Buffer.from(target, "hex");
  let n = 0n;
  while (true) {
    const h = createHash("sha256").update(prefix + n.toString()).digest();
    if (Buffer.compare(h, tgt) < 0) return n;
    n++;
  }
}

let pass = 0,
  fail = 0;
function check(name, cond, extra = "") {
  if (cond) {
    pass++;
    console.log(`ok   ${name}`);
  } else {
    fail++;
    console.log(`FAIL ${name} ${extra}`);
  }
}

// 1. trivial target -> nonce 0 (also proves nonce-0 no longer errors)
let r = solve("test", "ff".repeat(32));
check("trivial target => nonce 0", r === 0n, `got ${r}`);

// 2. moderate target matches JS reference (stride 1)
const tgt2 = "00" + "ff".repeat(31);
const expected = refSolve("lrclib:", tgt2);
r = solve("lrclib:", tgt2);
check(`moderate target => ${expected}`, r === expected, `got ${r}`);

// 3. strided: start=2 stride=4 -> nonce%4==2 and hash valid
r = solve("lrclib:", tgt2, 2n, 4n);
const h3 = createHash("sha256")
  .update("lrclib:" + r.toString())
  .digest();
check(
  "strided result valid + congruent",
  r % 4n === 2n && Buffer.compare(h3, Buffer.from(tgt2, "hex")) < 0,
  `got ${r}`,
);
// strided must skip non-congruent winners: reference scan of congruent nonces
let n = 2n;
while (true) {
  const h = createHash("sha256").update("lrclib:" + n.toString()).digest();
  if (Buffer.compare(h, Buffer.from(tgt2, "hex")) < 0) break;
  n += 4n;
}
check("strided finds minimal congruent nonce", r === n, `got ${r} want ${n}`);

// 4. invalid hex -> sentinel (u64 max reads back as signed i64 -1n)
r = solve("test", "zz".repeat(32));
check("invalid hex => sentinel", r === -1n, `got ${r}`);

// 5. overlong prefix (45B) -> sentinel
r = solve("a".repeat(45), "ff".repeat(32));
check("45B prefix => sentinel", r === -1n, `got ${r}`);

// 6. 44B prefix OK
r = solve("a".repeat(44), "ff".repeat(32));
check("44B prefix => nonce 0", r === 0n, `got ${r}`);

// 7. requestCancel export exists and run with cancel already requested still works
// (cancel resets on entry, so a solve without mid-loop cancel completes)
requestCancel();
r = solve("test", "ff".repeat(32));
check("cancel resets on entry", r === 0n, `got ${r}`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
