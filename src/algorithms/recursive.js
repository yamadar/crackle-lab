// ============================================================
// ALGORITHM 02 — RECURSIVE VORONOI
// ============================================================
import { W, H } from '../config.js';
import { polyBbox, pointInPolygon, voronoiCells, shClip, isOnParentBoundary } from '../geometry.js';

// Pure: given params and a seeded `rand`, returns { segments }.
export function algoRecursive(p, rand) {
  const segments = [];

  function recurse(parentPoly, depth) {
    if (depth <= 0) return;
    const minArea = 800;
    const bbox = polyBbox(parentPoly);
    const w = bbox[2] - bbox[0], h = bbox[3] - bbox[1];
    if (w * h < minArea) return;

    const isPrimary = (depth === p.depth);
    const target = isPrimary ? p.primarySeeds : p.subdivision;

    // sample seeds inside parent polygon
    const seeds = [];
    const tries = target * 40;
    for (let t = 0; t < tries && seeds.length < target; t++) {
      const x = bbox[0] + rand() * w;
      const y = bbox[1] + rand() * h;
      if (pointInPolygon([x, y], parentPoly)) seeds.push([x, y]);
    }
    if (seeds.length < 2) return;

    // Voronoi within parent's bbox, then clip cells to parent polygon
    const rawCells = voronoiCells(seeds, bbox);
    const generation = p.depth - depth;
    const lineW = p.baseWidth * Math.pow(p.decay, generation);
    const seen = new Set();

    for (const raw of rawCells) {
      const clipped = shClip(raw, parentPoly);
      if (clipped.length < 3) continue;

      // emit interior edges only — skip those that lie on parent boundary
      for (let i = 0; i < clipped.length; i++) {
        const a = clipped[i], b = clipped[(i + 1) % clipped.length];
        const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        if (isOnParentBoundary(mid, parentPoly, 1.2)) continue;

        const ka = `${a[0].toFixed(1)},${a[1].toFixed(1)}`;
        const kb = `${b[0].toFixed(1)},${b[1].toFixed(1)}`;
        const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
        if (seen.has(key)) continue;
        seen.add(key);
        segments.push({ a, b, rank: generation, width: lineW });
      }

      if (depth > 1) recurse(clipped, depth - 1);
    }
  }

  // outer rectangle drawn as outermost frame at generation 0 width
  const outer = [[0, 0], [W, 0], [W, H], [0, H]];
  segments.push({ a: [0, 0], b: [W, 0], rank: 0, width: p.baseWidth });
  segments.push({ a: [W, 0], b: [W, H], rank: 0, width: p.baseWidth });
  segments.push({ a: [W, H], b: [0, H], rank: 0, width: p.baseWidth });
  segments.push({ a: [0, H], b: [0, 0], rank: 0, width: p.baseWidth });

  recurse(outer, p.depth);
  return { segments };
}
