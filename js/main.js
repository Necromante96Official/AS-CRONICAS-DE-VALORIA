/**
 * main — ponto de entrada. Cria o Engine e inicia o jogo.
 * Controles: Setas/WASD mover · E/Enter confirmar · Q/Esc menu.
 * @module main
 */
import { Engine } from './core/Engine.js';

window.addEventListener('DOMContentLoaded', async () => {
  const game = new Engine();
  game.init();
  // expõe para debug no console
  window.valoria = game;
  // sinaliza boot OK (o overlay de diagnóstico some sozinho)
  window.__valoriaBooted = true;
  if (window.__valoriaBootTimer) clearTimeout(window.__valoriaBootTimer);
  // bateria funcional automatizada (só com ?autotest=1)
  if (new URLSearchParams(location.search).has('autotest')) {
    const { runAutoTest } = await import('./test/AutoTest.js');
    runAutoTest(game);
  }
});
