// ============================================================
// ALGORITHM 04 — CITY GRAMMAR (Parish-Müller simplified)
// ============================================================
import { W, H } from '../config.js';
import { pointToSegmentDist } from '../geometry.js';

// Pure: given params and a seeded `rand`, returns { segments }.
export function algoGrammar(p, rand) {
  const segments = [];
  const cellSize = 50;
  const cols = Math.ceil(W / cellSize);
  const rows = Math.ceil(H / cellSize);
  const grid = Array.from({ length: cols * rows }, () => []);

  function gridAdd(seg) {
    const minX = Math.max(0, Math.floor(Math.min(seg.a[0], seg.b[0]) / cellSize));
    const maxX = Math.min(cols - 1, Math.floor(Math.max(seg.a[0], seg.b[0]) / cellSize));
    const minY = Math.max(0, Math.floor(Math.min(seg.a[1], seg.b[1]) / cellSize));
    const maxY = Math.min(rows - 1, Math.floor(Math.max(seg.a[1], seg.b[1]) / cellSize));
    for (let r = minY; r <= maxY; r++) {
      for (let c = minX; c <= maxX; c++) grid[r * cols + c].push(seg);
    }
  }
  function nearest(point, dist, excludeStart) {
    const ci = Math.floor(point[0] / cellSize);
    const ri = Math.floor(point[1] / cellSize);
    let best = null, bestD = dist;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = ri + dr, nc = ci + dc;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        for (const s of grid[nr * cols + nc]) {
          if (excludeStart) {
            const eps = 1.5;
            if ((Math.abs(s.a[0] - excludeStart[0]) < eps && Math.abs(s.a[1] - excludeStart[1]) < eps) ||
                (Math.abs(s.b[0] - excludeStart[0]) < eps && Math.abs(s.b[1] - excludeStart[1]) < eps)) continue;
          }
          const r = pointToSegmentDist(point, s.a, s.b);
          if (r.dist < bestD) { bestD = r.dist; best = { p: r.point, seg: s }; }
        }
      }
    }
    return best;
  }

  const queue = [];
  // Initial cross — long enough to clip at canvas edges
  const cx = W / 2, cy = H / 2;
  const longLen = Math.max(W, H);
  for (const dir of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    queue.push({ start: [cx, cy], dir, length: longLen, rank: 0 });
  }

  let iter = 0;
  const maxIter = 6000;
  const snapDist = 22;

  while (queue.length > 0 && iter < maxIter) {
    iter++;
    const seg = queue.shift();
    if (seg.rank > p.maxRank) continue;
    if (seg.length < 6) continue;

    const dir = [Math.cos(seg.dir), Math.sin(seg.dir)];
    let endX = seg.start[0] + dir[0] * seg.length;
    let endY = seg.start[1] + dir[1] * seg.length;

    // clip to canvas
    if (endX < 0 || endX > W || endY < 0 || endY > H) {
      let t = 1;
      const guard = 1e-9;
      if (Math.abs(dir[0]) > guard) {
        if (endX < 0) t = Math.min(t, (0 - seg.start[0]) / (dir[0] * seg.length));
        if (endX > W) t = Math.min(t, (W - seg.start[0]) / (dir[0] * seg.length));
      }
      if (Math.abs(dir[1]) > guard) {
        if (endY < 0) t = Math.min(t, (0 - seg.start[1]) / (dir[1] * seg.length));
        if (endY > H) t = Math.min(t, (H - seg.start[1]) / (dir[1] * seg.length));
      }
      if (t < 0.05) continue;
      endX = seg.start[0] + dir[0] * seg.length * t;
      endY = seg.start[1] + dir[1] * seg.length * t;
      seg.length = seg.length * t;
    }

    // T-snap to nearby existing segment
    const hit = nearest([endX, endY], snapDist, seg.start);
    if (hit) {
      const dStart = Math.hypot(seg.start[0] - hit.p[0], seg.start[1] - hit.p[1]);
      if (dStart > 8) { endX = hit.p[0]; endY = hit.p[1]; }
    }

    const newSeg = { a: seg.start, b: [endX, endY], rank: seg.rank };
    segments.push(newSeg);
    gridAdd(newSeg);

    // perpendicular branches at intervals
    const totalLen = Math.hypot(endX - seg.start[0], endY - seg.start[1]);
    const numGaps = Math.floor(totalLen / p.branchGap);
    for (let i = 1; i < numGaps; i++) {
      const tt = i / numGaps;
      const bx = seg.start[0] + (endX - seg.start[0]) * tt;
      const by = seg.start[1] + (endY - seg.start[1]) * tt;

      if (rand() < p.branchProb) {
        const a = seg.dir + Math.PI / 2 + (rand() - 0.5) * p.angleNoise;
        queue.push({
          start: [bx, by], dir: a,
          length: p.mainLength * Math.pow(p.lengthFactor, seg.rank),
          rank: seg.rank + 1
        });
      }
      if (rand() < p.branchProb) {
        const a = seg.dir - Math.PI / 2 + (rand() - 0.5) * p.angleNoise;
        queue.push({
          start: [bx, by], dir: a,
          length: p.mainLength * Math.pow(p.lengthFactor, seg.rank),
          rank: seg.rank + 1
        });
      }
    }
  }

  const baseW = 6;
  for (const s of segments) s.width = baseW * Math.pow(0.5, s.rank);
  return { segments };
}
