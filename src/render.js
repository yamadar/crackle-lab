// ============================================================
// RENDERING — canvas drawing; only imported by main.js
// ============================================================
import { W, H } from './config.js';

// Draws a generated result onto the given canvas element.
export function render(canvas, result) {
  const ctx = canvas.getContext('2d');

  // paper background
  ctx.clearRect(0, 0, W, H);
  const grad = ctx.createRadialGradient(W * 0.45, H * 0.4, W * 0.15, W * 0.5, H * 0.5, W * 0.75);
  grad.addColorStop(0, '#f3ead4');
  grad.addColorStop(0.65, '#ebe1c8');
  grad.addColorStop(1, '#ddd0b1');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // sparse darker speckle (simulating fired clay)
  ctx.save();
  for (let i = 0; i < 320; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = Math.random() * 1.6;
    ctx.fillStyle = `rgba(60,42,20,${0.04 + Math.random() * 0.06})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
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
  ctx.fillText('譜', W - pad - sealSize / 2, H - pad - sealSize / 2 + 1);
  ctx.restore();
}

// Counts junctions (vertices shared by >= 3 segment endpoints).
export function countJunctions(segments) {
  const verts = new Map();
  for (const s of segments) {
    const k1 = `${Math.round(s.a[0] / 2)},${Math.round(s.a[1] / 2)}`;
    const k2 = `${Math.round(s.b[0] / 2)},${Math.round(s.b[1] / 2)}`;
    verts.set(k1, (verts.get(k1) || 0) + 1);
    verts.set(k2, (verts.get(k2) || 0) + 1);
  }
  let jc = 0;
  for (const v of verts.values()) if (v >= 3) jc++;
  return jc;
}
