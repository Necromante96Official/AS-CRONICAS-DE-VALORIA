/**
 * Transition — fade/flash/swirl entre cenas + toast de avisos.
 * @module ui/Transition
 */

const el = () => document.getElementById('transition');

export const Transition = {
  /** @param {number} [ms=250] */
  fadeOut(ms = 250) {
    return new Promise((res) => {
      const t = el();
      t.className = '';
      t.style.transitionDuration = `${ms}ms`;
      t.style.opacity = '1';
      t.style.pointerEvents = 'all';
      setTimeout(res, ms + 30);
    });
  },
  /** @param {number} [ms=250] */
  fadeIn(ms = 250) {
    return new Promise((res) => {
      const t = el();
      t.style.transitionDuration = `${ms}ms`;
      t.style.opacity = '0';
      setTimeout(() => { t.style.pointerEvents = 'none'; t.className = ''; res(); }, ms + 30);
    });
  },
  /** Efeito de encontro: flash espiral. @param {number} [ms=600] */
  async swirl(ms = 600) {
    const t = el();
    t.className = 'swirl';
    t.style.transitionDuration = '120ms';
    t.style.opacity = '1';
    await new Promise((r) => setTimeout(r, ms));
    t.style.opacity = '0';
    await new Promise((r) => setTimeout(r, 150));
    t.className = '';
  },
  flash() {
    const t = el();
    t.className = 'flash';
    t.style.opacity = '0.9';
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => (t.className = ''), 300); }, 90);
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
