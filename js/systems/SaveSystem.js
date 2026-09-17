/**
 * SaveSystem — 3 slots em localStorage (posição, party, inventário, flags).
 * @module systems/SaveSystem
 */
const KEY = (slot) => `valoria_save_${slot}`;

/** @param {number} sec */
function fmtPlay(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  const p = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${p(m)}h` : `${m}min`;
}

export const SaveSystem = {
  slots: [1, 2, 3],

  /** @param {number} slot @param {any} state */
  save(slot, state) {
    try {
      localStorage.setItem(KEY(slot), JSON.stringify({ ...state, savedAt: Date.now() }));
      return true;
    } catch { return false; }
  },

  /** @param {number} slot @returns {any|null} */
  load(slot) {
    try {
      const raw = localStorage.getItem(KEY(slot));
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  /** @param {number} slot */
  erase(slot) { localStorage.removeItem(KEY(slot)); },

  /** @param {number} slot */
  info(slot) {
    try {
      const d = this.load(slot);
      if (!d || !d.party || !d.party[0]) return null;
      const when = new Date(d.savedAt || Date.now()).toLocaleString('pt-BR');
      const lv = d.party[0].level ?? 1;
      const t = d.playSec != null ? ` · ${fmtPlay(d.playSec)}` : '';
      return `Nv ${lv} · ${d.gold ?? 0}G${t} · ${when}`;
    } catch { return null; }
  },

  hasAny() { return this.slots.some((s) => this.load(s)); },
};
