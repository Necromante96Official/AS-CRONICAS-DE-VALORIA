/**
 * Party — personagens, atributos, XP e níveis (coração do JRPG).
 * @module entities/Party
 */
import { xpForLevel } from '../core/Config.js';

export const SPELLS = {
  fire:    { name: 'Fogo',     mp: 4,  power: 1.6, target: 'enemy', desc: 'Dano de fogo num inimigo' },
  ice:     { name: 'Gelo',     mp: 6,  power: 2.0, target: 'enemy', desc: 'Dano de gelo; pode atordoar' },
  thunder: { name: 'Trovão',   mp: 7,  power: 2.4, target: 'enemy', desc: 'Dano alto num inimigo' },
  cure:    { name: 'Cura',     mp: 5,  power: 2.2, target: 'ally',  desc: 'Restaura HP de um aliado' },
};

/** @typedef {{name:string,cls:string,level:number,xp:number,hp:number,maxHp:number,mp:number,maxMp:number,atk:number,def:number,spd:number,mag:number,spells:string[],sprite:string}} Hero */

const BASE = [
  { name: 'Kael', cls: 'Guerreiro', maxHp: 42, maxMp: 8,  atk: 11, def: 8, spd: 7, mag: 3, spells: [],               sprite: 'hero' },
  { name: 'Lyra', cls: 'Maga',      maxHp: 28, maxMp: 26, atk: 5,  def: 4, spd: 9, mag: 12, spells: ['fire', 'thunder'], sprite: 'mage' },
  { name: 'Milo', cls: 'Clérigo',   maxHp: 34, maxMp: 20, atk: 7,  def: 6, spd: 6, mag: 9,  spells: ['cure', 'fire'], sprite: 'cleric' },
];

/** @returns {Hero[]} */
export function newParty() {
  return BASE.map((b) => ({ ...b, level: 1, xp: 0, hp: b.maxHp, mp: b.maxMp }));
}

/** Aplica XP; retorna lista de mensagens de level-up. @param {Hero[]} party @param {number} amount */
export function grantXp(party, amount) {
  const msgs = [];
  for (const h of party) {
    if (h.hp <= 0) continue;
    h.xp += amount;
    while (h.xp >= xpForLevel(h.level)) {
      h.xp -= xpForLevel(h.level);
      h.level++;
      const hpUp = 6 + Math.floor(Math.random() * 4);
      const mpUp = h.cls === 'Guerreiro' ? 1 : 2 + Math.floor(Math.random() * 3);
      h.maxHp += hpUp; h.hp = Math.min(h.maxHp, h.hp + hpUp);
      h.maxMp += mpUp; h.mp = Math.min(h.maxMp, h.mp + mpUp);
      h.atk += 1 + (h.cls === 'Guerreiro' ? 1 : 0);
      h.def += 1; h.spd += h.cls === 'Maga' ? 1 : 0; h.mag += h.cls !== 'Guerreiro' ? 1 : 0;
      if (h.cls === 'Clérigo' && h.level >= 3 && !h.spells.includes('thunder')) { h.spells.push('thunder'); }
      if (h.cls === 'Maga' && h.level >= 4 && !h.spells.includes('ice')) { h.spells.push('ice'); msgs.push(`${h.name} aprendeu GELO!`); }
      if (h.cls === 'Clérigo' && h.level >= 5 && !h.spells.includes('ice')) { h.spells.push('ice'); msgs.push(`${h.name} aprendeu GELO!`); }
      msgs.push(`${h.name} subiu para o Nv ${h.level}!`);
    }
  }
  return msgs;
}

/** @param {Hero[]} party */
export const aliveHeroes = (party) => party.filter((h) => h.hp > 0);
/** @param {Hero[]} party */
export const partyWiped = (party) => party.every((h) => h.hp <= 0);
/** @param {Hero[]} party */
export function fullHeal(party) { for (const h of party) { h.hp = h.maxHp; h.mp = h.maxMp; } }

/** Serializa / restaura. */
export const serializeParty = (party) => JSON.parse(JSON.stringify(party));
/** @param {any[]} data @returns {Hero[]} */
export function restoreParty(data) { return data.map((h) => ({ spells: [], ...h })); }
