/**
 * Transition — fade/iris/swirl entre cenas + toast de avisos.
 * Efeitos com easing suave; íris fecha/abre em círculo (portas de casa).
 * @module ui/Transition
 */

const el = () => document.getElementById('transition');
const EASE = 'cubic-bezier(.45,.05,.25,1)';

/** Raio máximo p/ cobrir a tela a partir de (cx,cy) em px. */
function maxR(w, h, cx, cy) {
  return Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy));
}

/** Íris dirigida por rAF (fecha: r max→0 · abre: 0→max). Resolve ao concluir. */
function irisTo(close, ms, fx = 0.5, fy = 0.55) {
  return new Promise((res) => {
    const t = el();
    t.className = '';
    t.style.transition = 'none';
    t.style.opacity = '1';
    t.style.pointerEvents = 'all';
    const w = t.clientWidth || 1280, h = t.clientHeight || 720;
    const cx = fx * w, cy = fy * h;
    const R = maxR(w, h, cx, cy);
    const t0 = performance.now();
    const ease = (u) => u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
    const step = (now) => {
      const u = Math.min(1, (now - t0) / ms);
      const r = (close ? 1 - ease(u) : ease(u)) * R;
      t.style.background = `radial-gradient(circle at ${fx * 100}% ${fy * 100}%, transparent ${Math.max(0, r - 2)}px, #000 ${r}px)`;
      if (u < 1) requestAnimationFrame(step);
      else res();
    };
    requestAnimationFrame(step);
  });
}

export const Transition = {
  /** @param {number} [ms=250] */
  fadeOut(ms = 250) {
    return new Promise((res) => {
      const t = el();
      t.className = '';
      t.style.background = '#000';
      t.style.transition = `opacity ${ms}ms ${EASE}`;
      t.style.opacity = '1';
      t.style.pointerEvents = 'all';
      setTimeout(res, ms + 30);
    });
  },
  /** @param {number} [ms=250] */
  fadeIn(ms = 250) {
    return new Promise((res) => {
      const t = el();
      t.style.transition = `opacity ${ms}ms ${EASE}`;
      t.style.opacity = '0';
      setTimeout(() => {
        t.style.pointerEvents = 'none'; t.className = '';
        t.style.background = '#000';
        res();
      }, ms + 30);
    });
  },
  /** Íris fechando (p/ entrar em portas). fx/fy = centro 0..1. @param {number} [ms=420] */
  irisOut(ms = 420, fx = 0.5, fy = 0.55) { return irisTo(true, ms, fx, fy); },
  /** Íris abrindo (ao sair de portas). @param {number} [ms=420] */
  irisIn(ms = 420, fx = 0.5, fy = 0.55) {
    return irisTo(false, ms, fx, fy).then(() => new Promise((res) => {
      const t = el();
      // a íris terminou aberta (fundo transparente no centro): some o véu
      t.style.transition = `opacity 260ms ${EASE}`;
      t.style.opacity = '0';
      setTimeout(() => {
        t.style.pointerEvents = 'none';
        t.style.background = '#000';
        res();
      }, 290);
    }));
  },
  /** Efeito de encontro: flash espiral. @param {number} [ms=600] */
  async swirl(ms = 600) {
    const t = el();
    t.className = 'swirl';
    t.style.transition = `opacity 120ms ${EASE}`;
    t.style.opacity = '1';
    await new Promise((r) => setTimeout(r, ms));
    t.style.opacity = '0';
    await new Promise((r) => setTimeout(r, 150));
    t.className = '';
  },
  flash() {
    const t = el();
    t.className = 'flash';
    t.style.transition = `opacity 300ms ${EASE}`;
    t.style.opacity = '0.9';
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => (t.className = ''), 320); }, 90);
  },
};

let toastTimer = null;
/** @param {string} msg @param {number} [ms=2200] */
export function toast(msg, ms = 2200) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
}
