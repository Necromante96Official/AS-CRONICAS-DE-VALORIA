/**
 * MapData — construção procedural + artesanal do mapa-múndi de Valoria (64x48).
 * Regiões: vila, planície, bosque, ruínas e altar do boss.
 * @module world/MapData
 */
import { T } from './Tiles.js';
import { MAP_W, MAP_H } from '../core/Config.js';
import { hash2 } from './Tiles.js';

/** Posição inicial do jogador (em tiles, centro da praça). */
export const SPAWN = { x: 15, y: 38 };
/** Tile do altar do boss. */
export const BOSS_ALTAR = { x: 54, y: 6 };
/** Brinquedo perdido do Pip (quest). */
export const TOY_SPOT = { x: 32, y: 22 };
/** Cristal restaurador nas ruínas (cura total). */
export const HEAL_CRYSTAL = { x: 54, y: 15 };
/** Baús do tesouro: {id, x, y, loot:{gold, items}}. Abertura é salva em flags. */
export const CHESTS = [
  { id: 'plain', x: 28, y: 32, loot: { gold: 80, items: { potion: 1, strongpotion: 1 } } },
  { id: 'forest', x: 5, y: 9, loot: { gold: 40, items: { ether: 1, antidote: 1 } } },
  { id: 'ruin', x: 53, y: 11, loot: { gold: 150, items: { hipotion: 1 } } },
  { id: 'desert', x: 74, y: 38, loot: { gold: 120, items: { ether: 1, megabomb: 1 } } },
  { id: 'swamp', x: 5, y: 54, loot: { gold: 90, items: { potion: 1, antidote: 1 } } },
  { id: 'snow', x: 40, y: 3, loot: { gold: 110, items: { hiether: 1 } } },
];
/** Meta da quest de caça do Guarda Cato (slimes derrotados). */
export const HUNT_GOAL = 6;
/** Meta da quest de ervas da Herbalista Yara (sapos e cogumelos do pântano). */
export const HERB_GOAL = 4;
/** Sentinela opcional do deserto: Golem Ancião (mini-chefe). */
export const ELITE = { x: 60, y: 20, name: 'GOLEM ANCIÃO' };

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
  pathV(15, 30, 54); pathV(30, 40, 15);
  // caminhos do sul e do deserto (ponte sul -> praia/deserto, trilha do oásis)
  pathH(43, 66, 52); pathH(54, 66, 29);
  pathV(28, 54, 66); pathV(44, 54, 12);

  // util de manchas (usado pela vila e pelos biomas)
  const blob = (cx, cy, r, t, only) => {
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
      if (Math.hypot(x - cx, y - cy) > r + 0.4) continue;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      if (!only || only.includes(get(x, y))) set(x, y, t);
    }
  };
  // ---- Vila Lumen (sudoeste, espaçosa): 4 casas visitáveis + praça central ----
  // terreno da vila: grama limpa + rua principal (leste-oeste) + rua central (norte-sul)
  rect(6, 30, 25, 47, T.GRASS);
  pathH(6, 25, 38); pathV(30, 47, 15); pathV(30, 47, 16);
  // casas espaçosas (6x2 telhado + 6x2 parede + porta). Portas:
  // ancião (10,34) · loja (21,34) · estalagem (10,45) · ferraria (21,45)
  const house6 = (hx, hy) => {
    rect(hx, hy, hx + 5, hy + 1, T.ROOF);
    rect(hx, hy + 2, hx + 5, hy + 3, T.WALL);
    set(hx + 3, hy + 3, T.DOOR);
  };
  house6(7, 31); house6(18, 31);   // fileira norte, com rua de 5 tiles entre elas
  house6(7, 42); house6(18, 42);   // fileira sul, quintal amplo no meio
  // praça central de pedra (encontro da rua principal com a rua central)
  rect(12, 36, 19, 40, T.PLAZA);
  // jardins e canteiros ao longo das ruas (respiro verde entre as casas)
  set(13, 36, T.FLOWER); set(18, 36, T.FLOWER);
  set(13, 40, T.FLOWER); set(18, 40, T.FLOWER);
  set(6, 37, T.FLOWER); set(25, 37, T.FLOWER);
  set(14, 31, T.FLOWER); set(17, 31, T.FLOWER);
  // floreiras simétricas na frente das casas + placas indicativas junto às portas
  set(7, 35, T.FLOWER); set(9, 35, T.FLOWER); set(11, 35, T.FLOWER);
  set(18, 35, T.FLOWER); set(20, 35, T.FLOWER); set(22, 35, T.FLOWER);
  set(7, 46, T.FLOWER); set(9, 46, T.FLOWER); set(11, 46, T.FLOWER);
  set(18, 46, T.FLOWER); set(20, 46, T.FLOWER); set(22, 46, T.FLOWER);
  set(8, 35, T.SIGN); set(12, 35, T.SIGN);
  set(19, 35, T.SIGN); set(23, 35, T.SIGN);
  set(8, 46, T.SIGN); set(12, 46, T.SIGN);
  set(19, 46, T.SIGN); set(23, 46, T.SIGN);
  // praça: postes nos 4 cantos, bancos de pedra e poço a leste (fora do fluxo)
  set(12, 36, T.LAMP); set(19, 36, T.LAMP);
  set(12, 40, T.LAMP); set(19, 40, T.LAMP);
  set(14, 39, T.STONE); set(17, 39, T.STONE); // bancos fora da rua principal
  set(22, 38, T.WELL);
  // mercadorias da loja expostas (caixas ao lado da porta nordeste)
  set(24, 34, T.CRATE); set(24, 35, T.CRATE);
  // lenha da ferraria (sudeste) + toneis da estalagem (sudoeste)
  set(24, 44, T.CRATE); set(24, 45, T.CRATE);
  set(6, 44, T.CRATE); set(6, 45, T.CRATE);
  // clareiras de grama entre quarteirões (piquenique)
  blob(14, 33, 1, T.FLOWER, [T.GRASS]); blob(17, 44, 1, T.FLOWER, [T.GRASS]);
  // rochedos decorativos no campo (fora de caminhos)
  set(30, 19, T.STONE); set(37, 25, T.STONE); set(29, 33, T.STONE);
  // clareiras no bosque
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
  // arvoredo ao redor da vila (mantém respiro: só fora do terreno 6..25 / 30..47)
  for (let x = 5; x <= 26; x++) {
    if (hash2(x, 11) > 0.35 && get(x, 29) === T.GRASS) set(x, 29, T.TREE);
    if (hash2(x, 12) > 0.35 && get(x, 48) === T.GRASS) set(x, 48, T.TREE);
  }
  for (let y = 30; y <= 47; y++) {
    if (hash2(13, y) > 0.4 && get(5, y) === T.GRASS) set(5, y, T.TREE);
    if (hash2(14, y) > 0.4 && get(26, y) === T.GRASS) set(26, y, T.TREE);
  }
  // portal norte da vila (rua central x=15..16, pilares + placa)
  set(15, 29, T.PATH); set(16, 29, T.PATH);
  set(14, 29, T.STONE); set(17, 29, T.STONE);
  set(13, 29, T.FENCE); set(18, 29, T.FENCE);
  set(12, 29, T.SIGN);
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
  set(5, 54, T.GRASS); // baú do pântano: terra firme no brejo
  set(5, 53, T.GRASS); set(6, 54, T.GRASS);
  set(40, 3, T.SNOW); // baú da neve: clareira pisável
  set(39, 3, T.SNOW); set(40, 4, T.SNOW);
  // ---- Clareiras dos NPCs externos (garante que ninguém nasce na água/pedra) ----
  set(15, 37, T.PLAZA); // Pip (praça)
  set(14, 39, T.PLAZA); // Felix, o bardo
  set(16, 39, T.PLAZA); // Mia
  set(43, 51, T.SAND); // Guarda Dina (ponte sul)
  set(33, 47, T.SAND); // Velho Tumba (praia)
  set(33, 3, T.SNOW); // Sábia Sella (neve)
  set(14, 49, T.DARK_GRASS); // Herbalista Yara (pântano)
  set(67, 41, T.SAND); // Eremita Ash (oásis)
  // ---- Clareira do Golem Ancião (deserto): sentinela + arredores pisáveis ----
  set(60, 20, T.SAND);
  set(59, 20, T.SAND); set(61, 20, T.SAND); set(60, 19, T.SAND); set(60, 21, T.SAND);

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
  if (tx >= 6 && tx <= 25 && ty >= 30 && ty <= 47) return 'town';
  if (tx >= 3 && tx <= 22 && ty >= 46 && ty <= 56) return 'swamp';
  if (ty >= 44 && ty <= 53 && tx >= 23 && tx <= 43) return 'beach';
  if (tx >= 58 && ty >= 16) return 'desert';
  if (tx >= 20 && tx <= 46 && ty >= 14 && ty <= 34) return 'field';
  return 'field';
}

/** Definições dos NPCs do MUNDO (externos). Donos de loja/estalagem/ferreiro e o
 * Ancião ficam DENTRO das casas — ver INTERIOR_NPCS. */
export const NPC_DEFS = [
  {
    id: 'kid', x: 15, y: 37, name: 'Pip', kind: 'kid', wander: true,
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
  {
    id: 'nomad', x: 66, y: 37, name: 'Nômade Zara', kind: 'nomad', wander: false, shop: true,
    lines: ['O deserto me dá de tudo! Pena de Fênix fresquinha, quem vai querer?'],
  },
  {
    id: 'hunter', x: 30, y: 2, name: 'Caçadora Liv', kind: 'hunter', wander: false,
    gift: 'antidote',
    lines: [
      'Frio bom p/ caçar! Fagulhas rondam a neve — chegue perto e seja rápido.',
      'Se for ao pântano, cuidado com os Cogumelos: eles se curam com esporos!',
    ],
  },
  {
    id: 'bard', x: 13, y: 39, name: 'Felix, o Bardo', kind: 'bard', wander: true,
    lines: [
      '♪ Na planície o slime pulou, na ruína o golem rolou... ♪',
      '♪ Quem o Ancião de pedra calar, no deserto há de penar... Golem Ancião, dizem! ♪',
      '♪ E a Sella, sábia do frio, viu lobo branco no Pico... auuu! ♪',
    ],
  },
  {
    id: 'mia', x: 16, y: 39, name: 'Mia', kind: 'kid', wander: true,
    lines: [
      'O Pip disse que o boneco dele BRILHA! Eu também perdi... minha concha da praia!',
      'A mamãe diz que o pântano tem luzinhas verdes que enganam viajante. Não siga as luzinhas!',
    ],
  },
  {
    id: 'guardS', x: 43, y: 51, name: 'Guarda Dina', kind: 'guard', wander: false,
    lines: [
      'Ponte sul liberada! Praia p/ descansar, deserto p/ enriquecer — e pântano p/ se perder.',
      'A Yara, herbalista do pântano, paga bem por ajuda contra os sapos gigantes. Procure-a a sudoeste!',
    ],
  },
  {
    id: 'sailor', x: 33, y: 47, name: 'Velho Tumba', kind: 'sailor', wander: false,
    gift: 'lambari',
    lines: [
      'Trinta anos de mar... e o maior peixe que vi foi o DOURADO LENDÁRIO, sombra G na água!',
      'Dizem que um PEIXE REAL alimenta uma vila inteira. Traga um para este velho e conto onde escondi minhas economias...',
    ],
  },
  {
    id: 'sage', x: 33, y: 3, name: 'Sábia Sella', kind: 'sage', wander: false,
    gift: 'ether',
    lines: [
      'O frio conserva o cristal... e os lobos. Os LOBOS DA NEVE caçam em matilha — derrote o mais rápido primeiro.',
      'Esqueletos rondam as Ruínas: ossos velhos, ódio novo. GELO os torna lentos... dizem os pergaminhos.',
    ],
  },
  {
    id: 'herbalist', x: 14, y: 49, name: 'Herbalista Yara', kind: 'herbalist', wander: false,
    lines: [
      'Minhas ervas somem na gosma dos SAPOS! Derrote 4 sapos do pântano e eu pago com meu melhor tônico.',
      'Sapo inchado anuncia chuva... e língua comprida. Bata primeiro, pergunte depois!',
    ],
  },
  {
    id: 'oasis', x: 67, y: 41, name: 'Eremita Ash', kind: 'hermit', wander: false,
    gift: 'phoenix',
    lines: [
      'O oásis me escondeu do Golem Ancião... aquele colosso a noroeste daqui não dorme nunca.',
      'Orcs do deserto bebem desta água. Se for enfrentá-los, leve BOMBAS — o Rurik vende.',
    ],
  },
];

/** Casas visitáveis da Vila Lumen: porta externa (mundo) → interior.
 * door = tile da porta; front = tile em frente à porta (retorno ao sair). */
export const HOUSES = [
  { id: 'elder', name: 'Casa do Ancião', door: { x: 10, y: 34 }, front: { x: 10, y: 35 } },
  { id: 'shop', name: 'Loja da Mira', door: { x: 21, y: 34 }, front: { x: 21, y: 35 } },
  { id: 'inn', name: 'Estalagem do Bram', door: { x: 10, y: 45 }, front: { x: 10, y: 46 } },
  { id: 'smith', name: 'Ferraria do Rurik', door: { x: 21, y: 45 }, front: { x: 21, y: 46 } },
];

/** Dimensões dos interiores (tiles). */
export const INTERIOR_W = 22;
export const INTERIOR_H = 15;
/** Porta de saída dentro do interior (parede sul) + spawn ao entrar. */
export const INTERIOR_DOOR = { x: 11, y: 14 };
export const INTERIOR_SPAWN = { x: 11, y: 12 };

/** @returns {{tiles: Uint8Array, w: number, h: number}} interior da casa `id`. */
export function buildInterior(id) {
  const w = INTERIOR_W, h = INTERIOR_H;
  const tiles = new Uint8Array(w * h);
  const set = (x, y, t) => { if (x >= 0 && y >= 0 && x < w && y < h) tiles[y * w + x] = t; };
  const rect = (x0, y0, x1, y1, t) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, t); };
  rect(0, 0, w - 1, h - 1, T.FLOOR);
  // paredes externas (telhado não aparece por dentro)
  for (let x = 0; x < w; x++) { set(x, 0, T.WALL); set(x, h - 1, T.WALL); }
  for (let y = 0; y < h; y++) { set(0, y, T.WALL); set(w - 1, y, T.WALL); }
  set(INTERIOR_DOOR.x, INTERIOR_DOOR.y, T.DOOR);
  // tapete central
  rect(8, 6, 13, 10, T.PLAZA);
  set(10, 8, T.PLAZA); set(11, 8, T.PLAZA);
  // cantoneiras: luminárias quentes
  set(1, 1, T.LAMP); set(w - 2, 1, T.LAMP);
  set(1, h - 2, T.LAMP); set(w - 2, h - 2, T.LAMP);
  if (id === 'elder') {
    // estantes de pergaminhos (caixas) + mesa de mapas (pedra) + braseiro
    rect(2, 2, 5, 2, T.CRATE);
    rect(16, 2, 19, 2, T.CRATE);
    set(10, 3, T.STONE); set(11, 3, T.STONE);
    set(10, 4, T.FLOWER); set(11, 4, T.FLOWER);
    set(2, 12, T.RUIN); set(19, 12, T.RUIN);
  } else if (id === 'shop') {
    // balcão da loja (cercas) com abertura no meio + mercadorias atrás
    for (let x = 7; x <= 14; x++) { if (x !== 10 && x !== 11) set(x, 7, T.FENCE); }
    rect(8, 2, 9, 4, T.CRATE);
    rect(12, 2, 13, 4, T.CRATE);
    set(10, 2, T.PLAZA); set(11, 2, T.PLAZA);
    set(18, 5, T.CRATE); set(19, 5, T.CRATE); set(18, 11, T.CRATE); set(3, 11, T.CRATE);
    set(2, 5, T.LAMP); set(19, 8, T.FLOWER);
  } else if (id === 'inn') {
    // camas (praça clara) + mesas (pedra) + lareira (ruína + lamp)
    rect(2, 2, 5, 4, T.PLAZA);
    rect(16, 2, 19, 4, T.PLAZA);
    set(3, 2, T.FLOWER); set(17, 2, T.FLOWER);
    set(9, 3, T.STONE); set(12, 3, T.STONE);
    set(9, 11, T.STONE); set(12, 11, T.STONE);
    set(10, 1, T.RUIN); set(11, 1, T.RUIN);
  } else if (id === 'smith') {
    // forja (ruína + brasa) + bigorna (pedra) + caixas de carvão e armas
    rect(9, 1, 12, 2, T.RUIN);
    set(10, 3, T.STONE); set(11, 3, T.STONE);
    set(2, 2, T.CRATE); set(3, 2, T.CRATE); set(2, 3, T.CRATE);
    set(18, 2, T.CRATE); set(19, 2, T.CRATE); set(19, 3, T.CRATE);
    set(18, 11, T.STONE); set(3, 11, T.STONE);
    set(10, 5, T.FLOWER);
  }
  return { tiles, w, h };
}

/** NPCs de cada interior (posições em tiles do interior). */
export const INTERIOR_NPCS = {
  elder: [
    {
      id: 'elder', x: 10, y: 5, name: 'Ancião Theo', kind: 'elder', wander: false,
      lines: [
        'Ah... o Cristal de Lumen enfraquece a cada lua.',
        'O Dragão do Caos aninhou-se nas RUÍNAS ao nordeste, além do rio. Atravesse a PONTE a leste!',
        'Treine na grama alta da planície, junte ouro e visite a loja da Mira. E descanse na estalagem antes de partir.',
      ],
    },
    {
      id: 'lia', x: 15, y: 9, name: 'Lia (Aprendiz)', kind: 'sage', wander: true,
      lines: [
        'O Ancião me ensina a ler os mapas antigos... as Ruínas ficam a nordeste!',
        'Traga ervas do pântano para a Yara — ela faz tônicos que salvam vidas!',
      ],
    },
  ],
  shop: [
    {
      id: 'shop', x: 10, y: 4, name: 'Mira (Loja)', kind: 'merchant', wander: false, shop: true,
      lines: ['Bem-vindo à minha lojinha! Ouro na mão, poção na sacola!'],
    },
    {
      id: 'cust', x: 15, y: 10, name: 'Viajante Nia', kind: 'nomad', wander: true,
      lines: [
        'Vim do deserto só para comprar com a Mira — os preços dela são os melhores!',
        'Dizem que o Rurik, na ferraria ao sul da praça, vende BOMBAS contra golems!',
      ],
    },
  ],
  inn: [
    {
      id: 'inn', x: 10, y: 4, name: 'Bram (Estalagem)', kind: 'innkeep', wander: false, inn: true,
      lines: ['Cama quente e ensopado por 20G. Descansar é coisa de herói esperto!'],
    },
    {
      id: 'guest', x: 16, y: 10, name: 'Hóspede Tom', kind: 'fisher', wander: false,
      lines: [
        'Melhor cama de Valoria, juro! Acordei novo em folha por 20G.',
        'Se for pescar, fale com o Kai na praia ao sul. Ele entende do riscado!',
      ],
    },
  ],
  smith: [
    {
      id: 'smith', x: 10, y: 4, name: 'Rurik (Ferreiro)', kind: 'smith', wander: false, shop: true,
      lines: ['Martelo quente, lâmina fria! Golems odeiam magia — bata de FOGO e TROVÃO neles.'],
    },
    {
      id: 'appr', x: 15, y: 10, name: 'Sana (Aprendiz)', kind: 'hunter', wander: true,
      lines: [
        'O mestre Rurik forjou minha lança! Com BOMBAS, até golem cai!',
        'O Golem Ancião do deserto? Nem o mestre encara... mas você parece forte!',
      ],
    },
  ],
};

/** Nome de exibição do local atual (mundo ou interior). */
export function placeName(place) {
  if (!place || place.kind === 'world') return null; // Engine usa regionAt
  const h = HOUSES.find((x) => x.id === place.id);
  return h ? h.name : 'Interior';
}
