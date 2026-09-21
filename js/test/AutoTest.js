/**
 * AutoTest — bateria funcional automatizada (só carrega com ?autotest=1).
 * Dirige o Engine real com eventos de teclado sintéticos + chamadas internas,
 * cobrindo: título, movimento, diálogo, loja, estalagem, menu, save/load,
 * batalha (menus por teclado + magias + itens + fuga), derrota e boss/ending.
 * @module test/AutoTest
 */
import { SaveSystem } from '../systems/SaveSystem.js';
import { makeEncounter, makeEnemy, encounterTable } from '../entities/Enemies.js';
import { TILE } from '../core/Config.js';
import { regionAt } from '../world/MapData.js';
import { T } from '../world/Tiles.js';

/** @param {import('../core/Engine.js').Engine} game */
export async function runAutoTest(game) {
  const results = [];
  const details = [];
  window.addEventListener('error', (e) => {
    console.log(`[AUTOTEST] FAIL window-error ${e.message}`);
    details.push(`window-error: ${e.message}`);
    results.push(false);
  });
  const log = (ok, name, extra = '') => {
    results.push(!!ok);
    details.push(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
    console.log(`[AUTOTEST] ${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
  };
  const frames = (n = 3) => new Promise((res) => {
    let i = 0;
    const f = () => { if (++i >= n) res(); else requestAnimationFrame(f); };
    requestAnimationFrame(f);
  });
  async function waitFor(cond, timeoutMs) {
    const t0 = performance.now();
    while (performance.now() - t0 < timeoutMs) {
      try { if (cond()) return true; } catch (e) { /* tenta de novo */ }
      await frames(2);
    }
    return false;
  }
  /** Simula tecla real (keydown -> N frames -> keyup). */
  async function key(code, hold = 3) {
    window.dispatchEvent(new KeyboardEvent('keydown', { code }));
    await frames(hold);
    window.dispatchEvent(new KeyboardEvent('keyup', { code }));
    await frames(2);
  }
  /** Consome diálogo inteiro (primeira opção quando houver escolha). */
  async function dismissDialog() {
    let guard = 0;
    while (game.dialog.active && guard++ < 80) {
      game.dialog.charsShown = game.dialog.fullText.length;
      game.dialog._render();
      game.dialog._press(null);
      await frames(2);
    }
    return !game.dialog.active;
  }
  /** Fecha o menu de qualquer nível (Escape até fechar). */
  async function closeMenu() {
    let n = 0;
    while (game.menu.active && n++ < 6) await key('Escape');
    await frames(2);
    return !game.menu.active;
  }

  /** Teleporta o jogador. */
  function teleport(tx, ty, dir = 'down') {
    game.player.x = tx * TILE + 4;
    game.player.y = ty * TILE;
    game.player.dir = dir;
    game.camera.snap(game.player.cx, game.player.cy);
  }

  try {
    // ---- 1. título ----
    await frames(5);
    log(game.state === 'TITLE' && game.title.visible, 'boot-titulo');
    await key('ArrowDown'); // vai para "Como Jogar"
    await key('Enter');     // abre ajuda
    await key('Enter');     // volta ao menu (sel reseta em "Novo Jogo")
    await key('Enter');     // inicia!
    log(await waitFor(() => game.state === 'FIELD', 8000), 'novo-jogo-inicia');
    // o diálogo de intro aparece após o fade: espera ele abrir antes de dispensar
    log(await waitFor(() => game.dialog.active, 10000), 'intro-abriu');
    log(await dismissDialog(), 'intro-dispensada');

    // ---- 2. movimento por teclado (caminho reto, sem encontros) ----
    teleport(20, 30, 'right');
    await frames(3);
    const x0 = game.player.x;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }));
    await frames(40);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowRight' }));
    await frames(3);
    log(game.player.x > x0 + 40 && game.player.dir === 'right', 'movimento-seta', `x ${x0.toFixed(0)}→${game.player.x.toFixed(0)}`);

    // ---- 2b. corrida com Shift ----
    {
      teleport(20, 30, 'right');
      await frames(3);
      const sx0 = game.player.x;
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }));
      await frames(20);
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowRight' }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ShiftLeft' }));
      await frames(3);
      const dx = game.player.x - sx0;
      log(dx > 60, 'corrida-shift', `dx ${dx.toFixed(0)}px em 20 frames`);
    }

    // ---- 2c. banner de região + minimapa ----
    teleport(14, 38, 'down'); // garante troca de região (cidade -> campo)
    await frames(5);
    teleport(30, 25, 'down');
    log(await waitFor(() => document.getElementById('region-banner').textContent.includes('Planície'), 8000), 'banner-regiao');
    log(!!document.getElementById('minimap') && game.mmBase instanceof HTMLCanvasElement, 'minimapa-ok');

    // ---- 3. falar com o Ancião (presente + flag) ----
    const pot0 = game.inv.potion;
    teleport(14, 37, 'up');
    await key('KeyE');
    log(await waitFor(() => game.dialog.active, 5000, 'dialogo-anciao-abre'), 'dialogo-anciao-abre');
    log(await dismissDialog(), 'dialogo-anciao-fecha');
    log(game.inv.potion === pot0 + 2 && game.flags.metElder === true, 'presente-do-anciao', `pocoes ${pot0}→${game.inv.potion}`);

    // ---- 4. loja da Mira (compra via diálogo; loja reabre e esgota o ouro) ----
    const gold0 = game.gold, shopPot0 = game.inv.potion;
    teleport(17, 38, 'up');
    await key('KeyE');
    log(await waitFor(() => game.dialog.active, 5000, 'loja-abre'), 'loja-abre');
    log(await dismissDialog(), 'loja-fecha');
    log(game.gold < gold0 && game.inv.potion > shopPot0 && !game.dialog.active, 'loja-comprou', `ouro ${gold0}→${game.gold} pocao ${shopPot0}→${game.inv.potion}`);

    // ---- 5. estalagem do Bram (cura total por 20G) ----
    game.party.forEach((h) => { h.hp = 1; h.mp = 0; });
    const gold1 = game.gold;
    teleport(13, 41, 'down');
    await key('KeyE');
    log(await waitFor(() => game.dialog.active, 5000, 'estalagem-abre'), 'estalagem-abre');
    log(await dismissDialog(), 'estalagem-fecha');
    log(game.party.every((h) => h.hp === h.maxHp && h.mp === h.maxMp) && game.gold === gold1 - 20, 'estalagem-curou', `ouro ${gold1}→${game.gold}`);

    // ---- 5b. quest do Pip: aceita, acha, entrega ----
    {
      const kid = game.npcs.find((n) => n.id === 'kid');
      kid.x = kid.homeX; kid.y = kid.homeY;
      teleport(14, 40, 'up');
      await key('KeyE');
      log(await waitFor(() => game.dialog.active, 5000), 'quest-pip-fala');
      log(await dismissDialog(), 'quest-pip-fecha');
      log(game.flags.toyQuest === true, 'quest-pip-inicia');
      teleport(32, 21, 'down');
      await key('KeyE');
      log(await waitFor(() => game.dialog.active, 5000), 'quest-pip-acha-abre');
      log(document.getElementById('dialog-name').style.display === 'none', 'narrador-sem-nome');
      log(await dismissDialog(), 'quest-pip-acha-fecha');
      log(game.flags.toyFound === true, 'quest-pip-achou');
      kid.x = kid.homeX; kid.y = kid.homeY;
      teleport(14, 40, 'up');
      const gq0 = game.gold, hq0 = game.inv.hipotion;
      await key('KeyE');
      log(await waitFor(() => game.dialog.active, 5000), 'quest-pip-entrega-abre');
      log(await dismissDialog(), 'quest-pip-entrega-fecha');
      log(game.flags.toyRewarded === true && game.gold === gq0 + 150 && game.inv.hipotion === hq0 + 1,
        'quest-pip-recompensa', `ouro ${gq0}→${game.gold} hipoção ${hq0}→${game.inv.hipotion}`);
    }

    // ---- 5c. cristal restaurador das ruínas ----
    game.party.forEach((h) => { h.hp = 3; h.mp = 0; });
    teleport(54, 16, 'up');
    await key('KeyE');
    log(await waitFor(() => game.dialog.active, 5000), 'cristal-abre');
    log(await dismissDialog(), 'cristal-fecha');
    log(game.party.every((h) => h.hp === h.maxHp && h.mp === h.maxMp), 'cristal-curou');

    // ---- 6. menu de pausa por teclado (abas) ----
    await key('KeyQ');
    log(await waitFor(() => game.menu.active, 5000), 'menu-abre');
    await key('ArrowDown'); await key('ArrowUp'); // navega sem ativar
    await key('ArrowRight'); // aba Magia
    await key('ArrowLeft');  // volta p/ Itens
    await key('Escape');     // fecha
    await frames(3);
    log(!game.menu.active && game.menu.tab === 0, 'menu-navega-fecha');

    // ---- 6b. usar item pelo menu (poção na Lyra ferida) ----
    game.party[1].hp = 5;
    const potM = game.inv.potion;
    await key('KeyQ');
    log(await waitFor(() => game.menu.active, 5000), 'menu-item-abre');
    await key('Enter');          // Poção -> escolhe alvo
    await key('ArrowDown');      // alvo: Lyra
    await key('Enter');          // usa!
    await frames(3);
    log(game.party[1].hp === game.party[1].maxHp && game.inv.potion === potM - 1, 'menu-item-usado', `lyra ${5}→${game.party[1].hp} pocao ${potM}→${game.inv.potion}`);
    await key('Escape'); // fecha
    await frames(3);
    log(!game.menu.active, 'menu-item-fecha');

    // ---- 6c. magia em campo (Cura do Milo nele mesmo) ----
    game.party[2].hp = 5;
    game.party[2].mp = game.party[2].maxMp;
    const mpM = game.party[2].mp;
    await key('KeyQ');
    await key('ArrowRight');     // aba Magia
    await key('ArrowDown'); await key('ArrowDown'); // herói: Milo
    await key('Enter');          // lista de magias
    await key('Enter');          // Cura -> escolhe alvo
    await key('ArrowDown'); await key('ArrowDown'); // alvo: Milo
    await key('Enter');          // conjura!
    await frames(3);
    log(game.party[2].hp === game.party[2].maxHp && game.party[2].mp === mpM - 5, 'menu-magia-cura', `milo ${5}→${game.party[2].hp} mp ${mpM}→${game.party[2].mp}`);
    log(await closeMenu(), 'menu-magia-fecha');

    // ---- 6e. bomba de fumaça bloqueada em campo; éter com MP cheio ----
    game.inv.antidote = 1;
    await key('KeyQ');
    await key('ArrowDown'); await key('ArrowDown'); await key('ArrowDown'); // Bomba
    await key('Enter');
    await frames(3);
    log(document.getElementById('toast').textContent.includes('batalha') && game.inv.antidote === 1 && game.menu.active, 'bomba-só-batalha');
    await key('Escape');
    await key('KeyQ');
    game.party[2].mp = game.party[2].maxMp; // garante MP cheio p/ testar o bloqueio
    await key('ArrowDown'); await key('ArrowDown'); // Éter
    await key('Enter');                            // escolhe alvo
    await key('ArrowDown'); await key('ArrowDown'); // Milo (MP cheio)
    await key('Enter');
    await frames(3);
    log(document.getElementById('toast').textContent.includes('MP') && game.inv.ether === 1, 'eter-mp-cheio-bloqueia');
    log(await closeMenu(), 'menu-6e-fecha');

    // ---- 6d. aba Config alterna som ----
    await closeMenu();
    await key('KeyQ');
    await key('ArrowRight'); await key('ArrowRight'); await key('ArrowRight'); // aba Config
    await key('Enter');          // Som: Desligado
    await frames(3);
    log(game.audio.muted === true, 'menu-config-mudo');
    await key('Enter');          // Som: Ligado
    await frames(3);
    log(game.audio.muted === false, 'menu-config-som');
    log(await closeMenu(), 'menu-config-fecha');

    // ---- 6c. tecla M alterna mudo (e o HUD reflete) ----
    await key('KeyM');
    await frames(6);
    log(game.audio.muted === true && game.hud.goldEl.textContent.includes('🔇'), 'mute-on');
    await key('KeyM');
    await frames(6);
    log(game.audio.muted === false && game.hud.goldEl.textContent.includes('💰'), 'mute-off');

    // ---- 7. save/load ----
    game.gold = 777;
    log(SaveSystem.save(2, game._snapshot()), 'save-slot2');
    game.gold = 1;
    game._applySave(SaveSystem.load(2));
    log(game.gold === 777, 'load-slot2-restaura');
    SaveSystem.erase(2);

    // ---- 7b. Slime Rei aparece na planície (raro, Nv 3+) ----
    {
      let seen = false;
      for (let i = 0; i < 200 && !seen; i++) {
        if (makeEncounter('field', 5).some((e) => e.id === 'king')) seen = true;
      }
      log(seen, 'slime-rei-raro');
    }

    // ---- 7c. sobrescrever save pede confirmação ----
    game.gold = 111;
    SaveSystem.save(3, game._snapshot());
    game.gold = 222;
    await key('KeyQ');
    await key('ArrowRight'); await key('ArrowRight'); await key('ArrowRight'); await key('ArrowRight'); // Salvar
    await key('ArrowDown'); await key('ArrowDown');   // Slot 3 ocupado
    await key('Enter');                               // 1º: arma confirmação
    await frames(3);
    log(game.menu.active && SaveSystem.load(3).gold === 111, 'save-confirma-armada');
    await key('Enter');                               // 2º: salva de verdade
    await frames(3);
    log(!game.menu.active && SaveSystem.load(3).gold === 222, 'save-confirma-salva');
    SaveSystem.erase(3);

    // ---- 8. batalha selvagem (1ª rodada via MENUS de teclado, resto direto) ----
    game.party[0].hp = 10; // para a poção curar de verdade
    const goldB = game.gold;
    game._startWildBattle('field');
    log(await waitFor(() => game.state === 'BATTLE', 8000, 'batalha-inicia'), 'batalha-inicia');
    log(await waitFor(() => game.battle.phase === 'command', 15000, 'batalha-comando'), 'batalha-comando');
    await key('Enter'); await key('Enter');          // Kael: Atacar > alvo 0
    await key('ArrowDown'); await key('Enter');      // Lyra: Magia...
    await key('Enter'); await key('Enter');          // ...Fogo > alvo 0
    await key('ArrowDown'); await key('ArrowDown'); await key('Enter'); // Milo: Item...
    await key('Enter');                              // ...Poção...
    await key('Enter'); await key('Enter');          // ...alvo 0 (Kael ferido)
    // resto da batalha no automático (ataques)
    const autoWin = async (timeoutMs) => {
      const t0 = performance.now();
      while (performance.now() - t0 < timeoutMs) {
        if (!game.battle.active) return true;
        if (game.battle.phase === 'command') {
          while (game.battle.phase === 'command' && game.battle.active) {
            const i = game.battle.heroIdx;
            const h = game.battle.party[i];
            let act = { type: 'attack', target: 0 };
            const foe = game.battle.enemies.findIndex((e) => e.hp > 0);
            if (h.spells.includes('thunder') && h.mp >= 7) act = { type: 'magic', spell: 'thunder', target: Math.max(0, foe) };
            else if (h.spells.includes('fire') && h.mp >= 4) act = { type: 'magic', spell: 'fire', target: Math.max(0, foe) };
            game.battle._act(i, act);
            await frames(1);
          }
        }
        await frames(3);
      }
      return false;
    };
    log(await autoWin(180000), 'batalha-vitoria');
    log(game.state === 'FIELD' && game.gold > goldB, 'pos-batalha-ouro-xp', `ouro ${goldB}→${game.gold}`);

    // ---- 9. fuga com Bomba de Fumaça (1ª rodada: Analisar; depois foge) ----
    game.inv.antidote = 1;
    game._startWildBattle('field');
    log(await waitFor(() => game.battle.phase === 'command', 20000), 'fuga-batalha-abre');
    log(game.battle.el.classList.contains('bg-field'), 'batalha-bg-field');
    // grupo íntegro: garante que o portador da Bomba sobrevive até agir
    game.party.forEach((h) => { h.hp = h.maxHp; h.mp = h.maxMp; });
    await key('ArrowDown'); await key('ArrowDown'); await key('ArrowDown'); // Analisar
    await key('Enter');
    await key('Enter'); // Kael analisa o alvo 0 pelos menus
    // demais analisam direto; a última mensagem deve ser a análise
    while (game.battle.phase === 'command' && game.battle.active) {
      game.battle._act(game.battle.heroIdx, { type: 'scan', target: 0 });
      await frames(1);
    }
    log(await waitFor(() => game.battle.phase === 'exec' || !game.battle.active, 20000), 'analisar-registra');
    // conteúdo da análise: chamada síncrona direta (sem frames no meio)
    game.battle._heroAct(game.battle.party[0], 0, { type: 'scan', target: 0 });
    log(game.battle.msgEl.innerHTML.includes('HP') && game.battle.msgEl.innerHTML.includes('ATK'), 'analisar-mostra-dados');
    let fled = false;
    {
      const t0 = performance.now();
      while (performance.now() - t0 < 60000 && !fled) {
        if (!game.battle.active) { fled = game.state === 'FIELD'; break; }
        if (game.battle.phase === 'command') {
          while (game.battle.phase === 'command' && game.battle.active) {
            // Bomba para todos: quem agir primeiro foge (se um cair antes, outro usa)
            const a = game.inv.antidote > 0
              ? { type: 'flee', item: 'antidote' }
              : { type: 'flee' };
            game.battle._act(game.battle.heroIdx, a);
            await frames(1);
          }
        }
        await frames(3);
      }
    }
    log(game.inv.antidote === 0, 'bomba-consome-foge');
    log(fled && game.state === 'FIELD', 'fuga-funciona');

    // ---- 10. derrota determinística -> game over -> título ----
    // (zera o HP na fase de comando; o próximo passo detecta o wipe)
    log(await waitFor(() => game.state === 'FIELD' && !game.battle.active && !game._busy, 15000), 'entre-batalhas-estavel');
    game.party.forEach((h) => { h.hp = 1; h.mp = 0; });
    game._startWildBattle('dungeon');
    log(await waitFor(() => game.battle.phase === 'command', 20000), 'derrota-batalha-abre');
    while (game.battle.phase === 'command' && game.battle.active) {
      game.party.forEach((h) => { h.hp = 0; });
      game.battle._act(game.battle.heroIdx, { type: 'attack', target: 0 });
      await frames(1);
    }
    log(await waitFor(() => game.state === 'GAMEOVER', 30000), 'game-over-chegou');
    const goVisible = !document.getElementById('gameover').classList.contains('hidden');
    log(game.state === 'GAMEOVER' && goVisible, 'game-over');
    document.getElementById('btn-retry').click();
    await frames(5);
    log(await waitFor(() => game.state === 'TITLE', 5000, 'retry-volta-titulo'), 'retry-volta-titulo');

    // ---- 11. boss -> ending ----
    await game._onTitlePick('new');
    await dismissDialog();
    // buff pesado para vencer de forma determinística
    game.party.forEach((h) => {
      h.level = 10; h.maxHp = 220; h.hp = 220; h.maxMp = 120; h.mp = 120;
      h.atk = 34; h.def = 22; h.mag = 34; h.spd = 14;
      if (!h.spells.includes('thunder')) h.spells.push('thunder');
    });
    game.inv.potion = 5; game.inv.hipotion = 3; game.inv.ether = 3;
    teleport(54, 8, 'up');
    log(game._tryBossInteract() === true, 'boss-dialogo-abre');
    log(await dismissDialog(), 'boss-dialogo-lutar');
    log(await waitFor(() => game.state === 'BATTLE' && game.battle.isBoss, 15000), 'boss-batalha-inicia');
    log(!document.getElementById('boss-bar').classList.contains('hidden') &&
      document.getElementById('boss-name').textContent.includes('CAOS'), 'boss-bar-visivel');
    log(game.battle.el.classList.contains('bg-boss'), 'boss-bg-vermelho');
    // fúria: com HP baixo o chefe enfurece (síncrono e determinístico)
    {
      const boss = game.battle.enemies[0];
      boss.hp = Math.floor(boss.maxHp * 0.2);
      game.battle._enemyAct(boss, 0);
      log(boss.enraged === true && game.battle.msgEl.innerHTML.includes('ENFURECE'), 'boss-enfurece');
      boss.hp = boss.maxHp; boss.enraged = false; boss.atk -= 7;
    }
    log(await autoWin(240000), 'boss-vitoria');
    log(await waitFor(() => game.state === 'ENDING' && !document.getElementById('ending').classList.contains('hidden') && game.flags.bossDefeated, 20000), 'ending');

    // ---- 12. novas mecânicas: biomas, baú, pesca e caça ----
    await game._onTitlePick('new');
    await dismissDialog();
    log(regionAt(33, 44) === 'beach', 'bioma-praia');
    log(regionAt(30, 2) === 'snow', 'bioma-neve');
    log(encounterTable('snow').length > 0 && encounterTable('beach').length > 0, 'encontros-biomas');
    // baú da planície abre uma vez e dá o loot
    {
      const g0 = game.gold;
      teleport(28, 31, 'down');
      await frames(3);
      log(game._tryChest() === true, 'bau-abre');
      log(await dismissDialog(), 'bau-fecha');
      log(game.flags.chest_plain === true && game.gold === g0 + 80 && (game.inv.potion || 0) >= 1, 'bau-loot');
      log(game._tryChest() === true && game.flags.chest_plain === true, 'bau-vazio-reabre');
    }
    // pesca: vara + mini-game (lança, fisga no "!" e trava no verde)
    {
      teleport(43, 35, 'right');
      await frames(3);
      game._fishCd = 0; game._fishing = null;
      const fishCount = () => ['fish', 'lambari', 'royal', 'goldfish'].reduce((s, id) => s + (game.inv[id] || 0), 0);
      const fish0 = fishCount(), gold0 = game.gold;
      log(game._tryFish() === true, 'pesca-funciona');
      log(!!game._fishing, 'pesca-vara-visivel');
      log(!!game._fishing && !!game._fishing.spec && !!game._fishing.catch, 'pesca-especie-sorteada');
      log(game._tryFish() === false, 'pesca-cooldown');
      // simula a mordida e a fisgada com E (força peixe comum p/ recompensa determinística)
      game._fishing.phase = 'bite'; game._fishing.biteLeft = 0.9;
      game._fishPress();
      log(!!game._fishing && game._fishing.phase === 'reel', 'pesca-minigame');
      log(game._fishing.zoneW > 0 && game._fishing.zoneW <= 0.34, 'pesca-zona-valida');
      game._fishing.catch = { kind: 'fish', spec: game._fishing.spec };
      if (!game._fishing.spec.item) game._fishing.spec = { ...game._fishing.spec, item: 'fish', name: 'Peixe Fresco', icon: '🐟' };
      // trava o cursor no centro da zona verde
      game._fishing.cursor = game._fishing.zoneX + game._fishing.zoneW / 2;
      game._fishPress();
      log(fishCount() >= fish0 && game.gold >= gold0, 'pesca-recompensa');
      log(!!game._fishing && game._fishing.phase === 'caught', 'pesca-peixe-fisgado');
      game._endFish();
      log(!game._fishing && game._fishCd > 0, 'pesca-encerra');
      await dismissDialog(); // limpa possível diálogo de pérola
    }
    // quest de caça do Guarda Cato: aceita, conta 6 slimes, recompensa
    {
      const guard = game.npcs.find((n) => n.id === 'guard');
      game._talk(guard);
      log(await dismissDialog(), 'caca-aceita');
      log(game.flags.huntQuest === true, 'caca-quest-ativa');
      const g0 = game.gold, e0 = game.inv.ether || 0;
      await game._afterBattle({ victory: true, fled: false, xp: 0, gold: 0, boss: false, kills: ['slime', 'slime', 'slime', 'slime', 'slime', 'slime'] }, 'field');
      log((game.flags.huntCount || 0) >= 6, 'caca-conta-slimes');
      game._talk(guard);
      log(await dismissDialog(), 'caca-entrega');
      log(game.flags.huntRewarded === true && game.gold === g0 + 200 && (game.inv.ether || 0) === e0 + 1, 'caca-recompensa');
    }

    // ---- 13. mobile/colisão: atravessa NPC, tap-to-move e poço realocado ----
    log(game.map.tile(13, 38) !== T.WELL && game.map.tile(21, 41) === T.WELL, 'poco-realocado');
    // atravessa o Ancião (14,36) andando para baixo sem travar
    {
      teleport(14, 35, 'down');
      await frames(3);
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown' }));
      await frames(15);
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowDown' }));
      await frames(3);
      log(game.player.tileY >= 36, 'npc-atravessa', `tileY ${game.player.tileY}`);
    }
    // tap-to-move: rota até (25,30) e anda sozinho sem teclas
    {
      teleport(20, 30, 'right');
      await frames(3);
      game._tapWorld(25 * TILE + 16, 30 * TILE + 16);
      log((game._path?.length || 0) > 0, 'tap-rota-criada');
      const tx0 = game.player.x;
      await frames(50);
      log(game.player.x > tx0 + 40, 'tap-anda-sozinho', `x ${tx0.toFixed(0)}→${game.player.x.toFixed(0)}`);
      game._path = null; game._tapAct = null;
    }
    // tap através do rio usa a ponte (todos os passos pisáveis)
    {
      teleport(40, 30, 'right');
      await frames(3);
      game._tapWorld(50 * TILE + 16, 29 * TILE + 16);
      const ok = (game._path?.length || 0) > 0 &&
        game._path.every((w) => !game.map.solid(Math.floor(w.x / TILE), Math.floor(w.y / TILE)));
      log(ok, 'tap-usa-ponte', `${(game._path?.length || 0)} passos`);
      game._path = null; game._tapAct = null;
    }
    // toque na água: mira o pisável vizinho e prepara a pesca (abre a vara)
    {
      teleport(43, 35, 'right');
      await frames(3);
      game._fishCd = 0; game._fishing = null;
      game._tapWorld(44 * TILE + 16, 35 * TILE + 16);
      log(!!game._fishing, 'tap-pesca-chegou');
      game._cancelFish();
      await dismissDialog();
    }

    // ---- 14. mundo expandido: regiões, inimigos novos e especiais ----
    log(regionAt(66, 40) === 'desert', 'bioma-deserto');
    log(regionAt(12, 50) === 'swamp', 'bioma-pantano');
    log(regionAt(70, 10) === 'forest', 'bioma-bosque-leste');
    log(encounterTable('desert').some(([id]) => id === 'scorpion'), 'tabela-deserto');
    log(encounterTable('swamp').some(([id]) => id === 'shroom'), 'tabela-pantano');
    log(encounterTable('beach').some(([id]) => id === 'crab'), 'tabela-praia-crab');
    {
      const c = makeEnemy('crab', 1), s = makeEnemy('scorpion', 1), m = makeEnemy('shroom', 1);
      log(c.maxHp > 0 && s.atk > c.atk && m.maxHp > 0, 'stats-novos');
    }
    log(game.battle._scanFlavor('crab').includes('Pinça') &&
      game.battle._scanFlavor('scorpion').includes('Ferrão') &&
      game.battle._scanFlavor('shroom').includes('esporos'), 'scan-novos');
    // sprites gerados com tamanho válido
    {
      game.battle.start(game.party, game.inv,
        [makeEnemy('crab', 1), makeEnemy('scorpion', 1), makeEnemy('shroom', 1)],
        { region: 'desert', onEnd: () => {} });
      const ok = game.battle.enemyArt.length === 3 &&
        game.battle.enemyArt.every((cv) => cv && cv.width > 0 && cv.height > 0);
      log(ok, 'sprites-novos');
      game.battle.stop();
    }
    // buff pesado para testes de especiais determinísticos
    game.party.forEach((h) => {
      h.level = 10; h.maxHp = 220; h.hp = 220; h.maxMp = 120; h.mp = 120;
      h.atk = 34; h.def = 22; h.mag = 34; h.spd = 14;
    });
    // cogumelo se cura com esporos
    {
      game.battle.start(game.party, game.inv, [makeEnemy('shroom', 1)], { region: 'swamp', onEnd: () => {} });
      const e = game.battle.enemies[0];
      e.hp = Math.floor(e.maxHp * 0.3);
      let healed = false;
      for (let i = 0; i < 40 && !healed; i++) {
        const before = e.hp;
        game.battle._enemyAct(e, 0);
        if (e.hp > before) healed = true;
        for (const h of game.party) if (h.hp <= 0) h.hp = 1;
      }
      log(healed, 'shroom-cura');
      game.battle.stop();
    }
    // caranguejo e escorpião agem sem erro e causam dano
    {
      game.battle.start(game.party, game.inv, [makeEnemy('crab', 0.7), makeEnemy('scorpion', 0.7)], { region: 'desert', onEnd: () => {} });
      const hp0 = game.party.reduce((s, h) => s + h.hp, 0);
      for (let i = 0; i < 6; i++) {
        game.battle.enemies.forEach((e, j) => { if (e.hp > 0) game.battle._enemyAct(e, j); });
        for (const h of game.party) if (h.hp <= 0) h.hp = 1;
      }
      const hp1 = game.party.reduce((s, h) => s + h.hp, 0);
      log(hp1 < hp0, 'crab-scorpion-atacam');
      game.battle.stop();
    }
    // baú do deserto existe e abre
    {
      teleport(74, 37, 'down');
      await frames(3);
      const g0 = game.gold;
      log(game._tryChest() === true, 'bau-deserto-abre');
      log(await dismissDialog(), 'bau-deserto-fecha');
      log(game.flags.chest_desert === true && game.gold === g0 + 120, 'bau-deserto-loot');
    }
    // pescador presente e presenteia
    {
      const fisher = game.npcs.find((n) => n.id === 'fisher');
      log(!!fisher, 'pescador-existe');
      const f0 = game.inv.fish || 0;
      game._talk(fisher);
      log(await dismissDialog(), 'pescador-fala');
      log((game.inv.fish || 0) === f0 + 1, 'pescador-presente');
    }
    // avanço: herói corre até o alvo ao atacar; inimigo avança ao golpear
    {
      game.battle.start(game.party, game.inv, [makeEnemy('slime', 1)], { region: 'field', onEnd: () => {} });
      game.battle._heroAct(game.party[0], 0, { type: 'attack', target: 0 });
      const a = game.battle.anim;
      log(!!a && a.who === 'hero' && a.tx != null && a.tx < a.fx, 'ataque-avanca');
      const e = game.battle.enemies[0];
      e.hp = e.maxHp;
      game.battle._enemyAct(e, 0);
      const b = game.battle.anim;
      log(!!b && b.who === 'enemy', 'inimigo-avanca');
      game.battle.stop();
      for (const hh of game.party) { hh.hp = hh.maxHp; hh.mp = hh.maxMp; }
    }
  } catch (e) {
    console.log(`[AUTOTEST] FAIL excecao ${e && e.stack ? e.stack : e}`);
    details.push(`excecao: ${e && e.stack ? e.stack : e}`);
    results.push(false);
  }

  async function finish() {
    const passed = results.filter(Boolean).length;
    const total = results.length;
    console.log(`[AUTOTEST] RESULTADO ${passed}/${total}`);
    const div = document.createElement('div');
    div.id = 'autotest-result';
    div.textContent = `AUTOTEST ${passed}/${total}`;
    document.body.appendChild(div);
    window.__autotestDone = passed === total;
    try {
      await fetch('/__autotest_result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passed, total, details }),
      });
    } catch (e) { console.log('[AUTOTEST] FAIL post-result ' + e); }
  }
  await finish();
}
