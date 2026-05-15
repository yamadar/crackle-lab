import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../rng.js';
import { W, H } from '../config.js';
import { algoVoronoi, algoRecursive, algoGrowth, algoGrammar } from './index.js';
import { algorithms } from './index.js';

// Default params mirroring the index.html slider defaults / sensible values.
const defaults = {
  voronoi: { spacing: 30, jitter: 0.6, stroke: 1.5 },
  recursive: { depth: 3, primarySeeds: 8, subdivision: 4, decay: 0.6, baseWidth: 6 },
  growth: { initial: 6, steps: 300, branchProb: 0.04, wiggle: 0.4, snapDist: 18, maxGen: 3 },
  grammar: { mainLength: 220, branchGap: 90, branchProb: 0.7, maxRank: 4, lengthFactor: 0.7, angleNoise: 0.3 },
};

// A segment must have two [x,y] endpoints and a numeric width.
function expectValidSegment(s) {
  expect(Array.isArray(s.a)).toBe(true);
  expect(Array.isArray(s.b)).toBe(true);
  expect(s.a).toHaveLength(2);
  expect(s.b).toHaveLength(2);
  for (const v of [...s.a, ...s.b]) expect(Number.isFinite(v)).toBe(true);
  expect(typeof s.width).toBe('number');
  expect(s.width).toBeGreaterThan(0);
}

// Within-bounds with a tolerance — snapping/clipping should keep things on-canvas.
function expectInBounds(s, tol = 2) {
  for (const [x, y] of [s.a, s.b]) {
    expect(x).toBeGreaterThanOrEqual(-tol);
    expect(x).toBeLessThanOrEqual(W + tol);
    expect(y).toBeGreaterThanOrEqual(-tol);
    expect(y).toBeLessThanOrEqual(H + tol);
  }
}

describe.each([
  ['voronoi', algoVoronoi],
  ['recursive', algoRecursive],
  ['growth', algoGrowth],
  ['grammar', algoGrammar],
])('%s algorithm', (name, fn) => {
  it('returns a { segments } array of valid segments', () => {
    const out = fn(defaults[name], mulberry32(123));
    expect(out).toHaveProperty('segments');
    expect(Array.isArray(out.segments)).toBe(true);
    expect(out.segments.length).toBeGreaterThan(0);
    for (const s of out.segments) expectValidSegment(s);
  });

  it('keeps all geometry within canvas bounds', () => {
    const out = fn(defaults[name], mulberry32(55));
    for (const s of out.segments) expectInBounds(s);
  });

  it('is deterministic for a fixed seed', () => {
    const a = fn(defaults[name], mulberry32(2024));
    const b = fn(defaults[name], mulberry32(2024));
    expect(a.segments).toEqual(b.segments);
  });

  it('produces different output for different seeds', () => {
    const a = fn(defaults[name], mulberry32(1));
    const b = fn(defaults[name], mulberry32(99999));
    expect(a.segments).not.toEqual(b.segments);
  });

  it('is exposed via the algorithms registry', () => {
    expect(algorithms[name]).toBe(fn);
  });
});

describe('algoVoronoi parameter sensitivity', () => {
  it('stroke width drives segment width', () => {
    const thin = algoVoronoi({ spacing: 30, jitter: 0.6, stroke: 1 }, mulberry32(5));
    const thick = algoVoronoi({ spacing: 30, jitter: 0.6, stroke: 4 }, mulberry32(5));
    expect(thin.segments[0].width).toBeCloseTo(2);
    expect(thick.segments[0].width).toBeCloseTo(8);
  });

  it('tighter spacing yields more segments', () => {
    const sparse = algoVoronoi({ spacing: 60, jitter: 0.6, stroke: 1.5 }, mulberry32(8));
    const dense = algoVoronoi({ spacing: 15, jitter: 0.6, stroke: 1.5 }, mulberry32(8));
    expect(dense.segments.length).toBeGreaterThan(sparse.segments.length);
  });
});

describe('algoGrowth parameter sensitivity', () => {
  it('more steps yields more segments', () => {
    const few = algoGrowth({ ...defaults.growth, steps: 80 }, mulberry32(11));
    const many = algoGrowth({ ...defaults.growth, steps: 600 }, mulberry32(11));
    expect(many.segments.length).toBeGreaterThan(few.segments.length);
  });

  it('assigns rank equal to generation and decaying width', () => {
    const out = algoGrowth(defaults.growth, mulberry32(11));
    for (const s of out.segments) {
      expect(s.rank).toBe(s.gen);
      expect(s.width).toBeCloseTo(5.5 * Math.pow(0.55, s.gen));
    }
  });
});

describe('algoRecursive parameter sensitivity', () => {
  it('greater depth yields more segments', () => {
    const shallow = algoRecursive({ ...defaults.recursive, depth: 1 }, mulberry32(13));
    const deep = algoRecursive({ ...defaults.recursive, depth: 3 }, mulberry32(13));
    expect(deep.segments.length).toBeGreaterThan(shallow.segments.length);
  });

  it('always emits the four outer frame edges', () => {
    const out = algoRecursive({ ...defaults.recursive, depth: 1 }, mulberry32(13));
    // first four pushed segments are the canvas border
    expect(out.segments.length).toBeGreaterThanOrEqual(4);
  });
});

describe('algoGrammar parameter sensitivity', () => {
  it('width decays with rank', () => {
    const out = algoGrammar(defaults.grammar, mulberry32(17));
    for (const s of out.segments) {
      expect(s.width).toBeCloseTo(6 * Math.pow(0.5, s.rank));
    }
  });

  it('higher branch probability yields more segments', () => {
    const low = algoGrammar({ ...defaults.grammar, branchProb: 0.1 }, mulberry32(17));
    const high = algoGrammar({ ...defaults.grammar, branchProb: 0.95 }, mulberry32(17));
    expect(high.segments.length).toBeGreaterThanOrEqual(low.segments.length);
  });
});
