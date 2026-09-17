/**
 * Settings — preferências persistentes (mudo + velocidade do texto).
 * @module systems/Settings
 */
const CFG_KEY = 'valoria_cfg';

/** Multiplicadores da velocidade do typewriter. */
export const SPEEDS = { lento: 0.55, normal: 1, rapido: 1.9 };
export const SPEED_ORDER = ['lento', 'normal', 'rapido'];

/** @returns {{mute:boolean, speed:string}} */
export function loadSettings() {
  try {
    const raw = localStorage.getItem(CFG_KEY);
    if (raw) return { mute: false, speed: 'normal', ...JSON.parse(raw) };
  } catch { /* armazenamento indisponível */ }
  return { mute: false, speed: 'normal' };
}

/** @param {{mute:boolean, speed:string}} s */
export function saveSettings(s) {
  try { localStorage.setItem(CFG_KEY, JSON.stringify(s)); } catch { /* ignora */ }
}
