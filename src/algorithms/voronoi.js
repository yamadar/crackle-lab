// ============================================================
// ALGORITHM 01 — VORONOI (BASIC)
// ============================================================
import { W, H } from '../config.js';
import { poissonDisk, voronoiCells } from '../geometry.js';

// Pure: given params and a seeded `rand`, returns { segments }.
export function algoVoronoi(p, rand) {
  const radius = p.spacing * 3;
  const seeds = poissonDisk(W, H, radius, p.jitter, rand);
  const cells = voronoiCells(seeds, [0, 0, W, H]);
  const segments = [];
  const seen = new Set();
  for (const cell of cells) {
    for (let i = 0; i < cell.length; i++) {
      const a = cell[i], b = cell[(i + 1) % cell.length];
      const ka = `${a[0].toFixed(1)},${a[1].toFixed(1)}`;
      const kb = `${b[0].toFixed(1)},${b[1].toFixed(1)}`;
      const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      if (seen.has(key)) continue;
      seen.add(key);
      segments.push({ a, b, rank: 0, width: p.stroke * 2 });
    }
  }
  return { segments };
}
