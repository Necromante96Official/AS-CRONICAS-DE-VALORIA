/**
 * TileMap — acesso, colisão e renderização do mapa.
 * @module world/TileMap
 */
import { TILE, VIEW_W, VIEW_H } from '../core/Config.js';
import { SOLID, T, drawTile, drawCanopyTop } from './Tiles.js';

export class TileMap {
  /** @param {{tiles: Uint8Array, w: number, h: number}} data */
  constructor(data) {
    this.tiles = data.tiles;
    this.w = data.w; this.h = data.h;
    /** @type {Array<[number, number, number]>} copas p/ o passe de oclusão */
    this._canopyQueue = [];
  }

  /** @param {number} tx @param {number} ty */
  tile(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return 5; // água fora dos limites
    return this.tiles[ty * this.w + tx];
  }

  /** @param {number} tx @param {number} ty */
  solid(tx, ty) { return SOLID.has(this.tile(tx, ty)); }

  /** Testa colisão de uma caixa (px) contra tiles sólidos. */
  collides(px, py, w, h) {
    const x0 = Math.floor(px / TILE), y0 = Math.floor(py / TILE);
    const x1 = Math.floor((px + w - 1) / TILE), y1 = Math.floor((py + h - 1) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (this.solid(tx, ty)) return true;
    }
    return false;
  }

  /** Desenha apenas a porção visível. Copas de árvores sem atores sobrepostos
   * vão para a fila de oclusão (desenhadas após os atores).
   * @param {CanvasRenderingContext2D} g @param {number} ox offset X (negativo) @param {number} oy offset Y (negativo) @param {number} time
   * @param {Array<{x:number,y:number,w:number,h:number}>} [actorRects] retângulos dos atores em tela
   */
  draw(g, ox, oy, time, actorRects = []) {
    const x0 = Math.max(0, Math.floor(-ox / TILE));
    const y0 = Math.max(0, Math.floor(-oy / TILE));
    const x1 = Math.min(this.w - 1, Math.ceil((-ox + VIEW_W) / TILE));
    const y1 = Math.min(this.h - 1, Math.ceil((-oy + VIEW_H) / TILE));
    const nb = (tx, ty) => (ox2, oy2) => this.tile(tx + ox2, ty + oy2);
    this._canopyQueue.length = 0;
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const t = this.tiles[ty * this.w + tx];
      const isTree = t === T.TREE || t === T.PINE || t === T.PALM;
      const sx = tx * TILE + ox, sy = ty * TILE + oy;
      const overlapped = isTree && actorRects.some((r) =>
        r.x < sx + TILE && r.x + r.w > sx && r.y < sy + TILE && r.y + r.h > sy);
      if (isTree && !overlapped) this._canopyQueue.push([t, tx, ty]);
      drawTile(g, t, sx, sy, TILE, tx, ty, time, nb(tx, ty),
        isTree ? { treeMode: overlapped ? 'full' : 'trunk' } : undefined);
    }
  }

  /** Desenha as copas enfileiradas (ocluem atores atrás das árvores). */
  drawCanopy(g, ox, oy, time) {
    for (const [t, tx, ty] of this._canopyQueue) {
      drawCanopyTop(g, t, tx * TILE + ox, ty * TILE + oy, TILE, tx, ty, time);
    }
    this._canopyQueue.length = 0;
  }
}
