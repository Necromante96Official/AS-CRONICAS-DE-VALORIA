/**
 * Enemies — bestiário + fábrica de encontros por região.
 * @module entities/Enemies
 */

/** @typedef {{id:string,name:string,hp:number,maxHp:number,atk:number,def:number,spd:number,xp:number,gold:number,sprite:string,boss?:boolean}} Enemy */

const BESTIARY = {
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
