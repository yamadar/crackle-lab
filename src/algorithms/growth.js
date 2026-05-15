// ============================================================
// ALGORITHM 03 — CRACK GROWTH (sequential T-junction)
// ============================================================
import { W, H } from '../config.js';
import { pointToSegmentDist } from '../geometry.js';

// Pure: given params and a seeded `rand`, returns { segments }.
export function algoGrowth(p, rand) {
  const segments = [];
  const stepLen = 13;

  // spatial grid for collision detection
  const cellSize = Math.max(stepLen * 2, p.snapDist * 2.5);
  const cols = Math.ceil(W / cellSize);
  const rows = Math.ceil(H / cellSize);
  const grid = Array.from({ length: cols * rows }, () => []);

  function gridAdd(seg) {
    const minX = Math.max(0, Math.floor(Math.min(seg.a[0], seg.b[0]) / cellSize) - 1);
    const maxX = Math.min(cols - 1, Math.floor(Math.max(seg.a[0], seg.b[0]) / cellSize) + 1);
    const minY = Math.max(0, Math.floor(Math.min(seg.a[1], seg.b[1]) / cellSize) - 1);
    const maxY = Math.min(rows - 1, Math.floor(Math.max(seg.a[1], seg.b[1]) / cellSize) + 1);
    for (let r = minY; r <= maxY; r++) {
      for (let c = minX; c <= maxX; c++) grid[r * cols + c].push(seg);
    }
  }

  function findHit(target, ownerTipPos, maxDist) {
    const ci = Math.floor(target[0] / cellSize);
    const ri = Math.floor(target[1] / cellSize);
    let best = null, bestD = maxDist;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = ri + dr, nc = ci + dc;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        for (const s of grid[nr * cols + nc]) {
          // skip own most-recent segment(s) from current tip
          const eps2 = 1.5;
          if ((Math.abs(s.a[0] - ownerTipPos[0]) < eps2 && Math.abs(s.a[1] - ownerTipPos[1]) < eps2) ||
              (Math.abs(s.b[0] - ownerTipPos[0]) < eps2 && Math.abs(s.b[1] - ownerTipPos[1]) < eps2)) continue;
          const r = pointToSegmentDist(target, s.a, s.b);
          if (r.dist < bestD) { bestD = r.dist; best = { seg: s, point: r.point, dist: r.dist }; }
        }
      }
    }
    return best;
  }

  const tips = [];
  // initial primary cracks
  for (let i = 0; i < p.initial; i++) {
    const x = 0.12 * W + rand() * 0.76 * W;
    const y = 0.12 * H + rand() * 0.76 * H;
    const a = rand() * Math.PI * 2;
    tips.push({ x, y, a, gen: 0, alive: true, age: 0 });
    tips.push({ x, y, a: a + Math.PI, gen: 0, alive: true, age: 0 });
  }

  const maxTips = 280;

  for (let step = 0; step < p.steps; step++) {
    let liveCount = 0;
    for (let ti = 0; ti < tips.length; ti++) {
      const t = tips[ti];
      if (!t.alive) continue;
      liveCount++;

      t.a += (rand() - 0.5) * p.wiggle;
      const nx = t.x + Math.cos(t.a) * stepLen;
      const ny = t.y + Math.sin(t.a) * stepLen;

      if (nx < 4 || nx > W - 4 || ny < 4 || ny > H - 4) {
        t.alive = false;
        continue;
      }

      const hit = (t.age > 1) ? findHit([nx, ny], [t.x, t.y], p.snapDist) : null;
      if (hit) {
        const seg = { a: [t.x, t.y], b: hit.point, gen: t.gen };
        segments.push(seg);
        gridAdd(seg);
        t.alive = false;
        continue;
      }

      const seg = { a: [t.x, t.y], b: [nx, ny], gen: t.gen };
      segments.push(seg);
      gridAdd(seg);
      t.x = nx; t.y = ny; t.age++;

      if (t.gen < p.maxGen && rand() < p.branchProb && t.age > 3 && tips.length < maxTips) {
        const sign = rand() < 0.5 ? 1 : -1;
        const branchA = t.a + sign * (Math.PI / 2 + (rand() - 0.5) * 0.18);
        tips.push({ x: t.x, y: t.y, a: branchA, gen: t.gen + 1, alive: true, age: 0 });
      }
    }
    if (liveCount === 0) {
      // nucleation: 既存ネットワーク上に新規クラック発生
      // (Iben & O'Brien 2009 の応力解放による新規 nucleation point に対応)
      if (segments.length === 0 || tips.length >= maxTips) break;
      const src = segments[Math.floor(rand() * segments.length)];
      const tt = 0.2 + rand() * 0.6;
      const sx = src.a[0] + (src.b[0] - src.a[0]) * tt;
      const sy = src.a[1] + (src.b[1] - src.a[1]) * tt;
      const segAngle = Math.atan2(src.b[1] - src.a[1], src.b[0] - src.a[0]);
      const branchA = segAngle + (rand() < 0.5 ? Math.PI / 2 : -Math.PI / 2) + (rand() - 0.5) * 0.25;
      const newGen = Math.min((src.gen || 0) + 1, p.maxGen);
      tips.push({ x: sx, y: sy, a: branchA, gen: newGen, alive: true, age: 0 });
    }
  }

  // assign widths by generation (thicker for primary)
  const baseW = 5.5;
  for (const s of segments) {
    s.width = baseW * Math.pow(0.55, s.gen);
    s.rank = s.gen;
  }
  return { segments };
}
