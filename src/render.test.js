import { describe, it, expect } from 'vitest';
import { countJunctions } from './render.js';

describe('countJunctions', () => {
  it('returns 0 when no vertex is shared by 3+ segments', () => {
    const segments = [
      { a: [0, 0], b: [100, 0] },
      { a: [200, 200], b: [300, 300] },
    ];
    expect(countJunctions(segments)).toBe(0);
  });

  it('counts a vertex where three segments meet', () => {
    // all three segments share the point (50,50)
    const segments = [
      { a: [50, 50], b: [100, 50] },
      { a: [50, 50], b: [50, 100] },
      { a: [50, 50], b: [0, 0] },
    ];
    expect(countJunctions(segments)).toBe(1);
  });

  it('does not count a simple 2-segment joint', () => {
    const segments = [
      { a: [10, 10], b: [50, 50] },
      { a: [50, 50], b: [90, 10] },
    ];
    expect(countJunctions(segments)).toBe(0);
  });
});
