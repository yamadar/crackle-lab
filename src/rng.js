// ============================================================
// SEEDED PRNG
// ============================================================

// mulberry32 — a small, fast, deterministic PRNG.
// Returns a function producing floats in [0, 1) for a given integer seed.
export function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
