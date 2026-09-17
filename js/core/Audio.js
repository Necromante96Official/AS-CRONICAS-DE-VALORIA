/**
 * Audio — música chiptune procedural + SFX via WebAudio (sem arquivos externos).
 * @module core/Audio
 */
import { loadSettings, saveSettings } from '../systems/Settings.js';

export class AudioMan {
  constructor() {
    /** @type {AudioContext|null} */
    this.ctx = null;
    this.musicTimer = null;
    this.step = 0;
    this.currentTrack = '';
    this.muted = !!loadSettings().mute;
  }

  /** Cria o contexto (chamar após gesto do usuário). */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    try { saveSettings({ ...loadSettings(), mute: this.muted }); } catch { /* ignora */ }
    if (this.muted) this.stopMusic();
    return this.muted;
  }

  /** @param {number} freq @param {number} dur @param {OscillatorType} [type] @param {number} [vol] @param {number} [when] */
  tone(freq, dur, type = 'square', vol = 0.06, when = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }

  /** @param {Record<string, number[]>} tracks */
  playMusic(name) {
    if (!this.ctx) return; // Engine tenta de novo no próximo frame
    if (this.currentTrack === name) return;
    this.stopMusic();
    this.currentTrack = name;
    const tracks = {
      // [notas por passo] — 0 = pausa. Frequências em Hz.
      field: [523, 0, 659, 0, 784, 0, 659, 0, 880, 0, 784, 659, 523, 0, 392, 0],
      town: [392, 523, 587, 523, 659, 0, 587, 0, 523, 587, 659, 0, 523, 0, 392, 0],
      dungeon: [110, 0, 110, 130, 0, 98, 0, 110, 0, 87, 0, 98, 110, 0, 0, 0],
      battle: [440, 440, 0, 440, 523, 0, 440, 0, 349, 349, 0, 349, 392, 0, 440, 0],
      boss: [220, 0, 233, 0, 220, 0, 174, 0, 220, 0, 233, 261, 0, 247, 233, 0],
      victory: [523, 659, 784, 1047, 784, 1047, 0, 0],
    };
    const seq = tracks[name] || tracks.field;
    const tempo = name === 'battle' || name === 'boss' ? 150 : 220;
    this.step = 0;
    this.musicTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const f = seq[this.step % seq.length];
      if (f) this.tone(f, 0.18, 'square', 0.035);
      // baixo de acompanhamento
      if (this.step % 2 === 0 && f) this.tone(f / 4, 0.3, 'triangle', 0.05);
      this.step++;
    }, tempo);
  }

  stopMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.currentTrack = '';
  }

  /** Efeitos curtos. @param {string} name */
  sfx(name) {
    if (!this.ctx || this.muted) return;
    const T = (f, d, t = 'square', v = 0.07, w = 0) => this.tone(f, d, t, v, w);
    switch (name) {
      case 'cursor': T(880, 0.05); break;
      case 'confirm': T(660, 0.06); T(990, 0.08, 'square', 0.07, 0.06); break;
      case 'cancel': T(440, 0.06); T(330, 0.09, 'square', 0.07, 0.06); break;
      case 'hit': T(180, 0.12, 'sawtooth', 0.1); T(90, 0.15, 'square', 0.08, 0.02); break;
      case 'crit': T(140, 0.2, 'sawtooth', 0.12); T(70, 0.25, 'square', 0.1, 0.03); break;
      case 'heal': T(523, 0.1, 'sine', 0.09); T(659, 0.1, 'sine', 0.09, 0.1); T(784, 0.16, 'sine', 0.09, 0.2); break;
      case 'fire': T(300, 0.25, 'sawtooth', 0.08); T(600, 0.2, 'square', 0.05, 0.08); break;
      case 'die': T(400, 0.4, 'sawtooth', 0.09); T(200, 0.4, 'sawtooth', 0.09, 0.12); T(100, 0.5, 'sawtooth', 0.09, 0.24); break;
      case 'encounter': T(196, 0.12, 'square', 0.1); T(196, 0.12, 'square', 0.1, 0.14); T(392, 0.3, 'square', 0.1, 0.28); break;
      case 'victory': [523, 659, 784, 1047].forEach((f, i) => T(f, 0.18, 'square', 0.08, i * 0.16)); break;
      case 'levelup': [392, 523, 659, 784, 1047, 1319].forEach((f, i) => T(f, 0.12, 'square', 0.08, i * 0.09)); break;
      case 'item': T(1047, 0.08, 'sine', 0.09); T(1319, 0.14, 'sine', 0.09, 0.08); break;
      case 'door': T(220, 0.15, 'triangle', 0.1); T(330, 0.2, 'triangle', 0.1, 0.12); break;
      case 'talk': T(700, 0.04, 'square', 0.05); break;
      case 'run': T(500, 0.07); T(750, 0.07, 'square', 0.07, 0.07); T(1000, 0.1, 'square', 0.07, 0.14); break;
      case 'step': T(190 + Math.random() * 40, 0.04, 'triangle', 0.025); break;
      case 'bump': T(120, 0.07, 'square', 0.04); break;
      case 'flee-fail': T(300, 0.15, 'square', 0.08); T(250, 0.2, 'square', 0.08, 0.12); break;
    }
  }
}
