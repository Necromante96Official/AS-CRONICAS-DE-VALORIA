/**
 * Inventory — itens consumíveis e loja.
 * @module systems/Inventory
 */
export const ITEMS = {
  potion:    { name: 'Poção',      price: 50,  heal: 60,  desc: 'Restaura 60 HP de um aliado', battle: true },
  strongpotion: { name: 'Poção Forte', price: 110, heal: 100, desc: 'Restaura 100 HP de um aliado', battle: true },
  hipotion:  { name: 'Hi-Poção',   price: 150, heal: 160, desc: 'Restaura 160 HP de um aliado', battle: true },
  megapotion:{ name: 'Mega Poção', price: 380, heal: 320, desc: 'Restaura 320 HP de um aliado', battle: true },
  ether:     { name: 'Éter',       price: 120, mp: 20,    desc: 'Restaura 20 MP de um aliado', battle: true },
  bigether:  { name: 'Éter Grande', price: 200, mp: 40,   desc: 'Restaura 40 MP de um aliado', battle: true },
  antidote:  { name: 'Bomba Fumaça', price: 40, flee: true, desc: 'Garante fuga da batalha', battle: true },
  fish:      { name: 'Peixe Fresco', price: 12, heal: 35, desc: 'Pescado! Restaura 35 HP de um aliado', battle: true },
  lambari:   { name: 'Lambari Prateado', price: 8, heal: 25, desc: 'Pequeno e rápido. Restaura 25 HP', battle: true },
  royal:     { name: 'Peixe Real', price: 30, heal: 70, desc: 'Escamas azuis. Restaura 70 HP', battle: true },
  goldfish:  { name: 'Dourado Lendário', price: 90, heal: 140, desc: 'Lenda da Praia do Sol. Restaura 140 HP', battle: true },
  moonfish:  { name: 'Peixe-Lua', price: 45, heal: 90, desc: 'Só morde à noite. Restaura 90 HP', battle: true },
  phoenix:   { name: 'Pena de Fênix', price: 200, revive: 0.5, desc: 'Revive um aliado caído com 50% do HP', battle: true },
  goldphoenix: { name: 'Pena Dourada', price: 450, revive: 1.0, desc: 'Revive um aliado caído com 100% do HP', battle: true },
  bomb:      { name: 'Bomba de Fogo', price: 90, dmg: 90, desc: 'Explode num inimigo (90 de dano)', battle: true },
  megabomb:  { name: 'Bombarda', price: 240, dmg: 220, desc: 'Explode num inimigo (220 de dano)', battle: true },
  hiether:   { name: 'Hi-Éter', price: 280, mp: 60, desc: 'Restaura 60 MP de um aliado', battle: true },
  elixir:    { name: 'Elixir', price: 400, heal: 200, mp: 40, desc: 'Restaura 200 HP e 40 MP de um aliado', battle: true },
  tonic:     { name: 'Tônico Completo', price: 150, heal: 60, mp: 15, desc: 'Restaura 60 HP e 15 MP de um aliado', battle: true },
  // ---- equipamentos (E no menu equipa; bônus somem aos stats) ----
  sword1:    { name: 'Espada de Treino', price: 80, desc: 'Madeira envernizada. +2 ATK', battle: false, slot: 'weapon', bonus: { atk: 2 } },
  sword2:    { name: 'Lâmina Rúnica', price: 300, desc: 'Aço gravado. +4 ATK', battle: false, slot: 'weapon', bonus: { atk: 4 } },
  sword3:    { name: 'Espada do Alvorecer', price: 800, desc: 'Brilha ao amanhecer. +7 ATK, +2 VEL', battle: false, slot: 'weapon', bonus: { atk: 7, spd: 2 } },
  armor1:    { name: 'Couro Batido', price: 100, desc: 'Couro grosso. +2 DEF', battle: false, slot: 'armor', bonus: { def: 2 } },
  armor2:    { name: 'Cota de Malha', price: 320, desc: 'Elos de aço. +4 DEF', battle: false, slot: 'armor', bonus: { def: 4 } },
  armor3:    { name: 'Manto do Guardião', price: 700, desc: 'Tecido abençoado. +3 DEF, +20 HP máx', battle: false, slot: 'armor', bonus: { def: 3, maxHp: 20 } },
  charm1:    { name: 'Anel de Mana', price: 150, desc: 'Pedra azul pulsante. +15 MP máx', battle: false, slot: 'charm', bonus: { maxMp: 15 } },
  charm2:    { name: 'Pena Veloz', price: 250, desc: 'Leve como o vento. +2 VEL', battle: false, slot: 'charm', bonus: { spd: 2 } },
  charm3:    { name: 'Coração de Rubi', price: 500, desc: 'Pulsa quente. +30 HP máx', battle: false, slot: 'charm', bonus: { maxHp: 30 } },
};

/** Slots de equipamento. */
export const EQUIP_SLOTS = [
  { id: 'weapon', label: 'Arma' },
  { id: 'armor', label: 'Armadura' },
  { id: 'charm', label: 'Amuleto' },
];

/** Categorias p/ o menu (ordem de exibição). */
export const ITEM_CATS = [
  { id: 'cura', label: 'Cura', ids: ['potion', 'strongpotion', 'hipotion', 'megapotion'] },
  { id: 'mana', label: 'Mana', ids: ['ether', 'bigether', 'hiether'] },
  { id: 'bat', label: 'Batalha', ids: ['bomb', 'megabomb', 'antidote'] },
  { id: 'pesca', label: 'Pesca', ids: ['fish', 'lambari', 'royal', 'goldfish', 'moonfish'] },
  { id: 'esp', label: 'Especiais', ids: ['phoenix', 'goldphoenix', 'elixir', 'tonic'] },
  { id: 'equip', label: 'Equipamentos', ids: ['sword1', 'sword2', 'sword3', 'armor1', 'armor2', 'armor3', 'charm1', 'charm2', 'charm3'] },
];

/** @returns {Record<string, number>} */
export const newInventory = () => ({ potion: 3, strongpotion: 0, hipotion: 0, megapotion: 0, ether: 1, bigether: 0, antidote: 0, phoenix: 0, goldphoenix: 0, lambari: 0, royal: 0, goldfish: 0, moonfish: 0, bomb: 0, megabomb: 0, hiether: 0, elixir: 0, tonic: 0, fish: 0, sword1: 1, sword2: 0, sword3: 0, armor1: 0, armor2: 0, armor3: 0, charm1: 0, charm2: 0, charm3: 0 });

export const SHOP_STOCK = ['potion', 'strongpotion', 'hipotion', 'megapotion', 'ether', 'bigether', 'antidote', 'phoenix', 'goldphoenix', 'bomb', 'megabomb', 'hiether', 'elixir', 'tonic', 'sword1', 'sword2', 'sword3', 'armor1', 'armor2', 'armor3', 'charm1', 'charm2', 'charm3'];

/** Quem está com o equipamento? @param {any[]} party @param {string} id @returns {any|null} */
export function equippedBy(party, id) {
  return (party || []).find((h) => h.equip && Object.values(h.equip).includes(id)) || null;
}

/**
 * Usa um item num alvo.
 * @param {Record<string, number>} inv
 * @param {string} id
 * @param {{hp:number,maxHp:number,mp:number,maxMp:number,name:string}} target
 * @returns {{ok:boolean,msg:string}}
 */
export function useItem(inv, id, target) {
  if ((inv[id] || 0) <= 0) return { ok: false, msg: 'Você não tem esse item!' };
  const it = ITEMS[id];
  if (it.slot) return { ok: false, msg: `${it.name} é equipamento: equipe no menu (Q > Itens).` };
  if (it.revive) {
    if (target.hp > 0) return { ok: false, msg: `${target.name} ainda está de pé!` };
    inv[id]--;
    const v = Math.ceil(target.maxHp * it.revive);
    target.hp = v;
    return { ok: true, msg: `${target.name} renasceu com ${v} HP!` };
  }
  if (it.dmg) return { ok: false, msg: `${it.name} só funciona em batalha!` };
  if (it.heal && !it.mp && target.hp >= target.maxHp) return { ok: false, msg: `${target.name} já está com HP cheio!` };
  if (it.heal && target.hp <= 0) return { ok: false, msg: `${target.name} está caído!` };
  if (it.mp && !it.heal && target.mp >= target.maxMp) return { ok: false, msg: `${target.name} já está com MP cheio!` };
  if (it.heal && it.mp && target.hp >= target.maxHp && target.mp >= target.maxMp) return { ok: false, msg: `${target.name} já está com HP e MP cheios!` };
  inv[id]--;
  const parts = [];
  if (it.heal) {
    const v = Math.min(it.heal, target.maxHp - target.hp);
    target.hp += v;
    parts.push(`${v} HP`);
  }
  if (it.mp) {
    const v = Math.min(it.mp, target.maxMp - target.mp);
    target.mp += v;
    parts.push(`${v} MP`);
  }
  if (parts.length) return { ok: true, msg: `${target.name} recuperou ${parts.join(' e ')}!` };
  return { ok: true, msg: `${it.name} usado!` };
}
