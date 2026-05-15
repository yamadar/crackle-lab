import './style.css';

"use strict";

// ============================================================
// STATE & RNG
// ============================================================
const state = {
  algo: 'voronoi',
  seed: Math.floor(Math.random() * 1e9),
  rng: null,
};
function mulberry32(a) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const rand = () => state.rng();

// canvas internal dims
const W = 1200, H = 1200;

// ============================================================
// GEOMETRY UTILITIES
// ============================================================

// Poisson disk sampling (Bridson). jitter 0 = grid, 1 = full Poisson
function poissonDisk(width, height, radius, jitter, k = 25) {
  if (jitter < 0.04) {
    const samples = [];
    const step = radius;
    for (let y = step / 2; y < height; y += step) {
      for (let x = step / 2; x < width; x += step) {
        samples.push([x + (rand()-0.5)*step*0.05, y + (rand()-0.5)*step*0.05]);
      }
    }
    return samples;
  }
  const r = radius * (0.55 + 0.45 * jitter);
  const cell = r / Math.SQRT2;
  const cols = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const grid = new Int32Array(cols * rows).fill(-1);
  const samples = [];
  const active = [];
  function add(p) {
    samples.push(p);
    active.push(samples.length - 1);
    grid[Math.floor(p[1]/cell) * cols + Math.floor(p[0]/cell)] = samples.length - 1;
  }
  function ok(p) {
    if (p[0] < 0 || p[0] >= width || p[1] < 0 || p[1] >= height) return false;
    const ci = Math.floor(p[0]/cell), ri = Math.floor(p[1]/cell);
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const nr = ri+dr, nc = ci+dc;
        if (nr<0 || nr>=rows || nc<0 || nc>=cols) continue;
        const idx = grid[nr*cols + nc];
        if (idx >= 0) {
          const s = samples[idx];
          const dx = s[0]-p[0], dy = s[1]-p[1];
          if (dx*dx + dy*dy < r*r) return false;
        }
      }
    }
    return true;
  }
  add([rand()*width, rand()*height]);
  while (active.length) {
    const ai = Math.floor(rand() * active.length);
    const s = samples[active[ai]];
    let placed = false;
    for (let i = 0; i < k; i++) {
      const a = rand() * Math.PI * 2;
      const rr = r + rand() * r;
      const p = [s[0] + Math.cos(a)*rr, s[1] + Math.sin(a)*rr];
      if (ok(p)) { add(p); placed = true; break; }
    }
    if (!placed) active.splice(ai, 1);
  }
  return samples;
}

// Half-plane clipping for Voronoi (keep side closer to p)
function clipHalfPlane(poly, p, q) {
  const mx = (p[0]+q[0])/2, my = (p[1]+q[1])/2;
  const nx = q[0]-p[0],   ny = q[1]-p[1];
  const dist = (pt) => nx*(pt[0]-mx) + ny*(pt[1]-my);
  const inter = (a, b) => {
    const da = dist(a), db = dist(b);
    const t = da / (da - db);
    return [a[0] + t*(b[0]-a[0]), a[1] + t*(b[1]-a[1])];
  };
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i+1) % poly.length];
    const da = dist(a), db = dist(b);
    if (da <= 0) {
      out.push(a);
      if (db > 0) out.push(inter(a, b));
    } else if (db <= 0) {
      out.push(inter(a, b));
    }
  }
  return out;
}

// Compute Voronoi cells (O(n²) — fine for our scale)
function voronoiCells(seeds, bbox) {
  const cells = [];
  const baseRect = [
    [bbox[0], bbox[1]], [bbox[2], bbox[1]],
    [bbox[2], bbox[3]], [bbox[0], bbox[3]]
  ];
  for (let i = 0; i < seeds.length; i++) {
    let cell = baseRect.slice();
    for (let j = 0; j < seeds.length; j++) {
      if (i === j || cell.length === 0) continue;
      cell = clipHalfPlane(cell, seeds[i], seeds[j]);
    }
    cells.push(cell);
  }
  return cells;
}

function polyBbox(poly) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of poly) {
    if (x<minX) minX=x; if (x>maxX) maxX=x;
    if (y<minY) minY=y; if (y>maxY) maxY=y;
  }
  return [minX, minY, maxX, maxY];
}

function pointInPolygon(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    if (((yi > p[1]) !== (yj > p[1])) &&
        (p[0] < (xj - xi) * (p[1] - yi) / (yj - yi + 1e-12) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

// Sutherland-Hodgman polygon clipping
function shClip(subject, clip) {
  let output = subject;
  for (let i = 0; i < clip.length; i++) {
    if (output.length === 0) break;
    const a = clip[i];
    const b = clip[(i + 1) % clip.length];
    const input = output;
    output = [];
    const inside = (p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= 0;
    const inter = (p, q) => {
      const r = [b[0] - a[0], b[1] - a[1]];
      const s = [q[0] - p[0], q[1] - p[1]];
      const denom = r[0] * s[1] - r[1] * s[0];
      if (Math.abs(denom) < 1e-12) return p;
      const t = ((p[0] - a[0]) * s[1] - (p[1] - a[1]) * s[0]) / denom;
      return [a[0] + r[0] * t, a[1] + r[1] * t];
    };
    for (let j = 0; j < input.length; j++) {
      const p = input[j];
      const q = input[(j + 1) % input.length];
      const pIn = inside(p), qIn = inside(q);
      if (pIn) {
        if (qIn) output.push(q); else output.push(inter(p, q));
      } else if (qIn) {
        output.push(inter(p, q));
        output.push(q);
      }
    }
  }
  return output;
}

function pointToSegmentDist(p, a, b) {
  const ab = [b[0]-a[0], b[1]-a[1]];
  const ap = [p[0]-a[0], p[1]-a[1]];
  const len2 = ab[0]*ab[0] + ab[1]*ab[1];
  let t = (ap[0]*ab[0] + ap[1]*ab[1]) / Math.max(len2, 1e-12);
  t = Math.max(0, Math.min(1, t));
  const px = a[0] + ab[0]*t, py = a[1] + ab[1]*t;
  return { dist: Math.hypot(p[0]-px, p[1]-py), point: [px, py], t };
}

// ============================================================
// ALGORITHM 01 — VORONOI (BASIC)
// ============================================================
function algoVoronoi(p) {
  const radius = p.spacing * 3;
  const seeds = poissonDisk(W, H, radius, p.jitter);
  const cells = voronoiCells(seeds, [0, 0, W, H]);
  const segments = [];
  const seen = new Set();
  for (const cell of cells) {
    for (let i = 0; i < cell.length; i++) {
      const a = cell[i], b = cell[(i+1) % cell.length];
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

// ============================================================
// ALGORITHM 02 — RECURSIVE VORONOI
// ============================================================
function algoRecursive(p) {
  const segments = [];

  function recurse(parentPoly, depth) {
    if (depth <= 0) return;
    const minArea = 800;
    const bbox = polyBbox(parentPoly);
    const w = bbox[2]-bbox[0], h = bbox[3]-bbox[1];
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
        const a = clipped[i], b = clipped[(i+1) % clipped.length];
        const mid = [(a[0]+b[0])/2, (a[1]+b[1])/2];
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

  // outer rectangle (drawn as outermost frame implicitly — also becomes generation -1, drawn explicitly here)
  const outer = [[0,0],[W,0],[W,H],[0,H]];
  // outer border at generation 0 width
  segments.push({ a:[0,0], b:[W,0], rank: 0, width: p.baseWidth });
  segments.push({ a:[W,0], b:[W,H], rank: 0, width: p.baseWidth });
  segments.push({ a:[W,H], b:[0,H], rank: 0, width: p.baseWidth });
  segments.push({ a:[0,H], b:[0,0], rank: 0, width: p.baseWidth });

  recurse(outer, p.depth);
  return { segments };
}

function isOnParentBoundary(point, polygon, eps) {
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i+1) % polygon.length];
    if (pointToSegmentDist(point, a, b).dist < eps) return true;
  }
  return false;
}

// ============================================================
// ALGORITHM 03 — CRACK GROWTH (sequential T-junction)
// ============================================================
function algoGrowth(p) {
  const segments = [];
  const stepLen = 13;

  // spatial grid for collision detection
  const cellSize = Math.max(stepLen * 2, p.snapDist * 2.5);
  const cols = Math.ceil(W / cellSize);
  const rows = Math.ceil(H / cellSize);
  const grid = Array.from({ length: cols * rows }, () => []);

  function gridAdd(seg) {
    const minX = Math.max(0, Math.floor(Math.min(seg.a[0], seg.b[0])/cellSize) - 1);
    const maxX = Math.min(cols-1, Math.floor(Math.max(seg.a[0], seg.b[0])/cellSize) + 1);
    const minY = Math.max(0, Math.floor(Math.min(seg.a[1], seg.b[1])/cellSize) - 1);
    const maxY = Math.min(rows-1, Math.floor(Math.max(seg.a[1], seg.b[1])/cellSize) + 1);
    for (let r = minY; r <= maxY; r++) {
      for (let c = minX; c <= maxX; c++) grid[r*cols+c].push(seg);
    }
  }

  function findHit(target, ownerTipPos, maxDist) {
    const ci = Math.floor(target[0]/cellSize);
    const ri = Math.floor(target[1]/cellSize);
    let best = null, bestD = maxDist;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = ri+dr, nc = ci+dc;
        if (nr<0||nr>=rows||nc<0||nc>=cols) continue;
        for (const s of grid[nr*cols+nc]) {
          // skip own most-recent segment(s) from current tip
          const eps2 = 1.5;
          if ((Math.abs(s.a[0]-ownerTipPos[0]) < eps2 && Math.abs(s.a[1]-ownerTipPos[1]) < eps2) ||
              (Math.abs(s.b[0]-ownerTipPos[0]) < eps2 && Math.abs(s.b[1]-ownerTipPos[1]) < eps2)) continue;
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
    const x = 0.12*W + rand() * 0.76*W;
    const y = 0.12*H + rand() * 0.76*H;
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

      if (nx < 4 || nx > W-4 || ny < 4 || ny > H-4) {
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
        const branchA = t.a + sign * (Math.PI/2 + (rand()-0.5)*0.18);
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
      const segAngle = Math.atan2(src.b[1]-src.a[1], src.b[0]-src.a[0]);
      const branchA = segAngle + (rand() < 0.5 ? Math.PI/2 : -Math.PI/2) + (rand()-0.5)*0.25;
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

// ============================================================
// ALGORITHM 04 — CITY GRAMMAR (Parish-Müller simplified)
// ============================================================
function algoGrammar(p) {
  const segments = [];
  const cellSize = 50;
  const cols = Math.ceil(W / cellSize);
  const rows = Math.ceil(H / cellSize);
  const grid = Array.from({ length: cols * rows }, () => []);

  function gridAdd(seg) {
    const minX = Math.max(0, Math.floor(Math.min(seg.a[0], seg.b[0])/cellSize));
    const maxX = Math.min(cols-1, Math.floor(Math.max(seg.a[0], seg.b[0])/cellSize));
    const minY = Math.max(0, Math.floor(Math.min(seg.a[1], seg.b[1])/cellSize));
    const maxY = Math.min(rows-1, Math.floor(Math.max(seg.a[1], seg.b[1])/cellSize));
    for (let r = minY; r <= maxY; r++) {
      for (let c = minX; c <= maxX; c++) grid[r*cols+c].push(seg);
    }
  }
  function nearest(point, dist, excludeStart) {
    const ci = Math.floor(point[0]/cellSize);
    const ri = Math.floor(point[1]/cellSize);
    let best = null, bestD = dist;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = ri+dr, nc = ci+dc;
        if (nr<0||nr>=rows||nc<0||nc>=cols) continue;
        for (const s of grid[nr*cols+nc]) {
          if (excludeStart) {
            const eps = 1.5;
            if ((Math.abs(s.a[0]-excludeStart[0]) < eps && Math.abs(s.a[1]-excludeStart[1]) < eps) ||
                (Math.abs(s.b[0]-excludeStart[0]) < eps && Math.abs(s.b[1]-excludeStart[1]) < eps)) continue;
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
  const cx = W/2, cy = H/2;
  const longLen = Math.max(W, H);
  for (const dir of [0, Math.PI/2, Math.PI, -Math.PI/2]) {
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
        if (endX < 0) t = Math.min(t, (0 - seg.start[0]) / (dir[0]*seg.length));
        if (endX > W) t = Math.min(t, (W - seg.start[0]) / (dir[0]*seg.length));
      }
      if (Math.abs(dir[1]) > guard) {
        if (endY < 0) t = Math.min(t, (0 - seg.start[1]) / (dir[1]*seg.length));
        if (endY > H) t = Math.min(t, (H - seg.start[1]) / (dir[1]*seg.length));
      }
      if (t < 0.05) continue;
      endX = seg.start[0] + dir[0] * seg.length * t;
      endY = seg.start[1] + dir[1] * seg.length * t;
      seg.length = seg.length * t;
    }

    // T-snap to nearby existing segment
    const hit = nearest([endX, endY], snapDist, seg.start);
    if (hit) {
      const dStart = Math.hypot(seg.start[0]-hit.p[0], seg.start[1]-hit.p[1]);
      if (dStart > 8) { endX = hit.p[0]; endY = hit.p[1]; }
    }

    const newSeg = { a: seg.start, b: [endX, endY], rank: seg.rank };
    segments.push(newSeg);
    gridAdd(newSeg);

    // perpendicular branches at intervals
    const totalLen = Math.hypot(endX-seg.start[0], endY-seg.start[1]);
    const numGaps = Math.floor(totalLen / p.branchGap);
    for (let i = 1; i < numGaps; i++) {
      const tt = i / numGaps;
      const bx = seg.start[0] + (endX - seg.start[0]) * tt;
      const by = seg.start[1] + (endY - seg.start[1]) * tt;

      if (rand() < p.branchProb) {
        const a = seg.dir + Math.PI/2 + (rand()-0.5) * p.angleNoise;
        queue.push({
          start: [bx, by], dir: a,
          length: p.mainLength * Math.pow(p.lengthFactor, seg.rank),
          rank: seg.rank + 1
        });
      }
      if (rand() < p.branchProb) {
        const a = seg.dir - Math.PI/2 + (rand()-0.5) * p.angleNoise;
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

// ============================================================
// RENDERING
// ============================================================
function render(result) {
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');

  // paper background
  ctx.clearRect(0, 0, W, H);
  const grad = ctx.createRadialGradient(W*0.45, H*0.4, W*0.15, W*0.5, H*0.5, W*0.75);
  grad.addColorStop(0,    '#f3ead4');
  grad.addColorStop(0.65, '#ebe1c8');
  grad.addColorStop(1,    '#ddd0b1');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // sparse darker speckle (simulating fired clay)
  ctx.save();
  for (let i = 0; i < 320; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = Math.random() * 1.6;
    ctx.fillStyle = `rgba(60,42,20,${0.04 + Math.random()*0.06})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.restore();

  // segments — draw thicker first so thinner overlays on top
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const sorted = result.segments.slice().sort((a, b) => (b.width || 1) - (a.width || 1));
  for (const s of sorted) {
    ctx.lineWidth = s.width || 1.5;
    const alpha = 0.92 - 0.04 * (s.rank || 0);
    ctx.strokeStyle = `rgba(24, 18, 12, ${Math.max(0.55, alpha)})`;
    ctx.beginPath();
    ctx.moveTo(s.a[0], s.a[1]);
    ctx.lineTo(s.b[0], s.b[1]);
    ctx.stroke();
  }

  // tiny vermilion seal — bottom-right corner
  ctx.save();
  const sealSize = 56, pad = 36;
  ctx.fillStyle = 'rgba(173, 58, 34, 0.88)';
  ctx.fillRect(W - pad - sealSize, H - pad - sealSize, sealSize, sealSize);
  ctx.fillStyle = 'rgba(243, 234, 216, 0.95)';
  ctx.font = '600 30px "Noto Serif JP", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('譜', W - pad - sealSize/2, H - pad - sealSize/2 + 1);
  ctx.restore();
}

// ============================================================
// PARAM READERS
// ============================================================
function getParams(algo) {
  const v = (id) => parseFloat(document.getElementById(id).value);
  switch(algo) {
    case 'voronoi':
      return { spacing: v('v-spacing'), jitter: v('v-jitter'), stroke: v('v-stroke') };
    case 'recursive':
      return {
        depth: v('r-depth'),
        primarySeeds: v('r-primary'),
        subdivision: v('r-sub'),
        decay: v('r-decay'),
        baseWidth: v('r-base')
      };
    case 'growth':
      return {
        initial: v('g-init'),
        steps: v('g-steps'),
        branchProb: v('g-branch'),
        wiggle: v('g-wiggle'),
        snapDist: v('g-snap'),
        maxGen: v('g-maxgen')
      };
    case 'grammar':
      return {
        mainLength: v('cg-main'),
        branchGap: v('cg-gap'),
        branchProb: v('cg-prob'),
        maxRank: v('cg-rank'),
        lengthFactor: v('cg-decay'),
        angleNoise: v('cg-noise')
      };
  }
}

const descriptions = {
  voronoi: {
    title: 'Voronoi tessellation — the canonical baseline',
    body: 'ポアソン円板サンプリングで配置した種点の Voronoi 図を生成。各セル境界がそのまま道路になる。Y接合（120°）が支配的になる典型例で、本物の貫入や都市道路の T接合（90°）は再現されない。比較用ベースラインとして提示。jitter を 0 にすると六角格子に収束し、計画都市の格子に近づく。'
  },
  recursive: {
    title: 'Recursive Voronoi — temporal hierarchy through subdivision',
    body: '親セル境界＝主道路を生成後、各セル内部で再帰的に Voronoi を実行。世代ごとに線幅を減衰させ、幹線・地区道・路地の階層を表現。Bogatov ら（2025）の Algorithm A.2 に対応。通常 Voronoi より T接合ピークが現れやすく、貫入の階層構造に近づく。階層深さ depth を増やすと急速に密度が上がる。'
  },
  growth: {
    title: "Crack growth — sequential T-junction formation",
    body: "初期亀裂を seed として配置し、各先端が逐次伸長する。既存クラックに接近すると 90°回頭して T接合を強制形成。先端が全て消滅すると既存ネットワーク上に新規クラックが派生 (nucleation)。Iben & O'Brien（2009）の釉薬カップ・シミュレーションを単純化したもので、実際の貫入と最も近い角度分布を生む。Strano（2012）の道路網順次成長モデルと同型構造で、α パラメータが branch probability に対応する。steps を増やすと密度が上がる。"
  },
  grammar: {
    title: 'City grammar — Parish-Müller style L-system',
    body: '幹線から直角分岐を繰り返す古典的な都市生成。Parish & Müller（2001 SIGGRAPH）の簡易版。完全な T接合構造を持つが、画一的な格子模様になりやすく、有機都市や貫入の不規則性は再現しない。比較対照。angle noise を上げると有機都市寄りになる。'
  }
};

// ============================================================
// ORCHESTRATION
// ============================================================
let renderTimer = null;

function regenerate(reseed = false) {
  if (reseed) state.seed = Math.floor(Math.random() * 1e9);
  state.rng = mulberry32(state.seed);

  const t0 = performance.now();
  const params = getParams(state.algo);
  let result;
  switch (state.algo) {
    case 'voronoi':   result = algoVoronoi(params); break;
    case 'recursive': result = algoRecursive(params); break;
    case 'growth':    result = algoGrowth(params); break;
    case 'grammar':   result = algoGrammar(params); break;
  }
  render(result);
  const t1 = performance.now();

  document.getElementById('stat-segs').textContent = result.segments.length.toLocaleString();
  document.getElementById('stat-time').textContent = (t1 - t0).toFixed(0);
  document.getElementById('stat-seed').textContent = String(state.seed).padStart(6, '0').slice(-6);

  // junction count
  const verts = new Map();
  for (const s of result.segments) {
    const k1 = `${Math.round(s.a[0]/2)},${Math.round(s.a[1]/2)}`;
    const k2 = `${Math.round(s.b[0]/2)},${Math.round(s.b[1]/2)}`;
    verts.set(k1, (verts.get(k1) || 0) + 1);
    verts.set(k2, (verts.get(k2) || 0) + 1);
  }
  let jc = 0;
  for (const v of verts.values()) if (v >= 3) jc++;
  document.getElementById('stat-junc').textContent = jc.toLocaleString();

  const algoNum = { voronoi:'01', recursive:'02', growth:'03', grammar:'04' }[state.algo];
  document.getElementById('meta-algo').textContent = `${state.algo.toUpperCase()} · ${algoNum}`;

  const desc = descriptions[state.algo];
  document.getElementById('desc-title').textContent = desc.title;
  document.getElementById('desc-body').textContent = desc.body;
}

function debouncedRegen() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => regenerate(false), 90);
}

// ============================================================
// EVENT WIRING
// ============================================================

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    state.algo = tab.dataset.algo;
    document.querySelectorAll('.algo-controls').forEach(c => c.classList.remove('active'));
    document.querySelector(`.algo-controls[data-algo="${state.algo}"]`).classList.add('active');
    regenerate(false);
  });
});

document.querySelectorAll('input[type="range"]').forEach(input => {
  const valEl = document.getElementById(input.id + '-val');
  const update = () => {
    const v = parseFloat(input.value);
    const step = input.step || '1';
    let display;
    if (step.includes('.')) {
      const decimals = step.split('.')[1].length;
      display = v.toFixed(decimals);
    } else {
      display = String(Math.round(v));
    }
    if (valEl) valEl.textContent = display;
  };
  input.addEventListener('input', () => { update(); debouncedRegen(); });
  update();
});

document.getElementById('btn-regen').addEventListener('click', () => regenerate(true));

document.getElementById('btn-save').addEventListener('click', () => {
  const canvas = document.getElementById('canvas');
  const link = document.createElement('a');
  link.download = `crackle_${state.algo}_${state.seed}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
});

// initial render
regenerate(true);
