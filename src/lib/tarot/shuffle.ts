/**
 * Fisher-Yates (Knuth) shuffle — produces an unbiased random permutation.
 *
 * Uses crypto.getRandomValues() when available (browser/Node ≥ 15) for
 * cryptographically strong randomness, falling back to Math.random() for
 * environments that don't expose the Web Crypto API (e.g. legacy test runners).
 */
export function shuffle<T>(array: T[]): T[] {
  const result = [...array];

  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1); // [0, i] inclusive
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

/**
 * Returns a cryptographically strong integer in [min, max).
 * Falls back to Math.random() when crypto is unavailable.
 */
function randomInt(min: number, max: number): number {
  const range = max - min;

  if (typeof globalThis?.crypto?.getRandomValues === 'function') {
    const bytes = new Uint32Array(1);
    // Rejection sampling to avoid modulo bias
    const maxUnbiased = Math.floor(0x100000000 / range) * range;
    let value: number;
    do {
      globalThis.crypto.getRandomValues(bytes);
      value = bytes[0];
    } while (value >= maxUnbiased);
    return min + (value % range);
  }

  return min + Math.floor(Math.random() * range);
}

/**
 * Randomly selects `count` unique items from `array` without replacement.
 * Uses the shuffle function so selection is cryptographically random.
 */
export function sampleWithoutReplacement<T>(array: T[], count: number): T[] {
  if (count > array.length) {
    throw new RangeError(
      `Cannot sample ${count} items from an array of ${array.length}`
    );
  }
  return shuffle(array).slice(0, count);
}

/**
 * Returns a random boolean (coin flip), used for upright/reversed assignment.
 */
export function randomBoolean(): boolean {
  if (typeof globalThis?.crypto?.getRandomValues === 'function') {
    const bytes = new Uint8Array(1);
    globalThis.crypto.getRandomValues(bytes);
    return bytes[0] < 128;
  }
  return Math.random() < 0.5;
}
