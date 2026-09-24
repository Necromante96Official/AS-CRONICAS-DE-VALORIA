/**
 * Enemies — bestiário + fábrica de encontros por região.
 * @module entities/Enemies
 */
import { makeSlime, makeBat, makeGolem, makeDragon, makeKing, makeWisp, makeCrab, makeScorpion, makeShroom, makeSkeleton, makeOrc, makeToad, makeWolf, makeAncient } from '../core/SpriteFactory.js';

/** @typedef {{id:string,name:string,hp:number,maxHp:number,atk:number,def:number,spd:number,xp:number,gold:number,sprite:string,boss?:boolean}} Enemy */

/** Exportado p/ o Bestiário do menu. */
export const BESTIARY = {
  slime:  { name: 'Slime',        hp: 22, atk: 7,  def: 3, spd: 4,  xp: 9,  gold: 8,  sprite: 'slime' },
  bat:    { name: 'Morcego Sombrio', hp: 18, atk: 9,  def: 2, spd: 12, xp: 12, gold: 10, sprite: 'bat' },
  golem:  { name: 'Golem Jr.',    hp: 40, atk: 12, def: 8, spd: 3,  xp: 22, gold: 18, sprite: 'golem' },
  wisp:   { name: 'Fagulha',      hp: 26, atk: 13, def: 4, spd: 10, xp: 26, gold: 22, sprite: 'wisp' },
  crab:   { name: 'Caranguejo',   hp: 30, atk: 10, def: 9, spd: 5,  xp: 18, gold: 14, sprite: 'crab' },
  scorpion: { name: 'Escorpião',  hp: 24, atk: 14, def: 5, spd: 11, xp: 24, gold: 20, sprite: 'scorpion' },
  shroom: { name: 'Cogumelo',     hp: 34, atk: 11, def: 6, spd: 6,  xp: 24, gold: 16, sprite: 'shroom' },
  skeleton: { name: 'Esqueleto',  hp: 32, atk: 13, def: 5, spd: 8,  xp: 26, gold: 24, sprite: 'skeleton' },
  orc:    { name: 'Orc do Deserto', hp: 44, atk: 15, def: 7, spd: 6,  xp: 30, gold: 26, sprite: 'orc' },
  toad:   { name: 'Sapo Gigante', hp: 38, atk: 12, def: 6, spd: 7,  xp: 26, gold: 18, sprite: 'toad' },
  wolf:   { name: 'Lobo da Neve', hp: 28, atk: 14, def: 5, spd: 14, xp: 28, gold: 24, sprite: 'wolf' },
  king:   { name: 'SLIME REI',    hp: 70, atk: 15, def: 9, spd: 6,  xp: 70, gold: 80, sprite: 'king' },
  ancient: { name: 'GOLEM ANCIÃO', hp: 130, atk: 18, def: 11, spd: 4, xp: 150, gold: 300, sprite: 'ancient', boss: true },
  dragon: { name: 'DRAGÃO DO CAOS', hp: 220, atk: 22, def: 12, spd: 9, xp: 250, gold: 500, sprite: 'dragon', boss: true },
  echo:   { name: 'ECO ANTIGO',   hp: 95, atk: 16, def: 8, spd: 9,  xp: 120, gold: 250, sprite: 'echo', boss: true },
};

/** Sabor de cada fera p/ o Bestiário. */
export const BEAST_FLAVOR = {
  slime: 'Gosma dócil até ser chutada. O primeiro troféu de todo herói.',
  bat: 'Caça de olhos vendados: mira nos mais frágeis do grupo.',
  golem: 'Pedra teimosa. Magia de fogo e trovão racham sua couraça.',
  wisp: 'Fagulha perdida do cristal. Rápida, quente e vingativa.',
  crab: 'Pinça esmagadora da Praia do Sol. Não subestime o tamanho.',
  scorpion: 'Ferrão fura-defesa do Deserto Dourado. Desvie ou cure.',
  shroom: 'Cura os próprios esporos. Queime antes que se regenere.',
  skeleton: 'Ossos velhos das Ruínas com ódio novo. Gelo os torna lentos.',
  orc: 'Bebe da água do oásis e volta maior. Bombas ajudam.',
  toad: 'Língua comprida do pântano. Bata primeiro, pergunte depois.',
  wolf: 'Caça em matilha no Pico Nevado. Derrube o mais rápido.',
  king: 'Raro e majestoso. Dizem que coroa de gosma traz sorte.',
  ancient: 'Sentinela do deserto. Pedra não perdoa... mas agradece.',
  dragon: 'O pesadelo do Altar do Caos. Queime-o antes que queime você.',
  echo: 'Voz presa na Caverna Ecoante. Repete seu último grito.',
};

/** Tabela de encontros por região: [id, peso]. @param {string} region */
export function encounterTable(region) {
  switch (region) {
    case 'forest': return [['bat', 4], ['slime', 2], ['shroom', 2], ['wolf', 1], ['wisp', 1]];
    case 'dungeon': case 'altar': return [['golem', 3], ['skeleton', 3], ['wisp', 3], ['bat', 2]];
    case 'snow': return [['wisp', 3], ['wolf', 3], ['bat', 2], ['golem', 2]];
    case 'beach': return [['crab', 4], ['slime', 3], ['toad', 1], ['bat', 1]];
    case 'desert': return [['scorpion', 3], ['orc', 3], ['golem', 2], ['bat', 1]];
    case 'swamp': return [['shroom', 3], ['toad', 3], ['bat', 2], ['wisp', 1]];
    default: return [['slime', 4], ['bat', 3], ['skeleton', 1], ['golem', 1]];
  }
}

/** Cria inimigo com leve variação. @param {string} id @param {number} [scale=1] @returns {Enemy} */
export function makeEnemy(id, scale = 1) {
  const b = BESTIARY[id];
  const v = () => 0.9 + Math.random() * 0.2;
  const maxHp = Math.round(b.hp * scale * v());
  return { id, name: b.name, hp: maxHp, maxHp, atk: Math.round(b.atk * scale * v()), def: Math.round(b.def * scale), spd: b.spd, xp: Math.round(b.xp * scale), gold: Math.round(b.gold * scale * v()), sprite: b.sprite, boss: !!b.boss };
}

/** Monta um grupo de 1–3 inimigos para a região e nível médio do grupo. */
export function makeEncounter(region, avgLevel) {
  const table = encounterTable(region);
  const total = table.reduce((s, [, w]) => s + w, 0);
  const pick = () => {
    let r = Math.random() * total;
    for (const [id, w] of table) { r -= w; if (r <= 0) return id; }
    return table[0][0];
  };
  const count = region === 'field' ? (Math.random() < 0.55 ? 2 : 1) : (1 + Math.floor(Math.random() * 3));
  const scale = 1 + (avgLevel - 1) * 0.22 + (region === 'dungeon' ? 0.35 : region === 'snow' ? 0.25 : region === 'desert' ? 0.2 : region === 'forest' ? 0.15 : region === 'swamp' ? 0.1 : 0);
  const group = [];
  for (let i = 0; i < count; i++) group.push(makeEnemy(pick(), scale));
  // encontro raro: Slime Rei na planície para grupos experientes
  if (region === 'field' && avgLevel >= 3 && Math.random() < 0.12) group[0] = makeEnemy('king', scale);
  return group;
}

/** O boss final. */
export const makeBoss = () => makeEnemy('dragon', 1.15);

/** Mini-chefe opcional do deserto: o Golem Ancião da clareira. */
export const makeElite = () => makeEnemy('ancient', 1.0);

/** Guardião da Caverna Ecoante. */
export const makeEcho = () => makeEnemy('echo', 1.0);

/** Canvas do sprite de um inimigo (p/ monstros visíveis no mapa). @param {string} id @returns {HTMLCanvasElement} */
export function foeImage(id) {
  switch (id) {
    case 'slime': return makeSlime('#4fe07a');
    case 'bat': return makeBat('#6a5cff');
    case 'golem': return makeGolem();
    case 'wisp': return makeWisp();
    case 'crab': return makeCrab();
    case 'scorpion': return makeScorpion();
    case 'shroom': return makeShroom();
    case 'skeleton': return makeSkeleton();
    case 'orc': return makeOrc();
    case 'toad': return makeToad();
    case 'wolf': return makeWolf();
    case 'ancient': return makeAncient();
    case 'king': return makeKing();
    case 'dragon': return makeDragon();
    case 'echo': return makeWisp('#c9a8ff');
    default: return makeSlime();
  }
}

/** Sorteia o id de um monstro da região (p/ patrulha visível). @param {string} region */
export function pickWalkerEnemy(region) {
  const table = encounterTable(region);
  const total = table.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [id, w] of table) { r -= w; if (r <= 0) return id; }
  return table[0][0];
}
