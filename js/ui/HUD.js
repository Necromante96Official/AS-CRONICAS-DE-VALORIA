/**
 * HUD — barra de status do grupo (retrato + barras) + local + ouro.
 * @module ui/HUD
 */
import { LOCATIONS, VIEW_W, VIEW_H, TILE } from '../core/Config.js';
import { ic } from './ItemIcons.js';

export class HUD {
  constructor() {
    this.el = document.getElementById('hud');
    this.partyEl = document.getElementById('hud-party');
    this.locEl = document.getElementById('hud-location');
    this.goldEl = document.getElementById('hud-gold');
    this.mm = document.getElementById('minimap');
  }

  show() { this.el.classList.remove('hidden'); }
  hide() { this.el.classList.add('hidden'); }

  /**
   * @param {import('../entities/Party.js').Hero[]} party
   * @param {number} gold
   * @param {string} region
   * @param {Record<string,string>} [faces] dataURLs dos retratos por sprite
   * @param {boolean} [muted]
   * @param {string} [clock] ícone/hora do dia (ex. "☀️ manhã")
   */
  render(party, gold, region, faces = {}, muted = false, clock = '') {
    this.partyEl.innerHTML = party.map((h) => {
      const hpPct = Math.max(0, (100 * h.hp / h.maxHp)).toFixed(0);
      const mpPct = Math.max(0, (100 * h.mp / h.maxMp)).toFixed(0);
      const low = h.hp > 0 && h.hp < h.maxHp * 0.3;
      return `
      <div class="hud-card">
        ${faces[h.sprite] ? `<img class="hud-face" src="${faces[h.sprite]}" alt="" />` : ''}
        <div class="hud-info">
          <span class="nm">${h.hp <= 0 ? '✝ ' : ''}${h.name}</span><span class="lv">Nv${h.level} ${h.cls}${(h.sp || 0) > 0 ? ` <span class="sp" title="Pontos de skill (Q > Skills)">✦${h.sp}</span>` : ''}</span>
          <div class="bar hp ${low ? 'low' : ''}"><div style="width:${hpPct}%"></div><span>${Math.max(0, Math.ceil(h.hp))}/${h.maxHp}</span></div>
          <div class="bar mp"><div style="width:${mpPct}%"></div><span>${Math.max(0, Math.ceil(h.mp))}/${h.maxMp}</span></div>
        </div>
      </div>`;
    }).join('');
    this.locEl.textContent = `${LOCATIONS[region] || region}${clock ? ` ${clock}` : ''}`;
    this.goldEl.innerHTML = `${ic(muted ? 'mute' : 'gold', 20)}<span>${gold} G</span>`;
  }

  /**
   * Minimapa: base pré-renderizada + viewport + jogador + altar (+ patrulheiros e portas).
   * @param {HTMLCanvasElement} base (2px por tile)
   * @param {number} ox @param {number} oy offsets da câmera
   * @param {number} ptx @param {number} pty tile do jogador
   * @param {{x:number,y:number}|null} altar
   * @param {Array<{x:number,y:number}>} [foes] patrulheiros (tiles) em vermelho
   * @param {Array<{x:number,y:number}>} [doors] portas visitáveis (tiles) em dourado
   */
  renderMinimap(base, ox, oy, ptx, pty, altar, foes = [], doors = []) {
    if (!this.mm || !base) return;
    const g = this.mm.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, this.mm.width, this.mm.height);
    g.drawImage(base, 0, 0);
    g.strokeStyle = '#ffffffaa'; g.lineWidth = 1;
    g.strokeRect((-ox / TILE) * 2 + 0.5, (-oy / TILE) * 2 + 0.5, (VIEW_W / TILE) * 2, (VIEW_H / TILE) * 2);
    if (altar) {
      g.fillStyle = '#ff5b5b';
      g.fillRect(altar.x * 2 - 2, altar.y * 2 - 2, 5, 5);
      g.fillStyle = '#fff';
      g.fillRect(altar.x * 2 - 1, altar.y * 2 - 1, 3, 3);
    }
    for (const d of doors) {
      g.fillStyle = '#ffd75e';
      g.fillRect(d.x * 2 - 1, d.y * 2 - 1, 3, 3);
    }
    for (const f of foes) {
      g.fillStyle = '#ff3b3b';
      g.fillRect(f.x * 2 - 1, f.y * 2 - 1, 3, 3);
    }
    g.fillStyle = '#000';
    g.fillRect(ptx * 2 - 3, pty * 2 - 3, 7, 7);
    g.fillStyle = '#ffd75e';
    g.fillRect(ptx * 2 - 2, pty * 2 - 2, 5, 5);
  }
}
