/** Deterministic helpers: string hashing and a seeded PRNG. */

export function hash32(s: string, seed = 0x811c9dc5): number {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable tie-breaker in [0,1) for an item under a seed. */
export function jitter(seed: number, key: string): number {
  return hash32(key, seed) / 4294967296;
}

export function newId(seed: number): string {
  const r = mulberry32(seed);
  let s = '';
  for (let i = 0; i < 12; i++) s += 'abcdefghijkmnpqrstuvwxyz23456789'[Math.floor(r() * 32)];
  return s;
}
