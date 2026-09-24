/**
 * Config — constantes centrais do jogo.
 * @module core/Config
 */

/** Tamanho do tile em pixels. */
export const TILE = 32;
/** Escala de desenho dos atores (player/NPCs) ajustada ao HD — sprites 32x40 viram 48x60. */
export const ACTOR_HD = 1.5;
/** Resolução interna do canvas (HD). */
export const VIEW_W = 1280;
export const VIEW_H = 720;
/** Dimensões do mapa-múndi. */
export const MAP_W = 80;
export const MAP_H = 60;

/** Velocidade de movimento (px/s). */
export const PLAYER_SPEED = 150;
/** Chance de encontro por passo na grama alta (menor: há patrulheiros visíveis). */
export const ENCOUNTER_RATE = 0.05;

/** XP necessário para sair do nível `level` (curva JRPG: início fiel, fim íngreme). */
export const xpForLevel = (level) => Math.floor(14 * Math.pow(level, 1.8) + 6 * level);

/** Duração de um dia inteiro em segundos (amanhecer → noite). */
export const DAY_LEN = 300;

/**
 * Fase do dia p/ shaders e HUD. t=0 é o amanhecer.
 * @param {number} timeSec tempo acumulado do jogo
 * @returns {{t:number, night:number, label:string, icon:string}} night 0 (dia) .. 1 (noite funda)
 */
export function dayInfo(timeSec) {
  const t = (((timeSec % DAY_LEN) + DAY_LEN) % DAY_LEN) / DAY_LEN;
  const night = Math.pow(Math.max(0, -Math.sin(t * Math.PI * 2)), 0.7);
  const label = t < 0.12 ? 'madrugada' : t < 0.38 ? 'manhã' : t < 0.55 ? 'tarde' : t < 0.68 ? 'entardecer' : 'noite';
  const icon = night > 0.5 ? '🌙' : '☀️';
  return { t, night, label, icon };
}

/** Paleta / nomes de locais. */
export const LOCATIONS = {
  town: 'Vila Lumen',
  elder: 'Casa do Ancião',
  shop: 'Loja da Mira',
  inn: 'Estalagem do Bram',
  smith: 'Ferraria do Rurik',
  field: 'Planície Verdejante',
  forest: 'Bosque Sombrio',
  dungeon: 'Ruínas do Cristal',
  altar: 'Altar do Caos',
  beach: 'Praia do Sol',
  snow: 'Pico Nevado',
  desert: 'Deserto Dourado',
  swamp: 'Pântano Sombrio',
  cave: 'Caverna Ecoante',
};
