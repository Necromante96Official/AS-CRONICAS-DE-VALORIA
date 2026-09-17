/**
 * Config — constantes centrais do jogo.
 * @module core/Config
 */

/** Tamanho do tile em pixels. */
export const TILE = 32;
/** Resolução interna do canvas. */
export const VIEW_W = 960;
export const VIEW_H = 540;
/** Dimensões do mapa-múndi. */
export const MAP_W = 80;
export const MAP_H = 60;

/** Velocidade de movimento (px/s). */
export const PLAYER_SPEED = 150;
/** Chance de encontro por passo na grama alta. */
export const ENCOUNTER_RATE = 0.075;

/** Taxa de XP por nível (curva). */
export const xpForLevel = (level) => Math.floor(20 * Math.pow(level, 1.6));

/** Paleta / nomes de locais. */
export const LOCATIONS = {
  town: 'Vila Lumen',
  field: 'Planície Verdejante',
  forest: 'Bosque Sombrio',
  dungeon: 'Ruínas do Cristal',
  altar: 'Altar do Caos',
  beach: 'Praia do Sol',
  snow: 'Pico Nevado',
  desert: 'Deserto Dourado',
  swamp: 'Pântano Sombrio',
};
