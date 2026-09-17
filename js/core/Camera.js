/**
 * Camera — segue o jogador com clamp nos limites do mapa + screen shake.
 * @module core/Camera
 */
import { TILE, VIEW_W, VIEW_H, MAP_W, MAP_H } from './Config.js';

export class Camera {
  constructor() {
    this.x = 0; this.y = 0;
    this.shakeT = 0; this.shakeMag = 0;
  }

  /** @param {number} px @param {number} py @param {number} dt */
  follow(px, py, dt) {
    const tx = px - VIEW_W / 2;
    const ty = py - VIEW_H / 2;
    const k = Math.min(1, dt * 6);
    this.x += (tx - this.x) * k;
    this.y += (ty - this.y) * k;
    this.x = Math.max(0, Math.min(this.x, MAP_W * TILE - VIEW_W));
    this.y = Math.max(0, Math.min(this.y, MAP_H * TILE - VIEW_H));
  }

  snap(px, py) {
    this.x = Math.max(0, Math.min(px - VIEW_W / 2, MAP_W * TILE - VIEW_W));
    this.y = Math.max(0, Math.min(py - VIEW_H / 2, MAP_H * TILE - VIEW_H));
  }

  /** @param {number} mag @param {number} dur */
  shake(mag = 6, dur = 0.3) { this.shakeMag = mag; this.shakeT = dur; }

  /** @param {number} dt */
  update(dt) { if (this.shakeT > 0) this.shakeT -= dt; }

  get ox() {
    if (this.shakeT <= 0) return -Math.round(this.x);
    return -Math.round(this.x) + Math.round((Math.random() - 0.5) * 2 * this.shakeMag * this.shakeT);
  }
  get oy() {
    if (this.shakeT <= 0) return -Math.round(this.y);
    return -Math.round(this.y) + Math.round((Math.random() - 0.5) * 2 * this.shakeMag * this.shakeT);
  }
}
