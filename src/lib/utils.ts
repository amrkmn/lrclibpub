export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

export function verifyNonce(result: Uint8Array, target: Uint8Array): boolean {
  if (result.length !== target.length) {
    return false;
  }

  for (let i = 0; i < result.length - 1; i++) {
    if (result[i] > target[i]) {
      return false;
    } else if (result[i] < target[i]) {
      break;
    }
  }
  return true;
}

export async function solveChallenge(
  prefix: string,
  targetHex: string
): Promise<string> {
  const target = hexToBytes(targetHex);
  let nonce = 0;
  let lastUpdate = Date.now();
  let attempts = 0;

  while (true) {
    const input = `${prefix}${nonce}`;
    const hashBuffer = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(input)
    );
    const hashArray = new Uint8Array(hashBuffer);

    attempts++;
    if (Date.now() - lastUpdate > 100) {
      // Update every 100ms
      console.log(`Tried ${attempts} hashes (current nonce: ${nonce})`);
      // @ts-ignore - we know window.publishProgress exists
      window.publishProgress?.(attempts, nonce);
      lastUpdate = Date.now();
      attempts = 0;
    }

    if (verifyNonce(hashArray, target)) {
      return nonce.toString();
    }
    nonce++;
  }
}
