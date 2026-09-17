/**
 * MapData — construção procedural + artesanal do mapa-múndi de Valoria (64x48).
 * Regiões: vila, planície, bosque, ruínas e altar do boss.
 * @module world/MapData
 */
import { T } from './Tiles.js';
import { MAP_W, MAP_H } from '../core/Config.js';
import { hash2 } from './Tiles.js';

/** Posição inicial do jogador (em tiles). */
export const SPAWN = { x: 14, y: 38 };
/** Tile do altar do boss. */
export const BOSS_ALTAR = { x: 54, y: 6 };
/** Brinquedo perdido do Pip (quest). */
export const TOY_SPOT = { x: 32, y: 22 };
/** Cristal restaurador nas ruínas (cura total). */
export const HEAL_CRYSTAL = { x: 54, y: 15 };
/** Baús do tesouro: {id, x, y, loot:{gold, items}}. Abertura é salva em flags. */
export const CHESTS = [
  { id: 'plain', x: 28, y: 32, loot: { gold: 80, items: { potion: 1 } } },
  { id: 'forest', x: 5, y: 9, loot: { gold: 40, items: { ether: 1, antidote: 1 } } },
  { id: 'ruin', x: 53, y: 11, loot: { gold: 150, items: { hipotion: 1 } } },
  { id: 'desert', x: 74, y: 38, loot: { gold: 120, items: { ether: 1 } } },
];
/** Meta da quest de caça do Guarda Cato (slimes derrotados). */
export const HUNT_GOAL = 6;

/** @returns {{tiles: Uint8Array, w: number, h: number}} */
export function buildMap() {
  const w = MAP_W, h = MAP_H;
  const tiles = new Uint8Array(w * h);
  const set = (x, y, t) => { if (x >= 0 && y >= 0 && x < w && y < h) tiles[y * w + x] = t; };
  const get = (x, y) => tiles[y * w + x];
  const rect = (x0, y0, x1, y1, t) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, t); };

  // base: grama + variações
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const r = hash2(x * 3 + 1, y * 3 + 7);
    set(x, y, r > 0.9 ? T.FLOWER : T.GRASS);
  }

  // manchas de grama alta (encontros) na planície central
  for (let y = 14; y < 34; y++) for (let x = 20; x < 44; x++) {
    if (hash2(x, y * 2) > 0.55) set(x, y, T.TALL_GRASS);
  }
  // bosque sombrio (noroeste, maior): grama escura + pinheiros
  for (let y = 3; y < 20; y++) for (let x = 2; x < 19; x++) {
    const r = hash2(x * 5, y * 5 + 3);
    if (r > 0.45) set(x, y, T.DARK_GRASS);
    if (r > 0.82) set(x, y, T.PINE);
  }
  // bosque profundo (leste): outro braço do bosque, além das ruínas
  for (let y = 2; y < 16; y++) for (let x = 63; x < 80; x++) {
    const r = hash2(x * 5 + 9, y * 5 + 1);
    if (r > 0.45) set(x, y, T.DARK_GRASS);
    if (r > 0.82) set(x, y, T.PINE);
  }
  // ruínas (nordeste): chão sombrio + pedras
  for (let y = 3; y < 15; y++) for (let x = 47; x < 62; x++) {
    const r = hash2(x * 7 + 2, y * 7);
    if (r > 0.35) set(x, y, T.DARK_GRASS);
    if (r > 0.86) set(x, y, T.RUIN);
  }

  // rio vertical x=44..45, com ponte em y=29..30 e segunda ponte ao sul (y=52..53)
  for (let y = 0; y < h; y++) { set(44, y, T.WATER); set(45, y, T.WATER); }
  set(44, 29, T.BRIDGE); set(45, 29, T.BRIDGE);
  set(44, 30, T.BRIDGE); set(45, 30, T.BRIDGE);
  set(44, 52, T.BRIDGE); set(45, 52, T.BRIDGE);
  set(44, 53, T.BRIDGE); set(45, 53, T.BRIDGE);
  // margens de areia
  for (let y = 0; y < h; y++) {
    if (get(43, y) !== T.BRIDGE && get(43, y) === T.GRASS && hash2(43, y) > 0.4) set(43, y, T.SAND);
    if (get(46, y) !== T.BRIDGE && get(46, y) === T.GRASS && hash2(46, y) > 0.4) set(46, y, T.SAND);
  }

  // caminho: vila -> ponte -> ruínas
  const pathH = (x0, x1, y) => { for (let x = x0; x <= x1; x++) if (get(x, y) !== T.WATER && get(x, y) !== T.BRIDGE) set(x, y, T.PATH); };
  const pathV = (y0, y1, x) => { for (let y = y0; y <= y1; y++) if (get(x, y) !== T.WATER) set(x, y, T.PATH); };
  pathH(10, 43, 30); pathH(46, 54, 29);
  pathV(15, 30, 54); pathV(30, 40, 14);
  // caminhos do sul e do deserto (ponte sul -> praia/deserto, trilha do oásis)
  pathH(43, 66, 52); pathH(54, 66, 29);
  pathV(28, 54, 66); pathV(44, 54, 12);

  // ---- Vila Lumen (sudoeste): fileiras simétricas + praça central ----
  rect(7, 33, 21, 43, T.PATH);
  // casas (5x4: telhado, parede, parede/porta)
  const house = (hx, hy) => {
    rect(hx, hy, hx + 4, hy + 1, T.ROOF);
    rect(hx, hy + 2, hx + 4, hy + 3, T.WALL);
    set(hx + 2, hy + 3, T.DOOR);
    set(hx, hy + 2, T.WALL); set(hx + 4, hy + 2, T.WALL);
  };
  house(8, 34); house(15, 34);   // fileira norte (portas em 10,37 e 17,37)
  house(8, 40); house(15, 40);   // fileira sul (portas em 10,43 e 17,43)
  // praça de pedra + canteiros simétricos
  rect(12, 38, 17, 39, T.PLAZA);
  set(11, 38, T.FLOWER); set(18, 38, T.FLOWER);
  set(11, 39, T.FLOWER); set(18, 39, T.FLOWER);
  // rochedos decorativos no campo (fora de caminhos)
  set(24, 19, T.STONE); set(37, 25, T.STONE); set(29, 33, T.STONE);
  // clareiras no bosque
  const blob = (cx, cy, r, t, only) => {
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
      if (Math.hypot(x - cx, y - cy) > r + 0.4) continue;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      if (!only || only.includes(get(x, y))) set(x, y, t);
    }
  };
  blob(6, 8, 2, T.GRASS); blob(13, 12, 2, T.GRASS);
  // canteiros de flores na planície (só sobre grama)
  const soft = [T.GRASS, T.TALL_GRASS, T.FLOWER];
  blob(25, 20, 2, T.FLOWER, soft); blob(35, 27, 2, T.FLOWER, soft); blob(28, 32, 1, T.FLOWER, soft);
  // lagoa com vitórias-régias + manchas de terra batida
  blob(36, 20, 1, T.WATER, soft);
  blob(27, 24, 1, T.PATH, soft); blob(38, 31, 1, T.PATH, soft);
  // pilares simétricos na entrada das ruínas
  set(52, 12, T.RUIN); set(56, 12, T.RUIN);
  set(52, 16, T.RUIN); set(56, 16, T.RUIN);
  // cerca de árvores ao redor da vila
  for (let x = 6; x <= 22; x++) { if (hash2(x, 1) > 0.35 && get(x, 32) === T.GRASS) set(x, 32, T.TREE); if (hash2(x, 2) > 0.35 && get(x, 44) === T.GRASS) set(x, 44, T.TREE); }
  for (let y = 33; y <= 43; y++) { if (hash2(3, y) > 0.4 && get(6, y) === T.GRASS) set(6, y, T.TREE); if (hash2(4, y) > 0.4 && get(22, y) === T.GRASS) set(22, y, T.TREE); }
  // portal norte da vila (pilares de pedra + caminho garantido)
  set(14, 32, T.PATH);
  set(13, 32, T.STONE); set(15, 32, T.STONE);
  // cerca viva do portal + placa indicativa
  set(11, 32, T.FENCE); set(12, 32, T.FENCE);
  set(16, 32, T.FENCE); set(17, 32, T.SIGN);
  // praça: postes nos cantos e caixas da loja (o poço saiu do centro → leste da vila)
  set(13, 38, T.PLAZA);
  set(12, 39, T.LAMP); set(17, 39, T.LAMP);
  set(19, 38, T.CRATE); set(19, 39, T.CRATE);
  // poço realocado: leste da vila, fora da praça central
  set(21, 41, T.WELL);
  // fazenda a oeste (solo arado cercado, com entrada ao sul)
  rect(3, 37, 4, 38, T.SOIL);
  for (let x = 2; x <= 5; x++) set(x, 36, T.FENCE);
  set(2, 37, T.FENCE); set(5, 37, T.FENCE);
  set(2, 38, T.FENCE); set(5, 38, T.FENCE);
  set(2, 39, T.FENCE); set(5, 39, T.FENCE);

  // ---- Bioma praia (sul, maior): areia, conchas e palmeiras. Zona calma, ótima p/ pesca ----
  for (let y = 44; y <= 52; y++) for (let x = 24; x <= 42; x++) {
    if (get(x, y) === T.WATER || get(x, y) === T.PATH) continue;
    set(x, y, hash2(x * 11 + 5, y * 13) > 0.78 ? T.GRASS : T.SAND);
  }
  set(26, 44, T.PALM); set(32, 45, T.PALM); set(39, 44, T.PALM);
  set(30, 49, T.PALM); set(37, 50, T.PALM);
  // ---- Bioma neve (norte, maior): campo nevado com pinheiros. Encontros mais duros ----
  for (let y = 2; y <= 4; y++) for (let x = 18; x <= 46; x++) {
    if (get(x, y) === T.WATER) continue;
    set(x, y, T.SNOW);
  }
  for (let x = 19; x <= 45; x += 3) { if (hash2(x, 77) > 0.35 && get(x, 2) !== T.WATER) set(x, 2, T.PINE); }
  set(24, 3, T.PINE); set(36, 3, T.PINE); set(30, 4, T.PINE);
  // ---- Bioma pântano (sudoeste): água rasa, juncos e árvores mortas ----
  for (let y = 46; y <= 56; y++) for (let x = 3; x <= 22; x++) {
    if (get(x, y) === T.WATER || get(x, y) === T.PATH) continue;
    const r = hash2(x * 9 + 4, y * 7 + 2);
    if (r > 0.72) set(x, y, T.SWAMP);
    else if (r > 0.4) set(x, y, T.DARK_GRASS);
    else set(x, y, T.GRASS);
  }
  blob(9, 50, 2, T.WATER, [T.SWAMP, T.DARK_GRASS, T.GRASS]);
  blob(17, 52, 1, T.WATER, [T.SWAMP, T.DARK_GRASS, T.GRASS]);
  for (let y = 47; y <= 55; y++) for (let x = 4; x <= 21; x++) {
    const t = get(x, y);
    if ((t === T.SWAMP || t === T.DARK_GRASS) && hash2(x * 5 + 8, y * 3 + 6) > 0.86) set(x, y, T.DEAD_TREE);
  }
  // ---- Bioma deserto (leste): dunas, cactos e um oásis ----
  for (let y = 16; y <= 56; y++) for (let x = 58; x <= 78; x++) {
    if (get(x, y) === T.WATER || get(x, y) === T.PATH) continue;
    set(x, y, hash2(x * 13 + 3, y * 11 + 9) > 0.62 ? T.DUNE : T.SAND);
  }
  for (let y = 18; y <= 54; y++) for (let x = 59; x <= 77; x++) {
    if (get(x, y) !== T.SAND) continue;
    const r = hash2(x * 7 + 11, y * 5 + 1);
    if (r > 0.88) set(x, y, T.CACTUS);
    else if (r < 0.04) set(x, y, T.STONE);
  }
  // oásis com palmeiras (limpa cactos da lagoa)
  blob(70, 42, 2, T.WATER, [T.SAND, T.DUNE]);
  for (let y = 39; y <= 45; y++) for (let x = 67; x <= 73; x++) {
    if (get(x, y) === T.CACTUS && Math.hypot(x - 70, y - 42) < 3.4) set(x, y, T.SAND);
  }
  set(68, 40, T.PALM); set(72, 40, T.PALM); set(68, 44, T.PALM); set(72, 44, T.PALM);

  // ---- Baús: garante chão pisável no tile e ao redor (ruína) ----
  set(28, 32, T.GRASS);
  set(5, 9, T.GRASS);
  set(53, 11, T.DARK_GRASS);
  set(52, 11, T.DARK_GRASS); set(53, 10, T.DARK_GRASS); set(53, 12, T.DARK_GRASS);
  set(74, 38, T.SAND);

  // ---- Altar do Caos (norte das ruínas) ----
  rect(51, 3, 57, 8, T.FLOOR);
  set(BOSS_ALTAR.x, BOSS_ALTAR.y, T.ALTAR);
  set(BOSS_ALTAR.x - 2, BOSS_ALTAR.y + 3, T.RUIN);
  set(BOSS_ALTAR.x + 2, BOSS_ALTAR.y + 3, T.RUIN);

  // bordas do mundo: água + fileira de MONTANHAS ao norte + pinheiros
  for (let x = 0; x < w; x++) { set(x, 0, T.WATER); set(x, h - 1, T.WATER); set(x, h - 2, T.PINE); }
  for (let y = 0; y < h; y++) { set(0, y, T.WATER); set(w - 1, y, T.WATER); set(1, y, T.PINE); set(w - 2, y, T.PINE); }
  for (let x = 2; x < w - 2; x++) {
    if (x === 44 || x === 45) { set(x, 1, T.WATER); continue; } // o rio desce do norte
    set(x, 1, T.MOUNTAIN);
  }

  return { tiles, w, h };
}

/**
 * Região de um tile (para música, nome do local e tabela de encontros).
 * @param {number} tx @param {number} ty
 */
export function regionAt(tx, ty) {
  if (tx >= 51 && tx <= 57 && ty >= 3 && ty <= 8) return 'altar';
  if (tx >= 63 && ty <= 15) return 'forest';
  if (tx >= 47 && ty <= 15) return 'dungeon';
  if (ty >= 2 && ty <= 4 && tx >= 18 && tx <= 46) return 'snow';
  if (tx <= 18 && ty <= 19) return 'forest';
  if (tx >= 7 && tx <= 22 && ty >= 32 && ty <= 44) return 'town';
  if (tx >= 3 && tx <= 22 && ty >= 46 && ty <= 56) return 'swamp';
  if (ty >= 44 && ty <= 53 && tx >= 23 && tx <= 43) return 'beach';
  if (tx >= 58 && ty >= 16) return 'desert';
  if (tx >= 20 && tx <= 46 && ty >= 14 && ty <= 34) return 'field';
  return 'field';
}

/** Definições dos NPCs: posição em tiles, sprite, nome e diálogo. */
export const NPC_DEFS = [
  {
    id: 'elder', x: 14, y: 36, name: 'Ancião Theo', kind: 'elder', wander: false,
    lines: [
      'Ah... o Cristal de Lumen enfraquece a cada lua.',
      'O Dragão do Caos aninhou-se nas RUÍNAS ao nordeste, além do rio. Atravesse a PONTE a leste!',
      'Treine na grama alta da planície, junte ouro e visite a loja da Mira. E descanse na estalagem antes de partir.',
    ],
  },
  {
    id: 'shop', x: 17, y: 37, name: 'Mira (Loja)', kind: 'merchant', wander: false, shop: true,
    lines: ['Bem-vindo à minha lojinha! Ouro na mão, poção na sacola!'],
  },
  {
    id: 'inn', x: 13, y: 42, name: 'Bram (Estalagem)', kind: 'innkeep', wander: false, inn: true,
    lines: ['Cama quente e ensopado por 20G. Descansar é coisa de herói esperto!'],
  },
  {
    id: 'kid', x: 14, y: 39, name: 'Pip', kind: 'kid', wander: true,
    lines: [
      'Eu vi um SLIME verde-água perto da ponte! Ele faz "blub blub"!',
      'Quando eu crescer vou ser Mago igual a Lyra!',
    ],
  },
  {
    id: 'guard', x: 43, y: 28, name: 'Guarda Cato', kind: 'guard', wander: false,
    lines: [
      'Alto lá! A ponte leva às Ruínas do Cristal.',
      'Só atravesse se seu grupo estiver pelo menos no nível 3. O bosque ao norte também esconde feras...',
    ],
  },
  {
    id: 'hermit', x: 54, y: 17, name: 'Eremita Sable', kind: 'hermit', wander: false,
    lines: [
      'O altar... eu sinto o hálito do Dragão daqui.',
      'Leve ÉTERES, use a magia CURA e guarde sua magia de FOGO para o fim. Que o cristal o proteja.',
    ],
    gift: 'ether',
  },
  {
    id: 'fisher', x: 30, y: 47, name: 'Pescador Kai', kind: 'fisher', wander: false,
    gift: 'fish',
    lines: [
      'Bom dia! Aqui na Praia do Sol a água é calma e o peixe morde fácil.',
      'Dizem que PÉROLAS aparecem na linha de quem pesca na praia... Tente a sorte encarando a água!',
    ],
  },
];
