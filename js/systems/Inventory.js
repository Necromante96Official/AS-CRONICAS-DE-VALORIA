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
  phoenix:   { name: 'Pena de Fênix', price: 200, revive: 0.5, desc: 'Revive um aliado caído com 50% do HP', battle: true },
  goldphoenix: { name: 'Pena Dourada', price: 450, revive: 1.0, desc: 'Revive um aliado caído com 100% do HP', battle: true },
  bomb:      { name: 'Bomba de Fogo', price: 90, dmg: 90, desc: 'Explode num inimigo (90 de dano)', battle: true },
  megabomb:  { name: 'Bombarda', price: 240, dmg: 220, desc: 'Explode num inimigo (220 de dano)', battle: true },
  hiether:   { name: 'Hi-Éter', price: 280, mp: 60, desc: 'Restaura 60 MP de um aliado', battle: true },
  elixir:    { name: 'Elixir', price: 400, heal: 200, mp: 40, desc: 'Restaura 200 HP e 40 MP de um aliado', battle: true },
  tonic:     { name: 'Tônico Completo', price: 150, heal: 60, mp: 15, desc: 'Restaura 60 HP e 15 MP de um aliado', battle: true },
};

/** Categorias p/ o menu (ordem de exibição). */
export const ITEM_CATS = [
  { id: 'cura', label: 'Cura', ids: ['potion', 'strongpotion', 'hipotion', 'megapotion'] },
  { id: 'mana', label: 'Mana', ids: ['ether', 'bigether', 'hiether'] },
  { id: 'bat', label: 'Batalha', ids: ['bomb', 'megabomb', 'antidote'] },
  { id: 'pesca', label: 'Pesca', ids: ['fish', 'lambari', 'royal', 'goldfish'] },
  { id: 'esp', label: 'Especiais', ids: ['phoenix', 'goldphoenix', 'elixir', 'tonic'] },
];

/** @returns {Record<string, number>} */
export const newInventory = () => ({ potion: 3, strongpotion: 0, hipotion: 0, megapotion: 0, ether: 1, bigether: 0, antidote: 0, phoenix: 0, goldphoenix: 0, lambari: 0, royal: 0, goldfish: 0, bomb: 0, megabomb: 0, hiether: 0, elixir: 0, tonic: 0, fish: 0 });

export const SHOP_STOCK = ['potion', 'strongpotion', 'hipotion', 'megapotion', 'ether', 'bigether', 'antidote', 'phoenix', 'goldphoenix', 'bomb', 'megabomb', 'hiether', 'elixir', 'tonic'];

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
