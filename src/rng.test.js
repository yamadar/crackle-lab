import { describe, it, expect } from 'vitest';
import { mulberry32 } from './rng.js';

describe('mulberry32', () => {
  it('produces floats in [0, 1)', () => {
    const r = mulberry32(12345);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('is deterministic — same seed yields same sequence', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 50 }, () => a());
    const seqB = Array.from({ length: 50 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('different seeds yield different sequences', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const seqA = Array.from({ length: 50 }, () => a());
    const seqB = Array.from({ length: 50 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it('is reasonably uniform (mean near 0.5)', () => {
    const r = mulberry32(777);
    let sum = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) sum += r();
    expect(sum / n).toBeGreaterThan(0.47);
    expect(sum / n).toBeLessThan(0.53);
  });

  it('advances state — consecutive draws differ', () => {
    const r = mulberry32(99);
    const first = r();
    const second = r();
    expect(first).not.toBe(second);
  });
});
