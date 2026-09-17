/**
 * types.d.ts — tipos centrais do projeto (usados pelo tsc para checar o JS via checkJs).
 * O código é JavaScript modular com JSDoc; este arquivo declara os formatos
 * de dados compartilhados (saves, ações de batalha, definições de mapa).
 */

export interface HeroData {
  name: string;
  cls: string;
  level: number;
  xp: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  atk: number;
  def: number;
  spd: number;
  mag: number;
  spells: string[];
  sprite: string;
}

export interface EnemyData {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  xp: number;
  gold: number;
  sprite: string;
  boss?: boolean;
}

export interface SaveData {
  x: number;
  y: number;
  dir: string;
  party: HeroData[];
  inv: Record<string, number>;
  gold: number;
  flags: Record<string, boolean | string | number>;
  savedAt?: number;
}

export interface BattleResult {
  victory: boolean;
  fled: boolean;
  xp: number;
  gold: number;
  boss: boolean;
}

export interface NpcDef {
  id: string;
  x: number;
  y: number;
  name: string;
  kind: string;
  wander?: boolean;
  lines?: string[];
  shop?: boolean;
  inn?: boolean;
  gift?: string | null;
}
