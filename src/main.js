import './style.css';
import { descriptions, algoNumbers } from './config.js';
import { mulberry32 } from './rng.js';
import { algorithms } from './algorithms/index.js';
import { getParams } from './params.js';
import { render, countJunctions } from './render.js';
import { wireUI } from './ui.js';

// ============================================================
// STATE
// ============================================================
const state = {
  algo: 'voronoi',
  seed: Math.floor(Math.random() * 1e9),
};

// ============================================================
// ORCHESTRATION
// ============================================================
let renderTimer = null;

function regenerate(reseed = false) {
  if (reseed) state.seed = Math.floor(Math.random() * 1e9);
  const rand = mulberry32(state.seed);

  const t0 = performance.now();
  const params = getParams(state.algo);
  const result = algorithms[state.algo](params, rand);
  render(document.getElementById('canvas'), result);
  const t1 = performance.now();

  document.getElementById('stat-segs').textContent = result.segments.length.toLocaleString();
  document.getElementById('stat-time').textContent = (t1 - t0).toFixed(0);
  document.getElementById('stat-seed').textContent = String(state.seed).padStart(6, '0').slice(-6);
  document.getElementById('stat-junc').textContent = countJunctions(result.segments).toLocaleString();

  document.getElementById('meta-algo').textContent =
    `${state.algo.toUpperCase()} · ${algoNumbers[state.algo]}`;

  const desc = descriptions[state.algo];
  document.getElementById('desc-title').textContent = desc.title;
  document.getElementById('desc-body').textContent = desc.body;
}

function debouncedRegen() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => regenerate(false), 90);
}

// ============================================================
// BOOT
// ============================================================
wireUI({
  setAlgo: (algo) => { state.algo = algo; },
  regenerate,
  debouncedRegen,
  getState: () => state,
});

// initial render
regenerate(true);
