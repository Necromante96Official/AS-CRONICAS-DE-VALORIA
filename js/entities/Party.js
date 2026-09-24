/**
 * Party — personagens, atributos, XP e níveis (coração do JRPG).
 * @module entities/Party
 */
import { xpForLevel } from '../core/Config.js';
import { skillRank } from '../systems/SkillTree.js';

export const SPELLS = {
  fire:    { name: 'Fogo',     mp: 4,  power: 1.6, target: 'enemy', desc: 'Dano de fogo num inimigo' },
  ice:     { name: 'Gelo',     mp: 6,  power: 2.0, target: 'enemy', desc: 'Dano de gelo; pode atordoar' },
  thunder: { name: 'Trovão',   mp: 7,  power: 2.4, target: 'enemy', desc: 'Dano alto num inimigo' },
  cure:    { name: 'Cura',     mp: 5,  power: 2.2, target: 'ally',  desc: 'Restaura HP de um aliado' },
};

/** @typedef {{name:string,cls:string,level:number,xp:number,hp:number,maxHp:number,mp:number,maxMp:number,atk:number,def:number,spd:number,mag:number,spells:string[],sprite:string,sp:number,skills:Record<string,number>}} Hero */

const BASE = [
  { name: 'Kael', cls: 'Guerreiro', maxHp: 42, maxMp: 8,  atk: 11, def: 8, spd: 7, mag: 3, spells: [],               sprite: 'hero' },
  { name: 'Lyra', cls: 'Maga',      maxHp: 28, maxMp: 26, atk: 5,  def: 4, spd: 9, mag: 12, spells: ['fire', 'thunder'], sprite: 'mage' },
  { name: 'Milo', cls: 'Clérigo',   maxHp: 34, maxMp: 20, atk: 7,  def: 6, spd: 6, mag: 9,  spells: ['cure', 'fire'], sprite: 'cleric' },
];

/** Crescimento por nível e classe (base; VEL alterna por nível). */
const GROWTH = {
  Guerreiro: { maxHp: 7, maxMp: 1, atk: 2, def: 2, mag: 0, spd: 0 },
  Maga:      { maxHp: 4, maxMp: 4, atk: 1, def: 1, mag: 3, spd: 1 },
  Clérigo:   { maxHp: 6, maxMp: 3, atk: 1, def: 2, mag: 2, spd: 0 },
};
/** Classes que ganham +1 VEL nos níveis pares (passo mais leve). */
const SPD_EVEN = { Guerreiro: true, Clérigo: true };

/** @returns {Hero[]} */
export function newParty() {
  return BASE.map((b) => ({ ...b, level: 1, xp: 0, hp: b.maxHp, mp: b.maxMp, sp: 0, skills: {} }));
}

/**
 * Aplica XP; retorna lista de mensagens de level-up.
 * Atrasados (abaixo da média do grupo) ganham +25% (catch-up); Carisma soma +15%/nv.
 * Cada nível rende +1 ponto de skill (✦); magias vêm da árvore de skills.
 * @param {Hero[]} party @param {number} amount
 */
export function grantXp(party, amount) {
  const msgs = [];
  const alive = party.filter((h) => h.hp > 0);
  const avg = alive.length ? alive.reduce((s, h) => s + h.level, 0) / alive.length : 1;
  for (const h of party) {
    if (h.hp <= 0) continue;
    let gain = amount;
    if (h.level < avg) gain = Math.round(gain * 1.25);
    gain += Math.round(amount * 0.15 * skillRank(h, 'charm'));
    h.xp += gain;
    while (h.xp >= xpForLevel(h.level)) {
      h.xp -= xpForLevel(h.level);
      h.level++;
      const g = GROWTH[h.cls] || GROWTH.Guerreiro;
      const up = {};
      for (const k of ['maxHp', 'maxMp', 'atk', 'def', 'mag']) up[k] = g[k];
      up.spd = g.spd + (SPD_EVEN[h.cls] && h.level % 2 === 0 ? 1 : 0);
      // pequena variação (±1 em HP/MP) p/ cada herói ser único
      up.maxHp += Math.floor(Math.random() * 3) - 1;
      up.maxMp += Math.floor(Math.random() * 3) - 1;
      for (const [k, v] of Object.entries(up)) h[k] = Math.max(1, (h[k] || 0) + v);
      h.hp = Math.min(h.maxHp, h.hp + up.maxHp);
      h.mp = Math.min(h.maxMp, h.mp + up.maxMp);
      h.sp = (h.sp || 0) + 1;
      h.skills = h.skills || {};
      msgs.push(`${h.name} subiu para o Nv ${h.level}! (+1 ✦ ponto de skill)`);
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

/** Serializa / restaura (com migração de saves antigos: sp/skills). */
export const serializeParty = (party) => JSON.parse(JSON.stringify(party));
/** @param {any[]} data @returns {Hero[]} */
export function restoreParty(data) {
  return data.map((h) => {
    const r = { spells: [], sp: 0, skills: {}, ...h };
    if (r.skills == null || typeof r.skills !== 'object') r.skills = {};
    if (typeof r.sp !== 'number') r.sp = 0;
    // saves de antes dos pontos de skill: compensa 1✦ por nível já ganho
    if (h.sp === undefined && (r.level || 1) > 1 && Object.keys(r.skills).length === 0) {
      r.sp = Math.max(0, r.level - 1);
    }
    return r;
  });
}
