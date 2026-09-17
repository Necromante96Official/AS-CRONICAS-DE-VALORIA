/**
 * NPCs — personagens não-jogáveis com diálogo e patrulha leve.
 * @module world/NPCs
 */
import { TILE } from '../core/Config.js';

export class NPC {
  /** @param {any} def */
  constructor(def) {
    this.id = def.id;
    this.name = def.name;
    this.kind = def.kind || 'villager';
    this.x = def.x * TILE + 4;
    this.y = def.y * TILE;
    this.homeX = this.x; this.homeY = this.y;
    this.dir = 'down';
    this.lines = def.lines || ['...'];
    this.lineIdx = 0;
    this.wander = !!def.wander;
    this.shop = !!def.shop;
    this.inn = !!def.inn;
    this.gift = def.gift || null;
    this.giftGiven = false;
    this.wt = Math.random() * 2; // timer de patrulha
    this.moving = false; // deslizando até o tile vizinho?
    this.tx = this.x; this.ty = this.y; // destino em px
    this.animT = 0; // alimenta os frames de passo
    this.spd = 45 + Math.random() * 20; // cada um anda no seu ritmo
  }

  /** @param {number} dt @param {import('./TileMap.js').TileMap} map */
  update(dt, map) {
    if (!this.wander) { this.moving = false; return; }
    // desliza até o destino (em vez de teleportar)
    if (this.moving) {
      const spd = this.spd * dt;
      const dx = this.tx - this.x, dy = this.ty - this.y;
      const d = Math.hypot(dx, dy);
      if (d <= spd) {
        this.x = this.tx; this.y = this.ty;
        this.moving = false; this.animT = 0;
      } else {
        this.x += (dx / d) * spd;
        this.y += (dy / d) * spd;
        this.animT += dt;
      }
      return;
    }
    this.wt -= dt;
    if (this.wt <= 0) {
      this.wt = 2 + Math.random() * 3;
      const dirs = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
      const [dx, dy] = dirs[Math.floor(Math.random() * dirs.length)];
      const nx = this.x + dx * TILE, ny = this.y + dy * TILE;
      const distHome = Math.hypot(nx - this.homeX, ny - this.homeY);
      if (distHome < TILE * 2.5 && !map.collides(nx + 2, ny + 6, 20, 14)) {
        if (dx !== 0 || dy !== 0) {
          this.tx = nx; this.ty = ny;
          this.moving = true; this.animT = 0.01;
        }
        if (dx > 0) this.dir = 'right'; else if (dx < 0) this.dir = 'left';
        else if (dy > 0) this.dir = 'down'; else if (dy < 0) this.dir = 'up';
      }
    }
  }

  /** Próxima linha de diálogo (rotaciona). */
  nextLine() {
    const l = this.lines[this.lineIdx % this.lines.length];
    this.lineIdx++;
    return l;
  }
}
