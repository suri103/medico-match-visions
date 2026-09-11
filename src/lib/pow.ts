// Optimized client-side Proof-of-Work solver for MedicoMatch auth challenges.
// Precomputes chunk-0 for SHA-256 over fixed 64-byte challenge string, solving
// difficulty 18 (~262k iterations) in ~30-200ms without UI thread freeze.

function rightRotate(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

const H0 = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
];

const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

export function solvePowChallenge(challenge: string, difficulty = 18): { nonce: string; hash?: string } {
  if (typeof challenge !== 'string' || challenge.length !== 64) {
    return { nonce: '0' };
  }

  // Precompute chunk 0 from the 64-byte hex challenge
  const chunk0Words = new Int32Array(16);
  for (let i = 0; i < 64; i++) {
    chunk0Words[i >> 2] |= challenge.charCodeAt(i) << ((3 - (i % 4)) * 8);
  }

  const w0 = new Int32Array(64);
  for (let i = 0; i < 16; i++) w0[i] = chunk0Words[i];
  for (let i = 16; i < 64; i++) {
    const gamma0 = rightRotate(w0[i - 15], 7) ^ rightRotate(w0[i - 15], 18) ^ (w0[i - 15] >>> 3);
    const gamma1 = rightRotate(w0[i - 2], 17) ^ rightRotate(w0[i - 2], 19) ^ (w0[i - 2] >>> 10);
    w0[i] = (((w0[i - 16] + gamma0) | 0) + ((w0[i - 7] + gamma1) | 0)) | 0;
  }

  let a0 = H0[0], b0 = H0[1], c0 = H0[2], d0 = H0[3];
  let e0 = H0[4], f0 = H0[5], g0 = H0[6], h0 = H0[7];
  for (let i = 0; i < 64; i++) {
    const s1 = rightRotate(e0, 6) ^ rightRotate(e0, 11) ^ rightRotate(e0, 25);
    const ch = (e0 & f0) ^ (~e0 & g0);
    const temp1 = (((h0 + s1) | 0) + ((ch + K[i]) | 0) + w0[i]) | 0;
    const s0 = rightRotate(a0, 2) ^ rightRotate(a0, 13) ^ rightRotate(a0, 22);
    const maj = (a0 & b0) ^ (a0 & c0) ^ (b0 & c0);
    const temp2 = (s0 + maj) | 0;
    h0 = g0; g0 = f0; f0 = e0; e0 = (d0 + temp1) | 0;
    d0 = c0; c0 = b0; b0 = a0; a0 = (temp1 + temp2) | 0;
  }

  const stateA = (H0[0] + a0) | 0;
  const stateB = (H0[1] + b0) | 0;
  const stateC = (H0[2] + c0) | 0;
  const stateD = (H0[3] + d0) | 0;
  const stateE = (H0[4] + e0) | 0;
  const stateF = (H0[5] + f0) | 0;
  const stateG = (H0[6] + g0) | 0;
  const stateH = (H0[7] + h0) | 0;

  const w1 = new Int32Array(64);
  const w1Initial = new Int32Array(16);

  // Shift right threshold for difficulty bits in state A:
  // e.g. difficulty 18 -> (32 - 18) = 14
  const shift = 32 - difficulty;
  let nonce = 0;

  while (nonce < 20_000_000) {
    const nonceStr = String(nonce);
    const nonceLen = nonceStr.length;
    const totalLen = 64 + nonceLen;
    const totalBits = totalLen * 8;

    for (let i = 0; i < 16; i++) w1Initial[i] = 0;
    for (let i = 0; i < nonceLen; i++) {
      w1Initial[i >> 2] |= nonceStr.charCodeAt(i) << ((3 - (i % 4)) * 8);
    }
    w1Initial[nonceLen >> 2] |= 0x80 << ((3 - (nonceLen % 4)) * 8);
    w1Initial[15] = totalBits;

    for (let i = 0; i < 16; i++) w1[i] = w1Initial[i];
    for (let i = 16; i < 64; i++) {
      const gamma0 = rightRotate(w1[i - 15], 7) ^ rightRotate(w1[i - 15], 18) ^ (w1[i - 15] >>> 3);
      const gamma1 = rightRotate(w1[i - 2], 17) ^ rightRotate(w1[i - 2], 19) ^ (w1[i - 2] >>> 10);
      w1[i] = (((w1[i - 16] + gamma0) | 0) + ((w1[i - 7] + gamma1) | 0)) | 0;
    }

    let a = stateA, b = stateB, c = stateC, d = stateD;
    let e = stateE, f = stateF, g = stateG, h = stateH;
    for (let i = 0; i < 64; i++) {
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (((h + s1) | 0) + ((ch + K[i]) | 0) + w1[i]) | 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) | 0;
      h = g; g = f; f = e; e = (d + temp1) | 0;
      d = c; c = b; b = a; a = (temp1 + temp2) | 0;
    }

    const finalA = (stateA + a) | 0;
    if ((finalA >>> shift) === 0) {
      return { nonce: nonceStr };
    }
    nonce++;
  }

  return { nonce: String(nonce) };
}

/**
 * Fetches a PoW challenge from the server for the specified email and computes the solution.
 * Fails open (returns empty object) if challenge cannot be fetched or PoW is disabled.
 */
export async function obtainPowSolution(baseUrl: string, email: string): Promise<{ powChallenge?: string; powNonce?: string }> {
  try {
    const res = await fetch(`${baseUrl}/api/auth/pow-challenge?email=${encodeURIComponent(email.trim().toLowerCase())}`, {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) return {};
    const data = (await res.json()) as { challenge?: string; difficulty?: number };
    if (typeof data.challenge === 'string' && data.challenge.length === 64) {
      const { nonce } = solvePowChallenge(data.challenge, data.difficulty || 18);
      return { powChallenge: data.challenge, powNonce: nonce };
    }
  } catch {
    // Network or server error - return empty so caller can proceed with whatever backend allows
  }
  return {};
}
