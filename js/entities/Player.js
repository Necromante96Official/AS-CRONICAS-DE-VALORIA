/**
 * Player — movimento topdown em pixel com colisão + passos p/ encontros.
 * @module entities/Player
 */
import { TILE, PLAYER_SPEED, MAP_W, MAP_H } from '../core/Config.js';

export class Player {
  /** @param {number} tx @param {number} ty */
  constructor(tx, ty) {
    this.x = tx * TILE + 4;
    this.y = ty * TILE;
    this.w = 24; this.h = 20;
    this.dir = 'down';
    this.moving = false;
    this.animT = 0;
    this.stepAcc = 0; // acumulador de passos (encontros)
    this.slideX = 0; this.slideY = 0; // velocidade residual p/ parada suave
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  get tileX() { return Math.floor(this.cx / TILE); }
  get tileY() { return Math.floor(this.cy / TILE); }

  /** @param {{x:number,y:number}} axis @param {number} dt @param {import('../world/TileMap.js').TileMap} map @param {Array<{x:number,y:number}>} blockers @param {boolean} [run] */
  update(axis, dt, map, blockers = [], run = false) {
    this.moving = false;
    this.running = !!run && (axis.x !== 0 || axis.y !== 0);
    const spd = PLAYER_SPEED * (this.running ? 1.65 : 1);
    let dx = 0, dy = 0;
    if (axis.x !== 0 && axis.y !== 0) {
      // prioriza o eixo dominante (movimento clássico de JRPG)
      if (Math.abs(axis.x) >= Math.abs(axis.y)) axis = { x: axis.x, y: 0 };
      else axis = { x: 0, y: axis.y };
    }
    if (axis.x > 0) { dx = 1; this.dir = 'right'; }
    else if (axis.x < 0) { dx = -1; this.dir = 'left'; }
    else if (axis.y > 0) { dy = 1; this.dir = 'down'; }
    else if (axis.y < 0) { dy = -1; this.dir = 'up'; }

    if (dx !== 0 || dy !== 0) {
      // saída instantânea (resposta imediata); guarda a direção p/ deslizar ao soltar
      this.slideX = dx * spd; this.slideY = dy * spd;
      const nx = this.x + dx * spd * dt;
      if (!map.collides(nx, this.y, this.w, this.h) && !this._hitsBlockers(nx, this.y, blockers)) {
        this.x = nx; this.moving = true;
      }
      const ny = this.y + dy * spd * dt;
      if (!map.collides(this.x, ny, this.w, this.h) && !this._hitsBlockers(this.x, ny, blockers)) {
        this.y = ny; this.moving = true;
      }
      if (this.moving) {
        this.animT += dt;
        this.stepAcc += Math.hypot(dx, dy) * spd * dt;
      }
    } else if (Math.hypot(this.slideX, this.slideY) > 12) {
      // parada suave: desliza decaying (sem atravessar parede)
      const k = Math.max(0, 1 - 14 * dt);
      const sx = this.slideX * k * dt, sy = this.slideY * k * dt;
      this.slideX *= k; this.slideY *= k;
      if (!map.collides(this.x + sx, this.y, this.w, this.h) && !this._hitsBlockers(this.x + sx, this.y, blockers)) this.x += sx;
      if (!map.collides(this.x, this.y + sy, this.w, this.h) && !this._hitsBlockers(this.x, this.y + sy, blockers)) this.y += sy;
      this.moving = true;
      this.animT += dt;
      this.stepAcc += Math.hypot(sx, sy);
    } else {
      this.slideX = 0; this.slideY = 0;
      this.animT = 0;
    }
    // mantém dentro do mapa (usa as dimensões do mapa atual)
    const mw = (map.w || MAP_W) * TILE, mh = (map.h || MAP_H) * TILE;
    this.x = Math.max(TILE, Math.min(this.x, mw - TILE - this.w));
    this.y = Math.max(TILE, Math.min(this.y, mh - TILE - this.h));
  }

  _hitsBlockers(px, py, blockers) {
    for (const b of blockers) {
      if (px < b.x + 22 && px + this.w > b.x + 2 && py < b.y + 26 && py + this.h > b.y + 8) return true;
    }
    return false;
  }

  /** Consome passos acumulados (1 passo = 1 tile). @returns {number} passos completos */
  consumeSteps() {
    const steps = Math.floor(this.stepAcc / TILE);
    this.stepAcc -= steps * TILE;
    return steps;
  }

  /** Tile à frente (para falar com NPCs). */
  facingTile() {
    const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[this.dir];
    return { x: this.tileX + d[0], y: this.tileY + d[1] };
  }
}
