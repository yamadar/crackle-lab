// ============================================================
// PARAM READERS — reads UI control values for an algorithm
// ============================================================

// Maps an algo id to the list of { key, id } pairs that compose its params.
export const paramSpecs = {
  voronoi: [
    { key: 'spacing', id: 'v-spacing' },
    { key: 'jitter', id: 'v-jitter' },
    { key: 'stroke', id: 'v-stroke' },
  ],
  recursive: [
    { key: 'depth', id: 'r-depth' },
    { key: 'primarySeeds', id: 'r-primary' },
    { key: 'subdivision', id: 'r-sub' },
    { key: 'decay', id: 'r-decay' },
    { key: 'baseWidth', id: 'r-base' },
  ],
  growth: [
    { key: 'initial', id: 'g-init' },
    { key: 'steps', id: 'g-steps' },
    { key: 'branchProb', id: 'g-branch' },
    { key: 'wiggle', id: 'g-wiggle' },
    { key: 'snapDist', id: 'g-snap' },
    { key: 'maxGen', id: 'g-maxgen' },
  ],
  grammar: [
    { key: 'mainLength', id: 'cg-main' },
    { key: 'branchGap', id: 'cg-gap' },
    { key: 'branchProb', id: 'cg-prob' },
    { key: 'maxRank', id: 'cg-rank' },
    { key: 'lengthFactor', id: 'cg-decay' },
    { key: 'angleNoise', id: 'cg-noise' },
  ],
};

// Reads the current slider values for `algo` from the DOM into a params object.
export function getParams(algo) {
  const v = (id) => parseFloat(document.getElementById(id).value);
  const params = {};
  for (const { key, id } of paramSpecs[algo]) params[key] = v(id);
  return params;
}
