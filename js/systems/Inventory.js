/**
 * Inventory — itens consumíveis e loja.
 * @module systems/Inventory
 */
export const ITEMS = {
  potion:    { name: 'Poção',      price: 50,  heal: 60,  desc: 'Restaura 60 HP de um aliado', battle: true },
  hipotion:  { name: 'Hi-Poção',   price: 150, heal: 160, desc: 'Restaura 160 HP de um aliado', battle: true },
  ether:     { name: 'Éter',       price: 120, mp: 20,    desc: 'Restaura 20 MP de um aliado', battle: true },
  antidote:  { name: 'Bomba Fumaça', price: 40, flee: true, desc: 'Garante fuga da batalha', battle: true },
};

/** @returns {Record<string, number>} */
export const newInventory = () => ({ potion: 3, hipotion: 0, ether: 1, antidote: 0 });

export const SHOP_STOCK = ['potion', 'hipotion', 'ether', 'antidote'];

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
  if (it.heal && target.hp >= target.maxHp) return { ok: false, msg: `${target.name} já está com HP cheio!` };
  if (it.heal && target.hp <= 0) return { ok: false, msg: `${target.name} está caído!` };
  if (it.mp && target.mp >= target.maxMp) return { ok: false, msg: `${target.name} já está com MP cheio!` };
  inv[id]--;
  if (it.heal) {
    const v = Math.min(it.heal, target.maxHp - target.hp);
    target.hp += v;
    return { ok: true, msg: `${target.name} recuperou ${v} HP!` };
  }
  if (it.mp) {
    const v = Math.min(it.mp, target.maxMp - target.mp);
    target.mp += v;
    return { ok: true, msg: `${target.name} recuperou ${v} MP!` };
  }
  return { ok: true, msg: `${it.name} usado!` };
}
