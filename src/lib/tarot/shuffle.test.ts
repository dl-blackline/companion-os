import { describe, it, expect } from 'vitest';
import { shuffle, sampleWithoutReplacement, randomBoolean } from '@/lib/tarot/shuffle';

describe('shuffle', () => {
  it('returns an array of the same length', () => {
    const arr = [1, 2, 3, 4, 5];
    expect(shuffle(arr)).toHaveLength(arr.length);
  });

  it('contains all the original elements', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    const result = shuffle(arr);
    expect(result.sort()).toEqual([...arr].sort());
  });

  it('does not mutate the original array', () => {
    const arr = [1, 2, 3, 4, 5];
    const original = [...arr];
    shuffle(arr);
    expect(arr).toEqual(original);
  });

  it('handles empty arrays', () => {
    expect(shuffle([])).toEqual([]);
  });

  it('handles single-element arrays', () => {
    expect(shuffle([42])).toEqual([42]);
  });

  it('produces different orderings across multiple calls (probabilistic)', () => {
    const arr = Array.from({ length: 20 }, (_, i) => i);
    const results = new Set<string>();
    for (let i = 0; i < 20; i++) {
      results.add(JSON.stringify(shuffle(arr)));
    }
    // With 20 elements, the chance of getting the same shuffle twice is negligible
    expect(results.size).toBeGreaterThan(1);
  });

  it('works with string arrays', () => {
    const arr = ['a', 'b', 'c', 'd'];
    const result = shuffle(arr);
    expect(result.sort()).toEqual([...arr].sort());
  });

  it('works with object arrays', () => {
    const arr = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const result = shuffle(arr);
    expect(result.map((x) => x.id).sort()).toEqual([1, 2, 3]);
  });
});

describe('sampleWithoutReplacement', () => {
  it('returns the requested number of items', () => {
    const arr = Array.from({ length: 78 }, (_, i) => i);
    expect(sampleWithoutReplacement(arr, 3)).toHaveLength(3);
  });

  it('returns unique items (no duplicates)', () => {
    const arr = Array.from({ length: 78 }, (_, i) => i);
    const sample = sampleWithoutReplacement(arr, 10);
    const unique = new Set(sample);
    expect(unique.size).toBe(10);
  });

  it('all sampled items come from the source array', () => {
    const arr = [10, 20, 30, 40, 50];
    const sample = sampleWithoutReplacement(arr, 3);
    for (const item of sample) {
      expect(arr).toContain(item);
    }
  });

  it('throws RangeError when count exceeds array length', () => {
    expect(() => sampleWithoutReplacement([1, 2], 5)).toThrowError(RangeError);
  });

  it('returns entire array when count equals array length', () => {
    const arr = [1, 2, 3];
    const result = sampleWithoutReplacement(arr, 3);
    expect(result.sort()).toEqual([1, 2, 3]);
  });

  it('returns empty array when count is 0', () => {
    expect(sampleWithoutReplacement([1, 2, 3], 0)).toEqual([]);
  });
});

describe('randomBoolean', () => {
  it('returns true or false', () => {
    const result = randomBoolean();
    expect(typeof result).toBe('boolean');
  });

  it('produces both true and false across many calls', () => {
    const results = new Set<boolean>();
    for (let i = 0; i < 100; i++) {
      results.add(randomBoolean());
    }
    expect(results.has(true)).toBe(true);
    expect(results.has(false)).toBe(true);
  });
});
