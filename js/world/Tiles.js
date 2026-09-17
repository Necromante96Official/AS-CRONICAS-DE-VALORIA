/**
 * Tiles — ids, solidez e desenho procedural de cada tile.
 * Render camadado: base + detalhe + bordas de transição com vizinhos.
 * @module world/Tiles
 */
export const T = {
  GRASS: 0, TALL_GRASS: 1, FLOWER: 2, PATH: 3, SAND: 4,
  WATER: 5, BRIDGE: 6, TREE: 7, PINE: 8, STONE: 9,
  WALL: 10, FLOOR: 11, ROOF: 12, DOOR: 13, ALTAR: 14,
  DARK_GRASS: 15, RUIN: 16, PLAZA: 17,
  FENCE: 18, LAMP: 19, WELL: 20, SIGN: 21, CRATE: 22,
  SOIL: 23, MOUNTAIN: 24,
};

/** Tiles que bloqueiam movimento. */
export const SOLID = new Set([T.WATER, T.TREE, T.PINE, T.STONE, T.WALL, T.ROOF, T.ALTAR, T.RUIN,
  T.FENCE, T.LAMP, T.WELL, T.SIGN, T.CRATE, T.MOUNTAIN]);

/** Grama alta = zona de encontros. */
export const isEncounterTile = (t) => t === T.TALL_GRASS || t === T.DARK_GRASS;

/** Terrenos "pisáveis" (para bordas de transição). */
const GROUND = new Set([T.GRASS, T.TALL_GRASS, T.FLOWER, T.DARK_GRASS, T.PATH, T.SAND, T.FLOOR, T.PLAZA, T.SOIL]);
const GRASSY = new Set([T.GRASS, T.TALL_GRASS, T.FLOWER, T.DARK_GRASS]);
/** Caminhos que emendam entre si (trilhas de carroça). */
const WALKWAY = new Set([T.PATH, T.PLAZA, T.FLOOR, T.BRIDGE]);

/** @param {number} t @returns {'water'|'ground'|'solid'} */
function groupOf(t) {
  if (t === T.WATER || t === T.BRIDGE) return 'water';
  if (GROUND.has(t)) return 'ground';
  return 'solid';
}

/** Hash determinístico 2D uniforme em [0,1). Usa Math.imul para aritmética 32-bit exata. */
export function hash2(x, y) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

/** Cor simplificada do tile para o minimapa. @param {number} t */
export function tileColor(t) {
  switch (t) {
    case T.WATER: return '#2b6fd6';
    case T.BRIDGE: return '#8a5a2b';
    case T.PATH: return '#c9a86a';
    case T.SAND: return '#e0c886';
    case T.TREE: return '#256b33';
    case T.PINE: return '#1e4d2b';
    case T.STONE: return '#8d8d99';
    case T.WALL: return '#d9c9a8';
    case T.FLOOR: return '#7a4a22';
    case T.ROOF: return '#b23b3b';
    case T.DOOR: return '#6e451f';
    case T.ALTAR: return '#4fc3ff';
    case T.RUIN: return '#4a4a58';
    case T.PLAZA: return '#c7c9bb';
    case T.FENCE: return '#8a5a2b';
    case T.LAMP: return '#ffd75e';
    case T.WELL: return '#8d8d99';
    case T.SIGN: return '#8a5a2b';
    case T.CRATE: return '#a8763e';
    case T.SOIL: return '#6b4a2f';
    case T.MOUNTAIN: return '#9aa0ad';
    case T.TALL_GRASS: return '#2e7d46';
    case T.DARK_GRASS: return '#1e5b30';
    case T.FLOWER: return '#57b357';
    default: return '#3fa34d';
  }
}

/**
 * Desenha um tile em (dx, dy) com tamanho ts. time anima água/fogo.
 * @param {CanvasRenderingContext2D} g
 * @param {(ox:number, oy:number)=>number} nb tile vizinho por offset
 * @param {{treeMode?:'full'|'trunk'}} [opts] 'trunk' omite a copa (vai p/ overlay)
 */
export function drawTile(g, t, dx, dy, ts, x, y, time, nb, opts = {}) {
  const trunkOnly = opts.treeMode === 'trunk';
  const h = hash2(x, y);
  const h2 = hash2(x + 57, y + 131);
  const edge = (dir) => {
    if (dir === 'n') return nb(0, -1);
    if (dir === 's') return nb(0, 1);
    if (dir === 'w') return nb(-1, 0);
    return nb(1, 0);
  };
  /** Faixa de borda num dos 4 lados. */
  const strip = (dir, w, col) => {
    g.fillStyle = col;
    if (dir === 'n') g.fillRect(dx, dy, ts, w);
    else if (dir === 's') g.fillRect(dx, dy + ts - w, ts, w);
    else if (dir === 'w') g.fillRect(dx, dy, w, ts);
    else g.fillRect(dx + ts - w, dy, w, ts);
  };

  switch (t) {
    case T.GRASS: {
      g.fillStyle = h > 0.5 ? '#4da64d' : '#489e48';
      g.fillRect(dx, dy, ts, ts);
      // mancha ampla de tom
      if (hash2(x >> 2, y >> 2) > 0.62) { g.fillStyle = 'rgba(60,140,60,.35)'; g.fillRect(dx, dy, ts, ts); }
      g.fillStyle = h > 0.5 ? '#55b455' : '#3f9142';
      g.fillRect(dx + ((h * 91) | 0) % 20, dy + ((h * 57) | 0) % 20, 12, 12);
      // tufos e pedrinhas
      g.fillStyle = '#5cbf5c';
      g.fillRect(dx + 6 + ((h2 * 20) | 0), dy + 8, 2, 6);
      g.fillRect(dx + 20 - ((h2 * 14) | 0), dy + 18, 2, 6);
      if (h2 > 0.86) { g.fillStyle = '#9aa39a'; g.fillRect(dx + 14, dy + 22, 4, 3); }
      // cogumelo raro
      if (h2 > 0.965) {
        g.fillStyle = '#f2ead8'; g.fillRect(dx + 15, dy + 20, 2, 5);
        g.fillStyle = '#c22a3a'; g.fillRect(dx + 12, dy + 16, 8, 4);
        g.fillStyle = '#fff'; g.fillRect(dx + 13, dy + 17, 2, 2); g.fillRect(dx + 17, dy + 17, 2, 2);
      }
      break;
    }
    case T.TALL_GRASS: {
      g.fillStyle = '#3a8a40'; g.fillRect(dx, dy, ts, ts);
      g.fillStyle = '#2f7034'; g.fillRect(dx, dy + 22, ts, 10);
      g.fillStyle = '#63c763';
      for (let i = 0; i < 6; i++) {
        const bx = dx + 2 + i * 5 + Math.sin(time * 2.2 + x * 1.1 + i * 1.7) * 1.6;
        const bh = 12 + ((h * 37 + i * 5) | 0) % 8;
        g.fillRect(bx, dy + 26 - bh, 3, bh);
      }
      g.fillStyle = '#8ce08c';
      g.fillRect(dx + 5, dy + 6, 2, 5);
      g.fillRect(dx + 23, dy + 10, 2, 5);
      // pontinhas claras ocasionais
      if (h2 > 0.9) { g.fillStyle = '#e8f5e8'; g.fillRect(dx + 12, dy + 4, 2, 2); g.fillRect(dx + 19, dy + 7, 2, 2); }
      break;
    }
    case T.DARK_GRASS: {
      g.fillStyle = '#2a6134'; g.fillRect(dx, dy, ts, ts);
      g.fillStyle = '#1d4727'; g.fillRect(dx, dy + 20, ts, 12);
      g.fillStyle = '#173d22';
      for (let i = 0; i < 5; i++) {
        const bx = dx + 3 + i * 6 + Math.sin(time * 1.6 + x + i * 2.1) * 1.4;
        g.fillRect(bx, dy + 8 + ((h * 10 + i * 4) | 0) % 8, 3, 14);
      }
      // vagalumes
      if (h2 > 0.6) {
        g.fillStyle = `rgba(255,240,150,${0.35 + 0.35 * Math.sin(time * 3 + x * 3 + y)})`;
        g.fillRect(dx + ((h2 * 24) | 0) + 4, dy + ((h * 24) | 0) + 4, 2, 2);
      }
      break;
    }
    case T.FLOWER: {
      g.fillStyle = '#4da64d'; g.fillRect(dx, dy, ts, ts);
      g.fillStyle = '#3c8c3c'; g.fillRect(dx + 6, dy + 10, 3, 12); g.fillRect(dx + 23, dy + 12, 3, 10);
      const sway = Math.sin(time * 2.5 + x * 2 + y) * 1.5;
      const cols = ['#ff8fb3', '#ffd75e', '#cfe8ff'];
      const col = cols[((h * 3) | 0) % 3];
      const fx = dx + 13 + sway, fy = dy + 6;
      g.fillStyle = col;
      g.fillRect(fx - 3, fy, 3, 3); g.fillRect(fx + 3, fy, 3, 3);
      g.fillRect(fx, fy - 3, 3, 3); g.fillRect(fx, fy + 3, 3, 3);
      g.fillStyle = '#fff'; g.fillRect(fx, fy, 2, 2);
      const fx2 = dx + 21 - sway, fy2 = dy + 8;
      g.fillStyle = cols[((h2 * 3) | 0) % 3];
      g.fillRect(fx2 - 2, fy2, 2, 2); g.fillRect(fx2 + 2, fy2, 2, 2);
      g.fillRect(fx2, fy2 - 2, 2, 2); g.fillRect(fx2, fy2 + 2, 2, 2);
      break;
    }
    case T.PATH: {
      g.fillStyle = '#c9a86a'; g.fillRect(dx, dy, ts, ts);
      g.fillStyle = '#bd9c60'; g.fillRect(dx, dy + 16, ts, 16);
      // pedras arredondadas com luz
      const stones = [[7, 7], [21, 5], [14, 16], [5, 22], [24, 23]];
      for (const [sx, sy] of stones) {
        if (hash2(x * 3 + sx, y * 3 + sy) < 0.35) continue;
        g.fillStyle = '#d9bd85'; g.fillRect(dx + sx, dy + sy, 7, 5);
        g.fillStyle = '#b8945a'; g.fillRect(dx + sx, dy + sy + 3, 7, 2);
      }
      for (const d of ['n', 's', 'w', 'e']) if (GRASSY.has(edge(d))) strip(d, 3, '#a8845c');
      // trilhas de carroça ao longo do caminho
      const ew = WALKWAY.has(edge('w')) || WALKWAY.has(edge('e'));
      const ns = WALKWAY.has(edge('n')) || WALKWAY.has(edge('s'));
      g.fillStyle = 'rgba(140,110,70,.55)';
      if (ew && !ns) { g.fillRect(dx, dy + 9, ts, 2); g.fillRect(dx, dy + 21, ts, 2); }
      else if (ns && !ew) { g.fillRect(dx + 9, dy, 2, ts); g.fillRect(dx + 21, dy, 2, ts); }
      break;
    }
    case T.PLAZA: {
      g.fillStyle = '#c7c9bb'; g.fillRect(dx, dy, ts, ts);
      g.fillStyle = '#b4b6a8';
      g.fillRect(dx, dy + 15, ts, 2); g.fillRect(dx + 15, dy, 2, ts);
      g.fillStyle = '#d6d8c9'; g.fillRect(dx + 2, dy + 2, 11, 11);
      if (h > 0.7) { g.fillStyle = '#9a9c8e'; g.fillRect(dx + 20, dy + 20, 5, 4); }
      // medalhão central ocasional
      if (h2 > 0.82) {
        g.fillStyle = '#9a9c8e';
        g.fillRect(dx + 11, dy + 11, 10, 10);
        g.fillStyle = '#c7c9bb';
        g.fillRect(dx + 13, dy + 13, 6, 6);
        g.fillStyle = '#4fc3ff'; g.fillRect(dx + 15, dy + 15, 2, 2);
      }
      for (const d of ['n', 's', 'w', 'e']) if (edge(d) !== T.PLAZA && groupOf(edge(d)) === 'ground') strip(d, 3, '#9a9c8e');
      break;
    }
    case T.SAND: {
      g.fillStyle = '#e0c886'; g.fillRect(dx, dy, ts, ts);
      g.fillStyle = '#d3ba7c';
      g.fillRect(dx + ((h * 20) | 0), dy + ((h2 * 20) | 0), 8, 3);
      g.fillRect(dx + ((h2 * 18) | 0), dy + ((h * 18) | 0), 3, 3);
      // concha ocasional
      if (h2 > 0.93) {
        g.fillStyle = '#f2b8c6'; g.fillRect(dx + 18, dy + 20, 5, 3);
        g.fillStyle = '#fff'; g.fillRect(dx + 19, dy + 20, 2, 1);
      }
      for (const d of ['n', 's', 'w', 'e']) if (GRASSY.has(edge(d))) strip(d, 3, '#c2a878');
      break;
    }
    case T.WATER: {
      const deep = hash2(x >> 1, y >> 1) > 0.58;
      g.fillStyle = deep ? '#1f4ab0' : '#2456c8'; g.fillRect(dx, dy, ts, ts);
      g.fillStyle = deep ? '#2456c8' : '#2b6fd6'; g.fillRect(dx, dy, ts, 12);
      g.fillStyle = '#3f8cff';
      const o1 = ((x * 7 + time * 14) % 40 + 40) % 40;
      const o2 = ((y * 11 - time * 11) % 40 + 40) % 40;
      g.fillRect(dx + o1 - 8, dy + 9, 15, 3);
      g.fillRect(dx + o2 - 6, dy + 21, 13, 3);
      // brilhos
      if (h > 0.55) {
        g.fillStyle = `rgba(255,255,255,${0.25 + 0.3 * Math.abs(Math.sin(time * 2 + x + y * 2))})`;
        g.fillRect(dx + ((h * 26) | 0) + 2, dy + ((h2 * 22) | 0) + 4, 3, 2);
      }
      // espuma na margem
      let shore = false;
      for (const d of ['n', 's', 'w', 'e']) {
        if (groupOf(edge(d)) === 'ground') {
          shore = true;
          const w = 3 + Math.sin(time * 4 + x * 1.3 + y * 1.7) * 1.5;
          g.fillStyle = 'rgba(255,255,255,.8)';
          if (d === 'n') g.fillRect(dx, dy, ts, w);
          else if (d === 's') g.fillRect(dx, dy + ts - w, ts, w);
          else if (d === 'w') g.fillRect(dx, dy, w, ts);
          else g.fillRect(dx + ts - w, dy, w, ts);
        }
      }
      // vitória-régia perto da margem
      if (shore && h2 > 0.45) {
        const lx = dx + ((h * 18) | 0) + 5, ly = dy + ((h2 * 16) | 0) + 8;
        g.fillStyle = '#2e7d32';
        g.beginPath(); g.ellipse(lx, ly, 6, 3.5, 0, 0, 7); g.fill();
        g.fillStyle = '#ff8fb3'; g.fillRect(lx - 1, ly - 4, 3, 3);
      }
      break;
    }
    case T.BRIDGE: {
      // PONTE de madeira sobre o rio: tabuleiro com tábuas, pregos e corrimão de corda.
      g.fillStyle = '#1d4fa8'; g.fillRect(dx, dy, ts, ts);
      // reflexo da água nas frestas
      g.fillStyle = 'rgba(255,255,255,.25)';
      g.fillRect(dx, dy + 4, ts, 1); g.fillRect(dx, dy + 27, ts, 1);
      // tabuleiro: tábuas horizontais (travessia leste-oeste)
      g.fillStyle = '#8a5a2b'; g.fillRect(dx, dy, ts, ts);
      for (let r = 0; r < 4; r++) {
        const ry = dy + r * 8;
        g.fillStyle = r % 2 ? '#96632f' : '#8a5a2b';
        g.fillRect(dx, ry, ts, 8);
        g.fillStyle = '#5e3a17'; g.fillRect(dx, ry + 7, ts, 1); // fresta
        g.fillStyle = '#c49a5e'; g.fillRect(dx, ry, ts, 1); // luz no topo da tábua
      }
      // veios da madeira + pregos
      g.fillStyle = '#6e451f';
      g.fillRect(dx + 8, dy + 3, 6, 1); g.fillRect(dx + 18, dy + 11, 6, 1);
      g.fillRect(dx + 6, dy + 19, 6, 1); g.fillRect(dx + 20, dy + 27, 6, 1);
      g.fillStyle = '#2a2a3a';
      g.fillRect(dx + 2, dy + 3, 2, 2); g.fillRect(dx + ts - 4, dy + 3, 2, 2);
      g.fillRect(dx + 2, dy + 27, 2, 2); g.fillRect(dx + ts - 4, dy + 27, 2, 2);
      // corrimão de corda onde há água ao norte/sul: postes + 2 cordas
      const rail = (north) => {
        const ry = north ? dy + 1 : dy + ts - 6;
        g.fillStyle = '#4a2f14';
        g.fillRect(dx + 2, north ? dy : dy + ts - 11, 4, 11);
        g.fillRect(dx + ts - 6, north ? dy : dy + ts - 11, 4, 11);
        g.fillStyle = '#8a5a2b';
        g.fillRect(dx + 2, north ? dy : dy + ts - 11, 4, 2);
        g.fillRect(dx + ts - 6, north ? dy : dy + ts - 11, 4, 2);
        g.fillStyle = '#c9b896'; // cordas
        g.fillRect(dx, ry + 1, ts, 2); g.fillRect(dx, ry + 4, ts, 1);
      };
      if (edge('n') === T.WATER) rail(true);
      if (edge('s') === T.WATER) rail(false);
      // viga de sustentação + espuma onde encosta na margem
      g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(dx, dy + ts - 3, ts, 3);
      for (const d of ['w', 'e']) {
        if (groupOf(edge(d)) === 'ground') {
          const w = 2 + Math.sin(time * 4 + x + y) * 1.2;
          g.fillStyle = 'rgba(255,255,255,.75)';
          if (d === 'w') g.fillRect(dx, dy, w + 1, ts);
          else g.fillRect(dx + ts - w - 1, dy, w + 1, ts);
          g.fillStyle = '#5e3a17';
          if (d === 'w') g.fillRect(dx, dy, 2, ts); else g.fillRect(dx + ts - 2, dy, 2, ts);
        }
      }
      break;
    }
    case T.TREE: {
      // ÁRVORE frondosa: tronco com raízes e casca.
      g.fillStyle = '#4da64d'; g.fillRect(dx, dy, ts, ts);
      g.fillStyle = '#3f9142';
      g.fillRect(dx + 4 + ((h2 * 14) | 0), dy + 24, 5, 3);
      g.fillStyle = 'rgba(0,0,0,.25)';
      g.beginPath(); g.ellipse(dx + 16, dy + 28, 11, 4, 0, 0, 7); g.fill();
      g.fillStyle = '#4a2f14'; g.fillRect(dx + 12, dy + 18, 8, 12);
      g.fillStyle = '#6e451f'; g.fillRect(dx + 13, dy + 18, 6, 12);
      g.fillStyle = '#8a5f30'; g.fillRect(dx + 13, dy + 18, 2, 12);
      g.fillStyle = '#4a2f14';
      g.fillRect(dx + 10, dy + 26, 4, 3); g.fillRect(dx + 18, dy + 26, 4, 3); // raízes
      g.fillStyle = '#8a5f30'; g.fillRect(dx + 10, dy + 26, 4, 1); g.fillRect(dx + 18, dy + 26, 4, 1);
      if (!trunkOnly) drawCanopyTop(g, t, dx, dy, ts, x, y, time);
      else { g.fillStyle = 'rgba(20,60,25,.35)'; g.fillRect(dx + 8, dy + 20, 16, 4); }
      break;
    }
    case T.PINE: {
      // PINHEIRO: tronco fino com galhos secos.
      g.fillStyle = '#2e6b3a'; g.fillRect(dx, dy, ts, ts);
      g.fillStyle = 'rgba(0,0,0,.25)';
      g.beginPath(); g.ellipse(dx + 16, dy + 29, 9, 3, 0, 0, 7); g.fill();
      g.fillStyle = '#4a2f14'; g.fillRect(dx + 13, dy + 22, 6, 9);
      g.fillStyle = '#6e451f'; g.fillRect(dx + 14, dy + 22, 4, 9);
      g.fillStyle = '#8a5f30'; g.fillRect(dx + 14, dy + 22, 1, 9);
      if (!trunkOnly) drawCanopyTop(g, t, dx, dy, ts, x, y, time);
      break;
    }
    case T.STONE: {
      // PEDREGULHO: rocha arredondada com facetas, rachadura e musgo.
      g.fillStyle = '#4da64d'; g.fillRect(dx, dy, ts, ts);
      g.fillStyle = '#3f9142';
      g.fillRect(dx + 5 + ((h2 * 12) | 0), dy + 24, 6, 3);
      g.fillStyle = 'rgba(0,0,0,.28)';
      g.beginPath(); g.ellipse(dx + 16, dy + 27, 11, 3, 0, 0, 7); g.fill();
      // corpo arredondado: sombra + base + topo iluminado
      g.fillStyle = '#565664';
      g.beginPath(); g.ellipse(dx + 16, dy + 18, 11, 8, 0, 0, 7); g.fill();
      g.fillStyle = '#8d8d99';
      g.beginPath(); g.ellipse(dx + 16, dy + 17, 10, 7, 0, 0, 7); g.fill();
      g.fillStyle = '#b5b5c2';
      g.beginPath(); g.ellipse(dx + 13, dy + 14, 5.5, 3.5, -0.4, 0, 7); g.fill();
      g.fillStyle = '#fff';
      g.fillRect(dx + 10, dy + 12, 3, 2);
      // facetas laterais + rachadura
      g.fillStyle = '#6e6e7a';
      g.beginPath(); g.moveTo(dx + 22, dy + 13); g.lineTo(dx + 25, dy + 18); g.lineTo(dx + 22, dy + 23); g.lineTo(dx + 20, dy + 18); g.closePath(); g.fill();
      g.strokeStyle = '#4a4a58'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(dx + 15, dy + 14); g.lineTo(dx + 17, dy + 18); g.lineTo(dx + 15, dy + 22); g.stroke();
      // musgo agarrado na base + pedrinhas
      g.fillStyle = '#3f9142';
      g.fillRect(dx + 7, dy + 21, 5, 3); g.fillRect(dx + 20, dy + 22, 4, 3);
      g.fillStyle = '#5cbf5c'; g.fillRect(dx + 7, dy + 21, 5, 1);
      g.fillStyle = '#9aa39a'; g.fillRect(dx + 24, dy + 24, 3, 2);
      break;
    }
    case T.WALL: {
      // CASA Tudor: reboco + vigas, com viga-mestra sob o telhado e fundação de pedra.
      // Contexto: sabe se há telhado acima, porta ao lado e se é a base da casa.
      const nWall = edge('n'), sWall = edge('s'), wWall = edge('w'), eWall = edge('e');
      const underRoof = nWall === T.ROOF;
      const isBase = !(sWall === T.WALL || sWall === T.DOOR);
      g.fillStyle = '#e8dcc0'; g.fillRect(dx, dy, ts, ts);
      // manchas de reboco
      g.fillStyle = h > 0.5 ? '#ded0b2' : '#efe4c8';
      g.fillRect(dx + 4, dy + 4, 12, 10);
      // enxaimel: moldura + viga central + viga horizontal
      g.fillStyle = '#5e3a17';
      g.fillRect(dx, dy, ts, 2); g.fillRect(dx, dy + ts - 2, ts, 2);
      g.fillRect(dx, dy, 2, ts); g.fillRect(dx + ts - 2, dy, 2, ts);
      g.fillRect(dx + 15, dy, 2, ts);
      g.fillRect(dx, dy + 15, ts, 2);
      // viga-mestra escura sob o telhado (sombra do beiral)
      if (underRoof) {
        g.fillStyle = 'rgba(40,18,8,.45)'; g.fillRect(dx, dy, ts, 7);
        g.fillStyle = '#4a2f14'; g.fillRect(dx, dy + 5, ts, 3);
        g.fillStyle = '#8a5a2b'; g.fillRect(dx, dy + 5, ts, 1);
      }
      // fundação de pedra na base da parede
      if (isBase) {
        g.fillStyle = '#8d8d99'; g.fillRect(dx, dy + ts - 7, ts, 7);
        g.fillStyle = '#565664'; g.fillRect(dx, dy + ts - 7, ts, 1);
        g.fillRect(dx + 7, dy + ts - 7, 1, 7); g.fillRect(dx + 16, dy + ts - 7, 1, 7); g.fillRect(dx + 25, dy + ts - 7, 1, 7);
        g.fillStyle = '#b5b5c2'; g.fillRect(dx, dy + ts - 7, ts, 1);
      }
      // janela central com venezianas — só no miolo da casa (evita porta)
      const midHouse = (wWall === T.WALL || wWall === T.DOOR) || (eWall === T.WALL || eWall === T.DOOR);
      const wantWindow = midHouse && h2 > 0.42 && sWall !== T.ROOF;
      if (wantWindow) {
        // venezianas verdes laterais
        g.fillStyle = '#2e7d4f';
        g.fillRect(dx + 4, dy + 8, 4, 14); g.fillRect(dx + 24, dy + 8, 4, 14);
        g.fillStyle = '#1d4d30';
        for (let i = 0; i < 4; i++) { g.fillRect(dx + 4, dy + 9 + i * 4, 4, 1); g.fillRect(dx + 24, dy + 9 + i * 4, 4, 1); }
        // moldura + vidro quente (luz acesa)
        g.fillStyle = '#4a2f14'; g.fillRect(dx + 9, dy + 7, 14, 16);
        const night = 0.75 + 0.25 * Math.sin(time * 2 + x);
        g.fillStyle = `rgba(255,205,110,${night.toFixed(2)})`;
        g.fillRect(dx + 11, dy + 9, 10, 12);
        g.fillStyle = '#7fa8d9'; g.fillRect(dx + 11, dy + 9, 10, 4); // reflexo do céu no topo
        g.fillStyle = '#4a2f14';
        g.fillRect(dx + 15, dy + 9, 2, 12); g.fillRect(dx + 11, dy + 13, 10, 2); // cruz da esquadria
        // peitoril + floreira
        g.fillStyle = '#a89878'; g.fillRect(dx + 8, dy + 23, 16, 3);
        g.fillStyle = '#6e451f'; g.fillRect(dx + 9, dy + 21, 14, 3);
        g.fillStyle = '#3f9142'; g.fillRect(dx + 9, dy + 20, 14, 2);
        g.fillStyle = '#ff8fb3'; g.fillRect(dx + 10, dy + 19, 3, 2); g.fillRect(dx + 16, dy + 19, 3, 2); g.fillRect(dx + 21, dy + 19, 2, 2);
      } else {
        // viga diagonal decorativa quando não há janela
        g.fillStyle = '#5e3a17';
        g.fillRect(dx + 5, dy + 5, 8, 2);
        g.fillRect(dx + 19, dy + 20, 8, 2);
      }
      if (isBase) { g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(dx, dy + ts - 3, ts, 3); }
      break;
    }
    case T.FLOOR: {
      g.fillStyle = '#8a5a2b'; g.fillRect(dx, dy, ts, ts);
      g.fillStyle = '#75491f';
      for (let i = 0; i < 3; i++) g.fillRect(dx, dy + 6 + i * 10, ts, 2);
      g.fillStyle = '#a8763e'; g.fillRect(dx, dy, ts, 2);
      for (const d of ['n', 's', 'w', 'e']) if (GRASSY.has(edge(d))) strip(d, 3, '#5e3a17');
      break;
    }
    case T.ROOF: {
      // TELHADO de cerâmica: cumeeira no topo, fileiras de telhas e beiral com vigas.
      const nR = edge('n') === T.ROOF, sR = edge('s') === T.ROOF;
      const wR = edge('w') === T.ROOF, eR = edge('e') === T.ROOF;
      const below = edge('s');
      const isTop = !nR, isEave = !sR || below === T.WALL || below === T.DOOR;
      g.fillStyle = h > 0.4 ? '#b23b3b' : '#a83434'; g.fillRect(dx, dy, ts, ts);
      // fileiras horizontais de telhas (luz em cima, sombra embaixo)
      for (let r = 0; r < 4; r++) {
        const ry = dy + r * 8;
        g.fillStyle = '#8c2b2b'; g.fillRect(dx, ry + 6, ts, 2);
        g.fillStyle = '#d46969'; g.fillRect(dx, ry, ts, 2);
      }
      // calhas verticais arredondadas
      g.fillStyle = '#8c2b2b';
      for (let i = 0; i < 4; i++) {
        g.fillRect(dx + i * 8 + 5, dy, 2, ts);
        g.fillStyle = '#d46969';
        g.fillRect(dx + i * 8 + 4, dy, 1, ts);
        g.fillStyle = '#8c2b2b';
      }
      // cumeeira (topo do telhado): faixa clara + telhas de capa
      if (isTop) {
        g.fillStyle = '#d46969'; g.fillRect(dx, dy, ts, 7);
        g.fillStyle = '#8c2b2b'; g.fillRect(dx, dy + 6, ts, 2);
        for (let i = 0; i < 4; i++) {
          g.fillStyle = '#e88a8a';
          g.fillRect(dx + i * 8 + 1, dy + 1, 6, 4);
          g.fillStyle = '#8c2b2b';
          g.fillRect(dx + i * 8 + 1, dy + 5, 6, 1);
        }
      }
      // bordas laterais do telhado (oitão)
      if (!wR) { g.fillStyle = '#e8dcc0'; g.fillRect(dx, dy, 3, ts); g.fillStyle = '#5e3a17'; g.fillRect(dx + 3, dy, 1, ts); }
      if (!eR) { g.fillStyle = '#e8dcc0'; g.fillRect(dx + ts - 3, dy, 3, ts); g.fillStyle = '#5e3a17'; g.fillRect(dx + ts - 4, dy, 1, ts); }
      // beiral: beirada escura + pontas das vigas de madeira
      if (isEave) {
        g.fillStyle = 'rgba(30,10,8,.55)'; g.fillRect(dx, dy + ts - 9, ts, 9);
        g.fillStyle = '#3a1e10'; g.fillRect(dx, dy + ts - 7, ts, 4);
        for (let i = 0; i < 4; i++) {
          g.fillStyle = '#5e3a17'; g.fillRect(dx + i * 8 + 2, dy + ts - 6, 5, 4);
          g.fillStyle = '#8a5a2b'; g.fillRect(dx + i * 8 + 2, dy + ts - 6, 5, 1);
        }
      }
      // chaminé de tijolos num dos tiles do topo + fumaça animada
      if (isTop && h > 0.55) {
        const chx = dx + 18;
        g.fillStyle = '#6e4a3a'; g.fillRect(chx, dy + 6, 10, 16);
        g.fillStyle = '#8a5f4d';
        for (let r = 0; r < 4; r++) g.fillRect(chx, dy + 8 + r * 4, 10, 1);
        g.fillStyle = '#3a3a3a'; g.fillRect(chx - 1, dy + 4, 12, 4);
        g.fillStyle = '#101018'; g.fillRect(chx + 1, dy + 4, 8, 2);
        const cyc = (time * 16 + h * 120) % 44;
        for (let i = 0; i < 3; i++) {
          const yy = dy - ((cyc + i * 15) % 44);
          const a = 0.45 * (1 - ((cyc + i * 15) % 44) / 44);
          g.fillStyle = `rgba(225,225,230,${a.toFixed(2)})`;
          const xx = chx + 2 + Math.sin(time * 2 + i * 1.5 + h * 9) * 3;
          g.fillRect(xx, yy, 6, 6);
        }
      }
      break;
    }
    case T.DOOR: {
      // PORTA da casa: pórtico de pedra, porta dupla de madeira, lampião e degraus.
      // Parece entrada de verdade, não um quadrado marrom.
      g.fillStyle = '#e8dcc0'; g.fillRect(dx, dy, ts, ts);
      // fundação lateral de pedra do pórtico
      g.fillStyle = '#8d8d99'; g.fillRect(dx, dy + ts - 7, 7, 7); g.fillRect(dx + ts - 7, dy + ts - 7, 7, 7);
      g.fillStyle = '#565664'; g.fillRect(dx, dy + ts - 7, 7, 1); g.fillRect(dx + ts - 7, dy + ts - 7, 7, 1);
      // pilares de pedra do portal
      g.fillStyle = '#b5b5c2'; g.fillRect(dx + 3, dy + 2, 5, 26); g.fillRect(dx + ts - 8, dy + 2, 5, 26);
      g.fillStyle = '#6e6e7a';
      g.fillRect(dx + 3, dy + 2, 5, 2); g.fillRect(dx + ts - 8, dy + 2, 5, 2);
      g.fillRect(dx + 3, dy + 12, 5, 2); g.fillRect(dx + ts - 8, dy + 12, 5, 2);
      // verga de madeira + telhadinho sobre a porta
      g.fillStyle = '#5e3a17'; g.fillRect(dx + 2, dy, 28, 5);
      g.fillStyle = '#8a5a2b'; g.fillRect(dx + 2, dy, 28, 2);
      g.fillStyle = '#a83434';
      g.beginPath(); g.moveTo(dx + 1, dy + 1); g.lineTo(dx + 16, dy - 5); g.lineTo(dx + 31, dy + 1); g.closePath(); g.fill();
      // vão escuro + porta dupla de madeira
      g.fillStyle = '#1d120a'; g.fillRect(dx + 9, dy + 5, 14, 25);
      g.fillStyle = '#8a5a2b'; g.fillRect(dx + 10, dy + 6, 12, 23);
      g.fillStyle = '#6e451f';
      for (let i = 0; i < 3; i++) { g.fillRect(dx + 10 + i * 4, dy + 6, 1, 23); }
      g.fillRect(dx + 10, dy + 13, 12, 2); g.fillRect(dx + 10, dy + 21, 12, 2);
      g.fillStyle = '#a8763e'; g.fillRect(dx + 10, dy + 6, 12, 1);
      // batentes de ferro + aldravas douradas
      g.fillStyle = '#2a2a3a';
      for (const sy of [10, 17, 24]) { g.fillRect(dx + 12, dy + sy, 2, 2); g.fillRect(dx + 18, dy + sy, 2, 2); }
      const bob = Math.sin(time * 2.2 + x * 2) * 0.6;
      g.fillStyle = '#ffd75e';
      g.fillRect(dx + 13, dy + 17 + bob, 2, 3); g.fillRect(dx + 17, dy + 17 - bob, 2, 3);
      // lampião aceso sobre a porta
      g.fillStyle = '#2a2a3a'; g.fillRect(dx + 14, dy + 1, 4, 4);
      const glow = 0.6 + 0.3 * Math.sin(time * 3 + x);
      g.fillStyle = `rgba(255,215,94,${glow.toFixed(2)})`;
      g.fillRect(dx + 15, dy + 2, 2, 2);
      g.fillStyle = `rgba(255,215,94,.18)`;
      g.fillRect(dx + 9, dy + 1, 14, 7);
      // degraus de pedra + capacho listrado
      g.fillStyle = '#b5b5c2'; g.fillRect(dx + 7, dy + ts - 5, 18, 3);
      g.fillStyle = '#8d8d99'; g.fillRect(dx + 7, dy + ts - 2, 18, 2);
      g.fillStyle = '#7a3b3b'; g.fillRect(dx + 10, dy + ts - 7, 12, 3);
      g.fillStyle = '#d46969'; g.fillRect(dx + 10, dy + ts - 7, 12, 1);
      break;
    }
    case T.ALTAR: {
      // ALTAR DO CAOS: mesa de pedra com runas, degraus e fenda brilhante.
      g.fillStyle = '#23233a'; g.fillRect(dx, dy, ts, ts);
      // lajes do piso com runas circulares
      g.fillStyle = '#3a3f5e'; g.fillRect(dx + 2, dy + 2, 28, 28);
      g.strokeStyle = '#565b8c'; g.lineWidth = 1.5;
      g.beginPath(); g.ellipse(dx + 16, dy + 20, 12, 8, 0, 0, 7); g.stroke();
      g.beginPath(); g.ellipse(dx + 16, dy + 20, 7, 4.5, 0, 0, 7); g.stroke();
      // degraus frontais
      g.fillStyle = '#565b68'; g.fillRect(dx + 4, dy + 24, 24, 4);
      g.fillStyle = '#34343f'; g.fillRect(dx + 4, dy + 28, 24, 4);
      // mesa do altar: base + tampo + pano ritual
      g.fillStyle = 'rgba(0,0,0,.35)';
      g.beginPath(); g.ellipse(dx + 16, dy + 24, 11, 3, 0, 0, 7); g.fill();
      g.fillStyle = '#6a6a7a'; g.fillRect(dx + 9, dy + 14, 14, 10);
      g.fillStyle = '#8d8d99'; g.fillRect(dx + 7, dy + 11, 18, 4);
      g.fillStyle = '#b5b5c2'; g.fillRect(dx + 7, dy + 11, 18, 1);
      g.fillStyle = '#5e1a28'; g.fillRect(dx + 13, dy + 14, 6, 10); // pano vermelho central
      g.fillStyle = '#ffd75e'; g.fillRect(dx + 14, dy + 16, 4, 1); g.fillRect(dx + 15, dy + 14, 1, 4);
      // fenda de energia do Caos pulsando sobre a mesa
      const pulse = 0.55 + 0.35 * Math.sin(time * 3 + x + y);
      g.fillStyle = `rgba(79,195,255,${pulse.toFixed(2)})`;
      g.fillRect(dx + 13, dy + 4, 6, 9);
      g.fillStyle = '#bff3ff'; g.fillRect(dx + 14, dy + 5, 2, 5);
      g.fillStyle = `rgba(255,80,120,${(0.3 + 0.3 * Math.sin(time * 4 + x)).toFixed(2)})`;
      g.fillRect(dx + 8, dy + 11, 2, 2); g.fillRect(dx + 22, dy + 11, 2, 2);
      // velas laterais acesas
      for (const vx of [5, 25]) {
        g.fillStyle = '#e8e4da'; g.fillRect(dx + vx, dy + 14, 2, 6);
        const fl = Math.sin(time * 10 + x * 3 + vx) * 1;
        g.fillStyle = '#ff7b2e'; g.fillRect(dx + vx - 1, dy + 10 + fl, 4, 4 - fl);
        g.fillStyle = '#ffd75e'; g.fillRect(dx + vx, dy + 11 + fl, 2, 3 - fl);
      }
      break;
    }
    case T.RUIN: {
      // RUÍNA: coluna partida com capitel, rachaduras, runas e hera.
      g.fillStyle = '#33333f'; g.fillRect(dx, dy, ts, ts);
      g.fillStyle = '#3f3f4d';
      g.fillRect(dx + ((h * 20) | 0), dy + ((h2 * 20) | 0), 8, 3);
      g.fillStyle = 'rgba(0,0,0,.3)';
      g.beginPath(); g.ellipse(dx + 16, dy + 29, 10, 3, 0, 0, 7); g.fill();
      // braseiro cerimonial aceso em alguns pilares
      if (h > 0.42) {
        g.fillStyle = '#26262e'; g.fillRect(dx + 7, dy + 22, 18, 7);
        g.fillStyle = '#565b68'; g.fillRect(dx + 7, dy + 22, 18, 2);
        // tacho de ferro
        g.fillStyle = '#1c1c24'; g.fillRect(dx + 8, dy + 16, 16, 7);
        g.fillStyle = '#3a3a48'; g.fillRect(dx + 8, dy + 16, 16, 2);
        const fl = Math.sin(time * 9 + x * 5 + y * 3) * 1.5;
        g.fillStyle = 'rgba(255,120,30,.3)';
        g.fillRect(dx + 6, dy + 4, 20, 14);
        // brasas + chamas em 3 línguas
        g.fillStyle = '#7a2a10'; g.fillRect(dx + 10, dy + 14, 12, 4);
        g.fillStyle = '#ff7b2e';
        g.fillRect(dx + 11, dy + 9 + fl, 4, 7 - fl);
        g.fillRect(dx + 17, dy + 10 - fl, 4, 6 + fl);
        g.fillStyle = '#ffd75e';
        g.fillRect(dx + 12, dy + 11 + fl, 3, 4 - fl);
        g.fillRect(dx + 18, dy + 12 - fl, 2, 3 + fl);
        g.fillStyle = '#fff3c4'; g.fillRect(dx + 13, dy + 12 + fl, 1, 2);
      } else {
        // coluna quebrada: fuste canelado + capitel + base
        const bw = 13, bx = dx + 9;
        g.fillStyle = '#6a6a7a'; g.fillRect(bx, dy + 6, bw, 20);
        g.fillStyle = '#8d8d99';
        for (let i = 0; i < 3; i++) g.fillRect(bx + 1 + i * 4, dy + 6, 2, 20); // caneluras
        g.fillStyle = '#b5b5c2'; g.fillRect(bx - 2, dy + 4, bw + 4, 4); // capitel
        g.fillStyle = '#34343f'; g.fillRect(bx - 2, dy + 24, bw + 4, 4); // base
        g.fillStyle = '#26262e'; g.fillRect(bx - 2, dy + 27, bw + 4, 1);
        // quebra irregular no topo + rachadura
        g.fillStyle = '#33333f';
        g.fillRect(bx + (h > 0.5 ? 0 : 6), dy + 4, 7, 3);
        g.strokeStyle = '#26262e'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(bx + 6, dy + 10); g.lineTo(bx + 8, dy + 16); g.lineTo(bx + 6, dy + 22); g.stroke();
        // runa brilhante gravada + hera
        const rp = 0.5 + 0.4 * Math.sin(time * 2.5 + x * 2 + y);
        g.fillStyle = `rgba(79,195,255,${rp.toFixed(2)})`;
        g.fillRect(bx + 5, dy + 12, 3, 5);
        g.fillStyle = '#bff3ff'; g.fillRect(bx + 6, dy + 13, 1, 2);
        g.fillStyle = '#3f9142';
        g.fillRect(bx - 1, dy + 14, 3, 7); g.fillRect(bx + bw - 1, dy + 18, 3, 6);
        g.fillStyle = '#5cbf5c'; g.fillRect(bx - 1, dy + 14, 3, 2); g.fillRect(bx + bw - 1, dy + 18, 3, 2);
      }
      break;
    }
    case T.FENCE: {
      // CERCA de fazenda: mourões com ponta + 2 travessas com pregos.
      g.fillStyle = '#4da64d'; g.fillRect(dx, dy, ts, ts);
      g.fillStyle = 'rgba(0,0,0,.18)';
      g.beginPath(); g.ellipse(dx + 16, dy + 29, 10, 2.5, 0, 0, 7); g.fill();
      const vert = edge('n') === T.FENCE || edge('s') === T.FENCE;
      g.fillStyle = '#5e3a17';
      if (!vert) {
        g.fillRect(dx, dy + 9, ts, 5); g.fillRect(dx, dy + 20, ts, 5);
        g.fillStyle = '#8a5a2b';
        g.fillRect(dx, dy + 9, ts, 2); g.fillRect(dx, dy + 20, ts, 2);
        g.fillStyle = '#3a2410';
        g.fillRect(dx + 7, dy + 11, 1, 1); g.fillRect(dx + 24, dy + 22, 1, 1);
      } else {
        g.fillRect(dx + 9, dy, 5, ts); g.fillRect(dx + 20, dy, 5, ts);
        g.fillStyle = '#8a5a2b';
        g.fillRect(dx + 9, dy, 2, ts); g.fillRect(dx + 20, dy, 2, ts);
      }
      // mourões com ponta + anel
      for (const mx of [4, 23]) {
        g.fillStyle = '#5e3a17'; g.fillRect(dx + mx, dy + 5, 5, 23);
        g.fillStyle = '#8a5a2b'; g.fillRect(dx + mx, dy + 5, 5, 3);
        g.beginPath(); g.moveTo(dx + mx, dy + 5); g.lineTo(dx + mx + 2.5, dy + 1); g.lineTo(dx + mx + 5, dy + 5); g.closePath();
        g.fillStyle = '#8a5a2b'; g.fill();
        g.fillStyle = '#3a2410'; g.fillRect(dx + mx, dy + 12, 5, 1);
      }
      break;
    }
    case T.LAMP: {
      // LAMPIÃO vitoriano: poste de ferro, lanterna de vidro e poça de luz.
      g.fillStyle = '#c7c9bb'; g.fillRect(dx, dy, ts, ts);
      g.fillStyle = '#a8aa9c';
      g.fillRect(dx, dy + 15, ts, 2);
      // poça de luz quente no chão
      const flick = 0.5 + 0.18 * Math.sin(time * 3.2 + x * 2 + y);
      g.fillStyle = `rgba(255,215,94,${(0.22 + flick * 0.2).toFixed(2)})`;
      g.beginPath(); g.ellipse(dx + 16, dy + 26, 12, 5, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(0,0,0,.22)';
      g.beginPath(); g.ellipse(dx + 16, dy + 29, 8, 2.5, 0, 0, 7); g.fill();
      // base ornamental do poste
      g.fillStyle = '#2a2a3a'; g.fillRect(dx + 11, dy + 24, 10, 5);
      g.fillStyle = '#565b68'; g.fillRect(dx + 11, dy + 24, 10, 2);
      g.fillRect(dx + 13, dy + 22, 6, 3);
      // fuste com anéis
      g.fillStyle = '#2a2a3a'; g.fillRect(dx + 14, dy + 11, 4, 12);
      g.fillStyle = '#565b68'; g.fillRect(dx + 14, dy + 15, 4, 1); g.fillRect(dx + 14, dy + 19, 4, 1);
      // halo
      g.fillStyle = 'rgba(255,215,94,.20)'; g.fillRect(dx + 4, dy, 24, 14);
      // chapéu + vidro + chama
      g.fillStyle = '#2a2a3a';
      g.beginPath(); g.moveTo(dx + 8, dy + 4); g.lineTo(dx + 16, dy - 1); g.lineTo(dx + 24, dy + 4); g.closePath(); g.fill();
      g.fillStyle = '#2a2a3a'; g.fillRect(dx + 10, dy + 4, 12, 8);
      g.fillStyle = '#ffd75e'; g.fillRect(dx + 12, dy + 6, 8, 4);
      const fl2 = Math.sin(time * 8 + x * 4) * 0.8;
      g.fillStyle = '#fff3c4'; g.fillRect(dx + 14, dy + 6 + fl2 * 0.4, 4, 3);
      g.fillStyle = '#ff7b2e'; g.fillRect(dx + 15, dy + 8, 2, 1);
      g.fillStyle = '#2a2a3a'; g.fillRect(dx + 10, dy + 11, 12, 2);
      break;
    }
    case T.WELL: {
      // POÇO: anel de pedra, água no fundo, trave com corda + balde e telhadinho.
      g.fillStyle = '#c7c9bb'; g.fillRect(dx, dy, ts, ts);
      g.fillStyle = '#a8aa9c'; g.fillRect(dx, dy + 15, ts, 2);
      g.fillStyle = 'rgba(0,0,0,.25)';
      g.beginPath(); g.ellipse(dx + 16, dy + 28, 12, 3, 0, 0, 7); g.fill();
      // anel de pedra com juntas
      g.fillStyle = '#565664';
      g.beginPath(); g.ellipse(dx + 16, dy + 22, 11, 6, 0, 0, 7); g.fill();
      g.fillStyle = '#8d8d99';
      g.beginPath(); g.ellipse(dx + 16, dy + 20.5, 11, 6, 0, 0, 7); g.fill();
      g.fillStyle = '#b5b5c2';
      g.beginPath(); g.ellipse(dx + 16, dy + 19, 11, 4.5, 0, Math.PI, 0); g.fill();
      // água escura com reflexo
      g.fillStyle = '#0e2a4a';
      g.beginPath(); g.ellipse(dx + 16, dy + 19.5, 7.5, 3.2, 0, 0, 7); g.fill();
      g.fillStyle = `rgba(127,168,217,${(0.5 + 0.3 * Math.sin(time * 2 + x)).toFixed(2)})`;
      g.fillRect(dx + 12, dy + 18, 5, 1);
      // tijolos do anel
      g.fillStyle = '#6e6e7a';
      g.fillRect(dx + 7, dy + 20, 2, 3); g.fillRect(dx + 16, dy + 22, 2, 3); g.fillRect(dx + 23, dy + 20, 2, 3);
      // postes + trave + corda + balde
      g.fillStyle = '#5e3a17';
      g.fillRect(dx + 6, dy + 2, 3, 15); g.fillRect(dx + 23, dy + 2, 3, 15);
      g.fillStyle = '#8a5a2b'; g.fillRect(dx + 6, dy + 2, 1, 15);
      g.fillStyle = '#4a2f14'; g.fillRect(dx + 6, dy + 6, 20, 2);
      g.fillStyle = '#c9b896'; g.fillRect(dx + 15, dy + 8, 1, 8); // corda
      g.fillStyle = '#8a5a2b'; g.fillRect(dx + 12, dy + 15, 7, 5); // balde
      g.fillStyle = '#5e3a17'; g.fillRect(dx + 12, dy + 15, 7, 1); g.fillRect(dx + 12, dy + 19, 7, 1);
      g.fillStyle = '#3a3a48'; g.fillRect(dx + 12, dy + 17, 7, 1);
      // telhadinho com cumeeira
      g.fillStyle = '#8c2b2b';
      g.beginPath(); g.moveTo(dx + 3, dy + 5); g.lineTo(dx + 16, dy - 4); g.lineTo(dx + 29, dy + 5); g.closePath(); g.fill();
      g.fillStyle = '#d46969';
      g.beginPath(); g.moveTo(dx + 3, dy + 5); g.lineTo(dx + 16, dy - 4); g.lineTo(dx + 12, dy + 5); g.closePath(); g.fill();
      g.fillStyle = '#5e3a17'; g.fillRect(dx + 3, dy + 5, 26, 1);
      break;
    }
    case T.SIGN: {
      // PLACA indicativa: mourão + seta de madeira com texto e pregos.
      g.fillStyle = '#4da64d'; g.fillRect(dx, dy, ts, ts);
      g.fillStyle = 'rgba(0,0,0,.2)';
      g.beginPath(); g.ellipse(dx + 16, dy + 29, 7, 2.5, 0, 0, 7); g.fill();
      g.fillStyle = '#5e3a17'; g.fillRect(dx + 14, dy + 12, 4, 17);
      g.fillStyle = '#8a5a2b'; g.fillRect(dx + 14, dy + 12, 1, 17);
      // tábua em forma de seta para a direita
      g.fillStyle = '#5e3a17';
      g.beginPath(); g.moveTo(dx + 4, dy + 4); g.lineTo(dx + 24, dy + 4); g.lineTo(dx + 29, dy + 9); g.lineTo(dx + 24, dy + 14); g.lineTo(dx + 4, dy + 14); g.closePath(); g.fill();
      g.fillStyle = '#c49a5e';
      g.beginPath(); g.moveTo(dx + 5, dy + 5); g.lineTo(dx + 23, dy + 5); g.lineTo(dx + 27, dy + 9); g.lineTo(dx + 23, dy + 13); g.lineTo(dx + 5, dy + 13); g.closePath(); g.fill();
      // "texto" + pregos
      g.fillStyle = '#5e3a17';
      g.fillRect(dx + 8, dy + 7, 9, 1); g.fillRect(dx + 8, dy + 10, 13, 1);
      g.fillStyle = '#3a3a48';
      g.fillRect(dx + 6, dy + 8, 1, 1); g.fillRect(dx + 22, dy + 8, 1, 1);
      break;
    }
    case T.CRATE: {
      g.fillStyle = '#c9a86a'; g.fillRect(dx, dy, ts, ts);
      g.fillStyle = 'rgba(0,0,0,.22)';
      g.fillRect(dx + 7, dy + 27, 18, 3);
      g.fillStyle = '#a8763e'; g.fillRect(dx + 6, dy + 9, 20, 18);
      g.fillStyle = '#6e451f';
      g.fillRect(dx + 6, dy + 9, 20, 2); g.fillRect(dx + 6, dy + 25, 20, 2);
      g.fillRect(dx + 6, dy + 9, 2, 18); g.fillRect(dx + 24, dy + 9, 2, 18);
      g.fillRect(dx + 6, dy + 17, 20, 2);
      g.fillStyle = '#c49a5e'; g.fillRect(dx + 8, dy + 11, 8, 2);
      break;
    }
    case T.SOIL: {
      // CANTEIRO da fazenda: leiras de terra com fileiras de mudinhas verdes.
      g.fillStyle = '#5e4028'; g.fillRect(dx, dy, ts, ts);
      for (let r = 0; r < 4; r++) {
        const ry = dy + 3 + r * 8;
        g.fillStyle = '#4a3220'; g.fillRect(dx, ry, ts, 4); // sulco
        g.fillStyle = '#7a5a38'; g.fillRect(dx, ry + 4, ts, 2); // leira iluminada
        g.fillStyle = '#3a2412'; g.fillRect(dx, ry + 3, ts, 1);
      }
      // mudinhas em 2 fileiras alternadas (lê-se como plantação, não terra vazia)
      const sway = Math.sin(time * 2 + x * 1.5 + y) * 0.8;
      for (const [sx, sy] of [[8, 6], [16, 6], [24, 6], [12, 14], [20, 14], [8, 22], [16, 22], [24, 22]]) {
        const jx = dx + sx + (h > 0.5 && sx > 16 ? 1 : 0);
        g.fillStyle = '#2e7d32';
        g.fillRect(jx, dy + sy, 2, 5);
        g.fillStyle = '#63c763';
        g.fillRect(jx - 1 + sway, dy + sy - 1, 2, 2);
        g.fillRect(jx + 1 + sway, dy + sy + 1, 2, 2);
      }
      // regador? respingos de água ocasionais
      if (h2 > 0.8) { g.fillStyle = 'rgba(127,168,217,.8)'; g.fillRect(dx + 14, dy + 10, 2, 1); g.fillRect(dx + 20, dy + 18, 2, 1); }
      for (const d of ['n', 's', 'w', 'e']) if (GRASSY.has(edge(d))) strip(d, 3, '#4a3220');
      break;
    }
    case T.MOUNTAIN: {
      g.fillStyle = '#4da64d'; g.fillRect(dx, dy, ts, ts);
      // massa rochosa com contorno escuro
      g.fillStyle = '#4a4a58';
      g.beginPath();
      g.moveTo(dx + 1, dy + 32); g.lineTo(dx + 9, dy + 11);
      g.lineTo(dx + 16, dy + 4); g.lineTo(dx + 24, dy + 12);
      g.lineTo(dx + 31, dy + 32); g.closePath(); g.fill();
      g.fillStyle = '#8d8d99';
      g.beginPath();
      g.moveTo(dx + 3, dy + 32); g.lineTo(dx + 10, dy + 12);
      g.lineTo(dx + 16, dy + 6); g.lineTo(dx + 23, dy + 13);
      g.lineTo(dx + 29, dy + 32); g.closePath(); g.fill();
      g.fillStyle = '#6e6e7a';
      g.beginPath();
      g.moveTo(dx + 16, dy + 6); g.lineTo(dx + 23, dy + 13);
      g.lineTo(dx + 29, dy + 32); g.lineTo(dx + 16, dy + 32); g.closePath(); g.fill();
      // neve no pico
      g.fillStyle = '#f2f4ff';
      g.beginPath();
      g.moveTo(dx + 12, dy + 11); g.lineTo(dx + 16, dy + 6); g.lineTo(dx + 20, dy + 11);
      g.lineTo(dx + 18, dy + 10); g.lineTo(dx + 16, dy + 12); g.lineTo(dx + 14, dy + 10);
      g.closePath(); g.fill();
      // tufos na base
      g.fillStyle = '#3f9142';
      g.fillRect(dx + 2, dy + 28, 4, 4); g.fillRect(dx + 27, dy + 29, 4, 3);
      break;
    }
    default:
      g.fillStyle = '#f0f'; g.fillRect(dx, dy, ts, ts);
  }
}

/**
 * Desenha SÓ a copa de árvore/pinheiro (passe de oclusão, após os atores).
 * @param {CanvasRenderingContext2D} g
 */
export function drawCanopyTop(g, t, dx, dy, ts, x, y, time) {
  const h = hash2(x, y);
  const h2 = hash2(x + 57, y + 131);
  const sway = Math.sin(time * 1.4 + x * 0.9 + y) * 1.2;
  if (t === T.TREE) {
    // COPA frondosa: contorno + 3 tons + pontos de luz + maçãs com brilho.
    g.fillStyle = '#1e5b20';
    g.beginPath(); g.arc(dx + 16 + sway, dy + 12, 14, 0, 7); g.fill();
    g.fillStyle = h > 0.5 ? '#2e7d32' : '#35923b';
    g.beginPath(); g.arc(dx + 16 + sway, dy + 12, 12, 0, 7); g.fill();
    g.fillStyle = '#1e5b20'; // reentrâncias da copa
    g.beginPath(); g.arc(dx + 9 + sway, dy + 15, 4, 0, 7); g.fill();
    g.beginPath(); g.arc(dx + 23 + sway, dy + 15, 4, 0, 7); g.fill();
    g.fillStyle = '#43a047';
    g.beginPath(); g.arc(dx + 11 + sway, dy + 8, 6, 0, 7); g.fill();
    g.beginPath(); g.arc(dx + 20 + sway, dy + 10, 5, 0, 7); g.fill();
    g.fillStyle = '#66bb6a';
    g.fillRect(dx + 9 + sway, dy + 4, 4, 3); g.fillRect(dx + 19 + sway, dy + 6, 3, 3);
    g.fillRect(dx + 13 + sway, dy + 7, 2, 2); g.fillRect(dx + 22 + sway, dy + 10, 2, 2);
    // maçãs com brilho
    if (h2 > 0.6) {
      g.fillStyle = '#c22a3a';
      g.fillRect(dx + 12 + sway, dy + 12, 3, 3);
      g.fillRect(dx + 20 + sway, dy + 14, 3, 3);
      g.fillStyle = '#ff9db3';
      g.fillRect(dx + 12 + sway, dy + 12, 1, 1);
      g.fillRect(dx + 20 + sway, dy + 14, 1, 1);
    }
  } else if (t === T.PINE) {
    // PINHEIRO em 3 andares: topo + 2 saias, com neve de luz e pinhas.
    const cx = dx + 16 + sway;
    g.fillStyle = '#14351f';
    g.beginPath(); g.moveTo(cx, dy - 2); g.lineTo(cx + 13, dy + 10); g.lineTo(cx - 13, dy + 10); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(cx, dy + 4); g.lineTo(cx + 14, dy + 18); g.lineTo(cx - 14, dy + 18); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(cx, dy + 12); g.lineTo(cx + 13, dy + 25); g.lineTo(cx - 13, dy + 25); g.closePath(); g.fill();
    g.fillStyle = '#1e4d2b';
    g.beginPath(); g.moveTo(cx, dy - 1); g.lineTo(cx + 11, dy + 9); g.lineTo(cx - 11, dy + 9); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(cx, dy + 5); g.lineTo(cx + 12, dy + 17); g.lineTo(cx - 12, dy + 17); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(cx, dy + 13); g.lineTo(cx + 11, dy + 24); g.lineTo(cx - 11, dy + 24); g.closePath(); g.fill();
    // luz lateral + neve nos galhos
    g.fillStyle = '#2e7d5b';
    g.beginPath(); g.moveTo(cx - 1, dy + 2); g.lineTo(cx + 4, dy + 9); g.lineTo(cx - 6, dy + 9); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(cx - 1, dy + 9); g.lineTo(cx + 5, dy + 17); g.lineTo(cx - 7, dy + 17); g.closePath(); g.fill();
    g.fillStyle = '#48a07e';
    g.fillRect(cx - 3, dy + 6, 3, 2); g.fillRect(cx - 4, dy + 14, 3, 2);
    g.fillStyle = '#6e451f'; // pinhas
    if (h > 0.45) { g.fillRect(cx - 5, dy + 15, 3, 4); g.fillRect(cx + 3, dy + 19, 3, 4); }
  }
}
