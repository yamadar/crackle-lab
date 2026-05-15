// ============================================================
// GEOMETRY UTILITIES — pure functions, no DOM
// ============================================================

// Poisson disk sampling (Bridson). jitter 0 = grid, 1 = full Poisson.
// `rand` is a () => [0,1) function so sampling is deterministic per seed.
export function poissonDisk(width, height, radius, jitter, rand, k = 25) {
  if (jitter < 0.04) {
    const samples = [];
    const step = radius;
    for (let y = step / 2; y < height; y += step) {
      for (let x = step / 2; x < width; x += step) {
        samples.push([x + (rand() - 0.5) * step * 0.05, y + (rand() - 0.5) * step * 0.05]);
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
    grid[Math.floor(p[1] / cell) * cols + Math.floor(p[0] / cell)] = samples.length - 1;
  }
  function ok(p) {
    if (p[0] < 0 || p[0] >= width || p[1] < 0 || p[1] >= height) return false;
    const ci = Math.floor(p[0] / cell), ri = Math.floor(p[1] / cell);
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const nr = ri + dr, nc = ci + dc;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        const idx = grid[nr * cols + nc];
        if (idx >= 0) {
          const s = samples[idx];
          const dx = s[0] - p[0], dy = s[1] - p[1];
          if (dx * dx + dy * dy < r * r) return false;
        }
      }
    }
    return true;
  }
  add([rand() * width, rand() * height]);
  while (active.length) {
    const ai = Math.floor(rand() * active.length);
    const s = samples[active[ai]];
    let placed = false;
    for (let i = 0; i < k; i++) {
      const a = rand() * Math.PI * 2;
      const rr = r + rand() * r;
      const p = [s[0] + Math.cos(a) * rr, s[1] + Math.sin(a) * rr];
      if (ok(p)) { add(p); placed = true; break; }
    }
    if (!placed) active.splice(ai, 1);
  }
  return samples;
}

// Half-plane clipping for Voronoi (keep side closer to p).
export function clipHalfPlane(poly, p, q) {
  const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
  const nx = q[0] - p[0], ny = q[1] - p[1];
  const dist = (pt) => nx * (pt[0] - mx) + ny * (pt[1] - my);
  const inter = (a, b) => {
    const da = dist(a), db = dist(b);
    const t = da / (da - db);
    return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
  };
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
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

// Compute Voronoi cells (O(n²) — fine for our scale).
export function voronoiCells(seeds, bbox) {
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

// Axis-aligned bounding box of a polygon: [minX, minY, maxX, maxY].
export function polyBbox(poly) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of poly) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

// Ray-casting point-in-polygon test.
export function pointInPolygon(p, poly) {
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

// Sutherland-Hodgman polygon clipping (subject clipped against convex clip).
export function shClip(subject, clip) {
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

// Distance from point p to segment a-b, plus the closest point and param t.
export function pointToSegmentDist(p, a, b) {
  const ab = [b[0] - a[0], b[1] - a[1]];
  const ap = [p[0] - a[0], p[1] - a[1]];
  const len2 = ab[0] * ab[0] + ab[1] * ab[1];
  let t = (ap[0] * ab[0] + ap[1] * ab[1]) / Math.max(len2, 1e-12);
  t = Math.max(0, Math.min(1, t));
  const px = a[0] + ab[0] * t, py = a[1] + ab[1] * t;
  return { dist: Math.hypot(p[0] - px, p[1] - py), point: [px, py], t };
}

// True if `point` lies within `eps` of any edge of `polygon`.
export function isOnParentBoundary(point, polygon, eps) {
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    if (pointToSegmentDist(point, a, b).dist < eps) return true;
  }
  return false;
}
