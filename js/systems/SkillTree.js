/**
 * SkillTree — árvores de skills por classe (nós que se ligam, com pré-requisitos).
 * Heróis ganham +1 ponto de skill (✦) por nível e investem em Q > Skills.
 * Efeitos: stats, magias (das existentes) e passivas usadas na batalha.
 * @module systems/SkillTree
 */

/** Passivas (somas por nível investido). */
export const PASSIVES = {
  crit:  { name: 'Crítico',       desc: '+5% de chance de crítico por nível.' },
  regen: { name: 'Regeneração',   desc: 'Recupera 5% do HP máx. por turno.' },
  focus: { name: 'Foco Arcano',   desc: '+2 MP por turno.' },
  tough: { name: 'Couraça',       desc: '-8% de dano recebido por nível.' },
  charm: { name: 'Carisma',       desc: '+15% de XP ganho por nível.' },
  lifesteal: { name: 'Roubo de Vida', desc: 'Ataques físicos curam 8% do dano por nível.' },
  endure: { name: 'Milagre',      desc: 'Sobrevive a 1 golpe letal por batalha (por nível).' },
  counter: { name: 'Revide',      desc: 'Chance de contra-atacar ao sofrer dano.' },
  dodge: { name: 'Esquiva',       desc: '+6% de chance de desviar por nível.' },
  gold:  { name: 'Alquimia',      desc: '+10% de ouro das vitórias por nível.' },
  swift: { name: 'Pressa',        desc: 'Age mais cedo no turno (+3 VEL efetiva por nível).' },
};

/** Nomes de stats p/ textos. */
export const STAT_NAMES = { atk: 'ATK', def: 'DEF', mag: 'MAG', spd: 'VEL', maxHp: 'HP máx', maxMp: 'MP máx' };

/**
 * Nó: {id, cls, name, desc, icon, x, y (0..100, 0..64), req:[ids], reqLevel, max, effect}
 * effect: {kind:'stat', stat, per} | {kind:'spell', spell} | {kind:'passive', passive}
 */
export const NODES = [
  // ---------- KAEL · Guerreiro ----------
  { id: 'k_hp1', cls: 'Guerreiro', name: 'Vigor de Aço', desc: 'Corpo treinado para aguentar porrada.', icon: 'potion', x: 50, y: 8, req: [], max: 3, effect: { kind: 'stat', stat: 'maxHp', per: 12 } },
  { id: 'k_atk1', cls: 'Guerreiro', name: 'Golpe Firme', desc: 'Técnica básica de espada.', icon: 'attack', x: 20, y: 22, req: [], max: 3, effect: { kind: 'stat', stat: 'atk', per: 2 } },
  { id: 'k_def1', cls: 'Guerreiro', name: 'Pele de Ferro', desc: 'Endurece contra cortes.', icon: 'guard', x: 80, y: 22, req: [], max: 3, effect: { kind: 'stat', stat: 'def', per: 2 } },
  { id: 'k_regen', cls: 'Guerreiro', name: 'Sangue Quente', desc: 'Feridas fecham no calor da luta.', icon: 'regen', x: 50, y: 24, req: ['k_hp1'], max: 2, effect: { kind: 'passive', passive: 'regen' } },
  { id: 'k_crit', cls: 'Guerreiro', name: 'Instinto Caçador', desc: 'Fareja o ponto fraco.', icon: 'crit', x: 12, y: 42, req: ['k_atk1'], max: 3, effect: { kind: 'passive', passive: 'crit' } },
  { id: 'k_atk2', cls: 'Guerreiro', name: 'Lâmina Rúnica', desc: 'Espada gravada com runas de guerra.', icon: 'attack', x: 32, y: 44, req: ['k_atk1'], max: 2, effect: { kind: 'stat', stat: 'atk', per: 4 } },
  { id: 'k_tough', cls: 'Guerreiro', name: 'Postura Inabalável', desc: 'Absorve impactos sem recuar.', icon: 'tough', x: 68, y: 44, req: ['k_def1'], max: 2, effect: { kind: 'passive', passive: 'tough' } },
  { id: 'k_def2', cls: 'Guerreiro', name: 'Muralha', desc: 'Vira uma fortaleza ambulante.', icon: 'guard', x: 88, y: 42, req: ['k_def1'], max: 2, effect: { kind: 'stat', stat: 'def', per: 4 } },
  { id: 'k_cure', cls: 'Guerreiro', name: 'Bênção da Capela', desc: 'Aprende a magia Cura.', icon: 'cure', x: 38, y: 58, req: ['k_regen'], max: 1, effect: { kind: 'spell', spell: 'cure' } },
  { id: 'k_hp2', cls: 'Guerreiro', name: 'Coração Valente', desc: 'Coração que nunca desiste.', icon: 'potion', x: 62, y: 58, req: ['k_regen'], max: 1, effect: { kind: 'stat', stat: 'maxHp', per: 24 } },
  { id: 'k_leech', cls: 'Guerreiro', name: 'Sede de Batalha', desc: 'Cada golpe rouba vida do inimigo.', icon: 'potion', x: 12, y: 58, req: ['k_crit'], reqLevel: 3, max: 2, effect: { kind: 'passive', passive: 'lifesteal' } },
  { id: 'k_counter', cls: 'Guerreiro', name: 'Revide', desc: 'Devolve parte do dano sofrido.', icon: 'attack', x: 82, y: 58, req: ['k_tough'], reqLevel: 4, max: 2, effect: { kind: 'passive', passive: 'counter' } },
  // ---------- LYRA · Maga ----------
  { id: 'l_mag1', cls: 'Maga', name: 'Mente Brilhante', desc: 'Poder arcano em expansão.', icon: 'magic', x: 50, y: 8, req: [], max: 3, effect: { kind: 'stat', stat: 'mag', per: 3 } },
  { id: 'l_mp1', cls: 'Maga', name: 'Reserva de Mana', desc: 'Mais mana para conjurar.', icon: 'ether', x: 20, y: 24, req: [], max: 3, effect: { kind: 'stat', stat: 'maxMp', per: 6 } },
  { id: 'l_ice', cls: 'Maga', name: 'Lâmina de Gelo', desc: 'Aprende a magia Gelo.', icon: 'ice', x: 80, y: 24, req: [], max: 1, effect: { kind: 'spell', spell: 'ice' } },
  { id: 'l_focus', cls: 'Maga', name: 'Meditação', desc: 'Recupera mana no combate.', icon: 'focus', x: 50, y: 26, req: ['l_mag1'], max: 2, effect: { kind: 'passive', passive: 'focus' } },
  { id: 'l_crit', cls: 'Maga', name: 'Ponto Fraco', desc: 'Acerta onde dói mais.', icon: 'crit', x: 14, y: 42, req: ['l_mp1'], max: 3, effect: { kind: 'passive', passive: 'crit' } },
  { id: 'l_mp2', cls: 'Maga', name: 'Poço Profundo', desc: 'Mana quase infinita.', icon: 'ether', x: 22, y: 56, req: ['l_mp1'], max: 2, effect: { kind: 'stat', stat: 'maxMp', per: 8 } },
  { id: 'l_cure', cls: 'Maga', name: 'Toque Suave', desc: 'Aprende a magia Cura.', icon: 'cure', x: 36, y: 44, req: ['l_focus'], max: 1, effect: { kind: 'spell', spell: 'cure' } },
  { id: 'l_arch', cls: 'Maga', name: 'Arquimaga', desc: 'Poder de outro patamar.', icon: 'magic', x: 64, y: 44, req: ['l_focus'], max: 1, effect: { kind: 'stat', stat: 'mag', per: 5 } },
  { id: 'l_frost', cls: 'Maga', name: 'Pele Gélida', desc: 'Fria como o inverno: sofre menos dano.', icon: 'tough', x: 88, y: 44, req: ['l_ice'], max: 2, effect: { kind: 'passive', passive: 'tough' } },
  { id: 'l_hp1', cls: 'Maga', name: 'Corpo São', desc: 'Um corpo mais resistente.', icon: 'potion', x: 50, y: 58, req: ['l_focus'], max: 2, effect: { kind: 'stat', stat: 'maxHp', per: 10 } },
  { id: 'l_dodge', cls: 'Maga', name: 'Corpo Etéreo', desc: 'Quase intangível por instantes.', icon: 'flee', x: 14, y: 56, req: ['l_crit'], reqLevel: 3, max: 2, effect: { kind: 'passive', passive: 'dodge' } },
  { id: 'l_swift', cls: 'Maga', name: 'Pressa Arcana', desc: 'Magia acelera os reflexos.', icon: 'spark', x: 30, y: 58, req: ['l_cure'], reqLevel: 3, max: 2, effect: { kind: 'passive', passive: 'swift' } },
  { id: 'l_gold', cls: 'Maga', name: 'Alquimia', desc: 'Transmuta restos em ouro.', icon: 'gold', x: 70, y: 58, req: ['l_arch'], reqLevel: 4, max: 2, effect: { kind: 'passive', passive: 'gold' } },
  // ---------- MILO · Clérigo ----------
  { id: 'm_mag1', cls: 'Clérigo', name: 'Fé Radiante', desc: 'A luz fortalece a mente.', icon: 'magic', x: 50, y: 8, req: [], max: 3, effect: { kind: 'stat', stat: 'mag', per: 2 } },
  { id: 'm_hp1', cls: 'Clérigo', name: 'Voto de Vigor', desc: 'Guardião do grupo.', icon: 'potion', x: 20, y: 24, req: [], max: 3, effect: { kind: 'stat', stat: 'maxHp', per: 10 } },
  { id: 'm_thunder', cls: 'Clérigo', name: 'Ira Divina', desc: 'Aprende a magia Trovão.', icon: 'thunder', x: 80, y: 24, req: [], max: 1, effect: { kind: 'spell', spell: 'thunder' } },
  { id: 'm_focus', cls: 'Clérigo', name: 'Oração Contínua', desc: 'Fé que restaura mana.', icon: 'focus', x: 50, y: 26, req: ['m_mag1'], max: 2, effect: { kind: 'passive', passive: 'focus' } },
  { id: 'm_crit', cls: 'Clérigo', name: 'Julgamento', desc: 'Golpes certeiros contra o mal.', icon: 'crit', x: 14, y: 42, req: ['m_hp1'], max: 2, effect: { kind: 'passive', passive: 'crit' } },
  { id: 'm_hp2', cls: 'Clérigo', name: 'Coração Sagrado', desc: 'Um coração imenso.', icon: 'potion', x: 30, y: 58, req: ['m_hp1'], max: 1, effect: { kind: 'stat', stat: 'maxHp', per: 16 } },
  { id: 'm_regen', cls: 'Clérigo', name: 'Luz Curativa', desc: 'A luz fecha feridas.', icon: 'regen', x: 36, y: 44, req: ['m_focus'], max: 2, effect: { kind: 'passive', passive: 'regen' } },
  { id: 'm_def1', cls: 'Clérigo', name: 'Manto Protetor', desc: 'Proteção abençoada.', icon: 'guard', x: 64, y: 44, req: ['m_focus'], max: 3, effect: { kind: 'stat', stat: 'def', per: 2 } },
  { id: 'm_ice', cls: 'Clérigo', name: 'Luz Gélida', desc: 'Aprende a magia Gelo.', icon: 'ice', x: 88, y: 44, req: ['m_thunder'], max: 1, effect: { kind: 'spell', spell: 'ice' } },
  { id: 'm_tough', cls: 'Clérigo', name: 'Rocha da Fé', desc: 'Inabalável como a fé.', icon: 'tough', x: 70, y: 58, req: ['m_def1'], max: 2, effect: { kind: 'passive', passive: 'tough' } },
  { id: 'm_endure', cls: 'Clérigo', name: 'Milagre', desc: 'A luz não deixa você cair.', icon: 'guard', x: 12, y: 58, req: ['m_crit'], reqLevel: 4, max: 2, effect: { kind: 'passive', passive: 'endure' } },
  { id: 'm_charm', cls: 'Clérigo', name: 'Presença Santa', desc: 'Vitórias rendem mais XP.', icon: 'elixir', x: 46, y: 58, req: ['m_regen'], reqLevel: 2, max: 2, effect: { kind: 'passive', passive: 'charm' } },
];

/** @param {string} cls */
export const treeFor = (cls) => NODES.filter((n) => n.cls === cls);
/** @param {string} id */
export const nodeById = (id) => NODES.find((n) => n.id === id);

/** Nível investido num nó. @param {any} h @param {string} id */
export const getRank = (h, id) => (h.skills && h.skills[id]) || 0;

/** Nível total de uma passiva (soma dos nós). @param {any} h @param {string} passive */
export function skillRank(h, passive) {
  let r = 0;
  for (const n of NODES) {
    if (n.cls === h.cls && n.effect.kind === 'passive' && n.effect.passive === passive) r += getRank(h, n.id);
  }
  return r;
}

/** Passivas ativas do herói p/ UI. @param {any} h */
export function listPassives(h) {
  const out = [];
  for (const pid of Object.keys(PASSIVES)) {
    const r = skillRank(h, pid);
    if (r > 0) out.push({ ...PASSIVES[pid], rank: r });
  }
  return out;
}

/** Pré-requisitos atendidos? @param {any} h @param {any} node */
export const reqMet = (h, node) => node.req.every((r) => getRank(h, r) > 0);

/**
 * Pode investir? @param {any} h @param {any} node
 * @returns {{ok:boolean, reason:string}}
 */
export function canInvest(h, node) {
  if (!node || node.cls !== h.cls) return { ok: false, reason: 'no-node' };
  if (getRank(h, node.id) >= node.max) return { ok: false, reason: 'maxed' };
  if ((h.level || 1) < (node.reqLevel || 1)) return { ok: false, reason: 'level' };
  if (!reqMet(h, node)) return { ok: false, reason: 'locked' };
  if ((h.sp || 0) < (node.cost || 1)) return { ok: false, reason: 'no-sp' };
  return { ok: true, reason: '' };
}

/** Multiplicador de ouro do grupo (maior Alquimia). @param {any[]} party */
export function goldMult(party) {
  let m = 0;
  for (const h of party || []) m = Math.max(m, skillRank(h, 'gold'));
  return 1 + 0.1 * m;
}

/** Texto do efeito p/ UI. @param {any} node */
export function effectText(node) {
  const e = node.effect;
  if (e.kind === 'stat') return `+${e.per} ${STAT_NAMES[e.stat] || e.stat} por nível`;
  if (e.kind === 'spell') return `Aprende a magia ${(typeof e.spell === 'string' && e.spell[0].toUpperCase() + e.spell.slice(1)) || e.spell}`;
  if (e.kind === 'passive') return PASSIVES[e.passive]?.desc || '';
  return '';
}

/**
 * Investe 1 ponto e aplica o efeito. @param {any} h @param {any} node
 * @returns {{ok:boolean, reason:string}}
 */
export function invest(h, node) {
  const c = canInvest(h, node);
  if (!c.ok) return c;
  h.sp -= (node.cost || 1);
  h.skills = h.skills || {};
  h.skills[node.id] = getRank(h, node.id) + 1;
  applyEffect(h, node);
  return { ok: true, reason: '' };
}

/** Aplica o efeito de 1 nível do nó (sem checar custo). @param {any} h @param {any} node */
export function applyEffect(h, node) {
  const e = node.effect;
  if (e.kind === 'stat') {
    h[e.stat] = (h[e.stat] || 0) + e.per;
    if (e.stat === 'maxHp') h.hp = Math.min(h.maxHp, h.hp + e.per);
    if (e.stat === 'maxMp') h.mp = Math.min(h.maxMp, h.mp + e.per);
  } else if (e.kind === 'spell') {
    h.spells = h.spells || [];
    if (!h.spells.includes(e.spell)) h.spells.push(e.spell);
  }
  // passivas são derivadas via skillRank() — nada a mutar
}
