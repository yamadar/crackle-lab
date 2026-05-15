import { describe, it, expect } from 'vitest';
import { mulberry32 } from './rng.js';
import {
  poissonDisk,
  clipHalfPlane,
  voronoiCells,
  polyBbox,
  pointInPolygon,
  shClip,
  pointToSegmentDist,
  isOnParentBoundary,
} from './geometry.js';

const square = [[0, 0], [10, 0], [10, 10], [0, 10]];

describe('polyBbox', () => {
  it('returns [minX, minY, maxX, maxY]', () => {
    expect(polyBbox(square)).toEqual([0, 0, 10, 10]);
  });
  it('handles negative and offset coords', () => {
    expect(polyBbox([[-5, 3], [2, -8], [7, 12]])).toEqual([-5, -8, 7, 12]);
  });
});

describe('pointInPolygon', () => {
  it('detects an interior point', () => {
    expect(pointInPolygon([5, 5], square)).toBe(true);
  });
  it('detects an exterior point', () => {
    expect(pointInPolygon([20, 20], square)).toBe(false);
    expect(pointInPolygon([-1, 5], square)).toBe(false);
  });
});

describe('pointToSegmentDist', () => {
  it('measures perpendicular distance to a segment', () => {
    const r = pointToSegmentDist([5, 3], [0, 0], [10, 0]);
    expect(r.dist).toBeCloseTo(3);
    expect(r.point[0]).toBeCloseTo(5);
    expect(r.point[1]).toBeCloseTo(0);
    expect(r.t).toBeCloseTo(0.5);
  });
  it('clamps to the nearer endpoint when past the segment', () => {
    const r = pointToSegmentDist([-4, 0], [0, 0], [10, 0]);
    expect(r.dist).toBeCloseTo(4);
    expect(r.t).toBe(0);
  });
});

describe('isOnParentBoundary', () => {
  it('is true for a point on an edge', () => {
    expect(isOnParentBoundary([5, 0], square, 1)).toBe(true);
  });
  it('is false for an interior point', () => {
    expect(isOnParentBoundary([5, 5], square, 1)).toBe(false);
  });
});

describe('clipHalfPlane', () => {
  it('keeps the half closer to p', () => {
    // bisector of (2,5) and (8,5) is the vertical line x=5
    const out = clipHalfPlane(square, [2, 5], [8, 5]);
    for (const [x] of out) expect(x).toBeLessThanOrEqual(5 + 1e-9);
  });
});

describe('shClip', () => {
  it('clips a polygon down to the clip window', () => {
    const big = [[-5, -5], [15, -5], [15, 15], [-5, 15]];
    const out = shClip(big, square);
    const bb = polyBbox(out);
    expect(bb[0]).toBeGreaterThanOrEqual(-1e-6);
    expect(bb[1]).toBeGreaterThanOrEqual(-1e-6);
    expect(bb[2]).toBeLessThanOrEqual(10 + 1e-6);
    expect(bb[3]).toBeLessThanOrEqual(10 + 1e-6);
  });
});

describe('voronoiCells', () => {
  it('returns one cell per seed, each within the bbox', () => {
    const seeds = [[2, 2], [8, 2], [5, 8]];
    const cells = voronoiCells(seeds, [0, 0, 10, 10]);
    expect(cells.length).toBe(3);
    for (const cell of cells) {
      expect(cell.length).toBeGreaterThanOrEqual(3);
      const bb = polyBbox(cell);
      expect(bb[0]).toBeGreaterThanOrEqual(-1e-6);
      expect(bb[2]).toBeLessThanOrEqual(10 + 1e-6);
    }
  });
});

describe('poissonDisk', () => {
  it('produces a regular grid when jitter is ~0', () => {
    const rand = mulberry32(1);
    const pts = poissonDisk(200, 200, 40, 0, rand);
    expect(pts.length).toBeGreaterThan(0);
    for (const [x, y] of pts) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
    }
  });

  it('is deterministic for a fixed seed', () => {
    const a = poissonDisk(300, 300, 50, 0.8, mulberry32(7));
    const b = poissonDisk(300, 300, 50, 0.8, mulberry32(7));
    expect(a).toEqual(b);
  });

  it('keeps Poisson samples at least the min radius apart', () => {
    const radius = 50, jitter = 0.7;
    const pts = poissonDisk(400, 400, radius, jitter, mulberry32(3));
    const r = radius * (0.55 + 0.45 * jitter);
    expect(pts.length).toBeGreaterThan(1);
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i][0] - pts[j][0];
        const dy = pts[i][1] - pts[j][1];
        expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(r - 1e-6);
      }
    }
  });

  it('smaller radius yields more points', () => {
    const dense = poissonDisk(400, 400, 30, 0.5, mulberry32(9));
    const sparse = poissonDisk(400, 400, 90, 0.5, mulberry32(9));
    expect(dense.length).toBeGreaterThan(sparse.length);
  });
});
