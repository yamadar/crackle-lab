// ============================================================
// UI WIRING — event listeners; only imported by main.js
// ============================================================

// Wires tab clicks, slider inputs, and the regen/save buttons.
// `handlers` provides: setAlgo, regenerate, debouncedRegen, getState.
export function wireUI(handlers) {
  const { setAlgo, regenerate, debouncedRegen, getState } = handlers;

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      setAlgo(tab.dataset.algo);
      document.querySelectorAll('.algo-controls').forEach(c => c.classList.remove('active'));
      document.querySelector(`.algo-controls[data-algo="${tab.dataset.algo}"]`).classList.add('active');
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

  document.querySelectorAll('.section-toggle').forEach(h3 => {
    h3.setAttribute('role', 'button');
    h3.setAttribute('tabindex', '0');
    h3.setAttribute('aria-expanded', 'true');
    const toggle = () => {
      const collapsed = h3.parentElement.classList.toggle('collapsed');
      h3.setAttribute('aria-expanded', String(!collapsed));
    };
    h3.addEventListener('click', toggle);
    h3.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
  });

  document.getElementById('btn-regen').addEventListener('click', () => regenerate(true));

  document.getElementById('btn-save').addEventListener('click', () => {
    const canvas = document.getElementById('canvas');
    const state = getState();
    const link = document.createElement('a');
    link.download = `crackle_${state.algo}_${state.seed}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  });
}
