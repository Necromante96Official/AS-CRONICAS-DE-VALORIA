/**
 * AutoTest — bateria funcional automatizada (só carrega com ?autotest=1).
 * Dirige o Engine real com eventos de teclado sintéticos + chamadas internas,
 * cobrindo: título, movimento, diálogo, loja, estalagem, menu, save/load,
 * batalha (menus por teclado + magias + itens + fuga), derrota e boss/ending.
 * @module test/AutoTest
 */
import { SaveSystem } from '../systems/SaveSystem.js';
import { makeEncounter, makeEnemy, makeEcho, encounterTable } from '../entities/Enemies.js';
import { newParty, grantXp, restoreParty, serializeParty, applyEquipBonus, equipBonusText } from '../entities/Party.js';
import { treeFor, nodeById, getRank, canInvest, invest, skillRank, listPassives, goldMult } from '../systems/SkillTree.js';
import { useItem, ITEMS, SHOP_STOCK, ITEM_CATS, newInventory } from '../systems/Inventory.js';
import { TILE, xpForLevel, DAY_LEN, dayInfo } from '../core/Config.js';
import { regionAt, CHESTS, HOUSES, buildInterior } from '../world/MapData.js';
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
    game.camera.snap(game.player.cx, game.player.cy, game.map.w * TILE, game.map.h * TILE);
  }
  /** Entra na casa `id` pela porta do mundo (teleporta p/ frente da porta + E). */
  async function enterHouse(id, dx, dy) {
    teleport(dx, dy, 'up');
    await frames(3);
    await key('KeyE');
    const ok = await waitFor(() => game.place && game.place.kind === 'interior' && game.place.id === id, 8000);
    // a transição (fade) ainda prende o update: espera liberar antes de falar/andar
    await waitFor(() => !game._busy, 8000);
    await frames(5);
    return ok;
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
    game.walkersEnabled = false; // patrulha visível desligada p/ determinismo (teste próprio em 9b)

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

    // ---- 3. falar com o Ancião (dentro de casa: porta + presente + flag) ----
    const pot0 = game.inv.potion;
    log(await enterHouse('elder', 10, 35), 'casa-anciao-entra');
    teleport(10, 6, 'up'); // em frente ao Ancião (10,5)
    await frames(3);
    await key('KeyE');
    log(await waitFor(() => game.dialog.active, 5000, 'dialogo-anciao-abre'), 'dialogo-anciao-abre');
    log(await dismissDialog(), 'dialogo-anciao-fecha');
    log(game.inv.potion === pot0 + 2 && game.flags.metElder === true, 'presente-do-anciao', `pocoes ${pot0}→${game.inv.potion}`);
    await game._exitHouse();
    log(await waitFor(() => game.place && game.place.kind === 'world', 8000), 'casa-anciao-sai');
    // a íris precisa liberar a tela (sem véu preto preso)
    log(await waitFor(() => document.getElementById('transition').style.opacity === '0', 8000), 'transicao-iris-limpa');

    // ---- 4. loja da Mira (dentro de casa: compra via diálogo; loja reabre e esgota o ouro) ----
    const gold0 = game.gold, shopPot0 = game.inv.potion;
    log(await enterHouse('shop', 21, 35), 'loja-entra');
    teleport(10, 5, 'up'); // em frente à Mira (10,4), atrás do balcão
    await frames(3);
    await key('KeyE');
    log(await waitFor(() => game.dialog.active, 5000, 'loja-abre'), 'loja-abre');
    log(await dismissDialog(), 'loja-fecha');
    log(game.gold < gold0 && game.inv.potion > shopPot0 && !game.dialog.active, 'loja-comprou', `ouro ${gold0}→${game.gold} pocao ${shopPot0}→${game.inv.potion}`);
    await game._exitHouse();
    await waitFor(() => game.place && game.place.kind === 'world', 8000);

    // ---- 5. estalagem do Bram (dentro de casa: cura total por 20G) ----
    game.party.forEach((h) => { h.hp = 1; h.mp = 0; });
    const gold1 = game.gold;
    log(await enterHouse('inn', 10, 46), 'estalagem-entra');
    teleport(10, 5, 'up'); // em frente ao Bram (10,4)
    await frames(3);
    await key('KeyE');
    log(await waitFor(() => game.dialog.active, 5000, 'estalagem-abre'), 'estalagem-abre');
    log(await dismissDialog(), 'estalagem-fecha');
    log(game.party.every((h) => h.hp === h.maxHp && h.mp === h.maxMp) && game.gold === gold1 - 20, 'estalagem-curou', `ouro ${gold1}→${game.gold}`);
    await game._exitHouse();
    await waitFor(() => game.place && game.place.kind === 'world', 8000);

    // ---- 5b. quest do Pip: aceita, acha, entrega ----
    {
      const kid = game.npcs.find((n) => n.id === 'kid');
      kid.x = kid.homeX; kid.y = kid.homeY;
      teleport(15, 38, 'up'); // praça, encarando a casa do Pip (15,37)
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
      teleport(15, 38, 'up');
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
    for (let i = 0; i < 9; i++) await key('ArrowDown'); // Bomba Fumaça (aba Batalha)
    await key('Enter');
    await frames(3);
    log(document.getElementById('toast').textContent.includes('batalha') && game.inv.antidote === 1 && game.menu.active, 'bomba-só-batalha');
    await key('Escape');
    await key('KeyQ');
    game.party[2].mp = game.party[2].maxMp; // garante MP cheio p/ testar o bloqueio
    await key('ArrowDown'); await key('ArrowDown'); await key('ArrowDown'); await key('ArrowDown'); // Éter (aba Mana)
    await key('Enter');                            // escolhe alvo
    await key('ArrowDown'); await key('ArrowDown'); // Milo (MP cheio)
    await key('Enter');
    await frames(3);
    log(document.getElementById('toast').textContent.includes('MP') && game.inv.ether === 1, 'eter-mp-cheio-bloqueia');
    log(await closeMenu(), 'menu-6e-fecha');

    // ---- 6f. itens novos: efeitos, loja, ícones e baús ----
    {
      const mk = (hp, maxHp, mp, maxMp) => ({ hp, maxHp, mp, maxMp, name: 'T' });
      let inv = newInventory();
      inv.strongpotion = 1; inv.megapotion = 1; inv.bigether = 1;
      inv.goldphoenix = 1; inv.megabomb = 1; inv.tonic = 1;
      let r = useItem(inv, 'strongpotion', mk(10, 200, 0, 10));
      log(r.ok && inv.strongpotion === 0, 'item-strongpotion');
      r = useItem(inv, 'megapotion', mk(10, 500, 0, 10));
      log(r.ok && r.msg.includes('320'), 'item-megapotion');
      r = useItem(inv, 'bigether', mk(10, 100, 5, 60));
      log(r.ok && r.msg.includes('40 MP'), 'item-bigether');
      r = useItem(inv, 'goldphoenix', mk(0, 120, 0, 10));
      log(r.ok, 'item-goldphoenix');
      r = useItem(inv, 'megabomb', mk(10, 100, 0, 10));
      log(!r.ok && inv.megabomb === 1, 'item-megabomb-campo');
      r = useItem(inv, 'tonic', mk(10, 100, 5, 60));
      log(r.ok && r.msg.includes('HP') && r.msg.includes('MP') && inv.tonic === 0, 'item-tonic');
      const stock = ['strongpotion', 'megapotion', 'bigether', 'goldphoenix', 'megabomb', 'tonic'];
      log(stock.every((id) => SHOP_STOCK.includes(id) && ITEMS[id]?.battle), 'item-loja');
      log(ITEM_CATS.every((c) => c.ids.every((id) => ITEMS[id])) &&
        ITEM_CATS.reduce((s, c) => s + c.ids.length, 0) === Object.keys(ITEMS).length, 'item-categorias');
      const plain = CHESTS.find((c) => c.id === 'plain');
      const desert = CHESTS.find((c) => c.id === 'desert');
      log(plain.loot.items.strongpotion === 1 && desert.loot.items.megabomb === 1, 'item-baus');
    }
    {
      // conteúdo rico das abas: categorias, efeitos, XP restante, nós, diário, save
      const { iconURL } = await import('../ui/ItemIcons.js');
      const okIcons = ['strongpotion', 'megapotion', 'bigether', 'goldphoenix', 'megabomb', 'tonic'].every((id) => {
        try {
          const u = iconURL(id);
          return typeof u === 'string' && u.startsWith('data:image/png;base64,') && u.length > 500;
        } catch { return false; }
      });
      log(okIcons, 'item-icones');
      // equipamentos: bônus, troca, remoção, migração e bloqueio de uso
      {
        const p = newParty();
        const k = p[0];
        log(k.equip.weapon === null && k.equip.armor === null && k.equip.charm === null, 'equip-vazio');
        applyEquipBonus(k, ITEMS.sword2, 1);
        log(k.atk === 11 + 4, 'equip-bonus');
        applyEquipBonus(k, ITEMS.sword2, -1);
        log(k.atk === 11, 'equip-remove');
        log(equipBonusText(ITEMS.armor3) === '+3 DEF · +20 HP máx', 'equip-texto');
        log(!useItem({ sword1: 1 }, 'sword1', k).ok, 'equip-uso-bloqueado');
        const atk0 = game.party[0].atk, latk0 = game.party[1].atk;
        const sw0 = game.inv.sword2 || 0;
        game._menuActions().equip('sword2', 0);
        log(game.party[0].atk === atk0 + 4 && game.party[0].equip.weapon === 'sword2', 'equip-fluxo');
        game._menuActions().equip('sword3', 0);
        log(game.party[0].atk === atk0 + 7 && game.party[0].equip.weapon === 'sword3', 'equip-troca');
        game._menuActions().equip('sword3', 1);
        log(game.party[0].atk === atk0 && game.party[1].atk === latk0 + 7 && game.party[1].equip.weapon === 'sword3', 'equip-move');
        game._menuActions().equip('sword3', 1);
        log(game.party[1].atk === latk0 && game.party[1].equip.weapon === null, 'equip-desequipa');
        log((game.inv.sword2 || 0) === sw0, 'equip-inv-intacto');
        const old = [{ name: 'X', cls: 'Maga', level: 1, xp: 0, hp: 1, maxHp: 1, mp: 1, maxMp: 1, atk: 1, def: 1, spd: 1, mag: 1, spells: [], sprite: 'mage' }];
        const mig = restoreParty(old);
        log(mig[0].equip.weapon === null && mig[0].equip.armor === null && mig[0].equip.charm === null, 'equip-migracao');
      }
      // magias novas na árvore: Terremoto (Lyra) e Pressa (Milo)
      {
        const p = newParty();
        const lyra = p[1]; lyra.level = 5; lyra.sp = 9;
        invest(lyra, nodeById('l_mag1')); invest(lyra, nodeById('l_focus')); invest(lyra, nodeById('l_focus'));
        invest(lyra, nodeById('l_arch'));
        log(invest(lyra, nodeById('l_quake')).ok && lyra.spells.includes('quake'), 'skill-quake');
        const milo = p[2]; milo.level = 5; milo.sp = 9;
        invest(milo, nodeById('m_mag1')); invest(milo, nodeById('m_thunder')); invest(milo, nodeById('m_ice'));
        invest(milo, nodeById('m_focus')); invest(milo, nodeById('m_focus'));
        log(invest(milo, nodeById('m_haste')).ok && milo.spells.includes('haste'), 'skill-haste');
      }
      game.menu.show({ party: game.party, inv: game.inv, gold: game.gold, time: '00:00', flags: game.flags, faces: game.faces }, () => {}, game._menuActions());
      await frames(3);
      const listTxt = () => document.getElementById('menu-list').textContent;
      const detailTxt = () => document.getElementById('menu-detail').textContent;
      log(['Cura', 'Mana', 'Batalha', 'Pesca', 'Especiais'].every((t) => listTxt().includes(t)), 'menu-itens-cats');
      game.menu.tab = 2; game.menu.sel = 0; game.menu._render();
      await frames(2);
      log(detailTxt().includes('Próx. Nv') && detailTxt().includes('nós'), 'menu-status-rico');
      game.menu.tab = 6; game.menu.sel = 0; game.menu._render();
      await frames(2);
      log(listTxt().includes('nós') && detailTxt().includes('Árvore de Skills'), 'menu-skills-rico');
      game.menu.tab = 4; game.menu.sel = 0; game.menu._render();
      await frames(2);
      SaveSystem.save(1, game._snapshot());
      game.menu._render();
      await frames(2);
      log(detailTxt().includes('Kael') && detailTxt().includes('Nv'), 'menu-save-rico');
      SaveSystem.erase(1);
      game.menu.tab = 5; game.menu.sel = 0; game.menu._render();
      await frames(2);
      log(listTxt().includes('Diário'), 'menu-quests-rico');
      game.menu.tab = 7; game.menu.sel = 0; game.menu._render();
      await frames(2);
      log(listTxt().includes('Bestiário'), 'menu-besta-aba');
      log(await closeMenu(), 'menu-rico-fecha');
    }

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
    log(game.audio.muted === true && game.hud.goldEl.querySelector('img.ic') !== null, 'mute-on');
    await key('KeyM');
    await frames(6);
    log(game.audio.muted === false && game.hud.goldEl.querySelector('img.ic') !== null, 'mute-off');

    // ---- 6d. ícones procedurais (todos os itens + comandos + magias) ----
    {
      const { iconURL, ic } = await import('../ui/ItemIcons.js');
      const ids = [...Object.keys(game.inv), 'fish', 'goldfish', 'fire', 'thunder', 'cure',
        'attack', 'magic', 'item', 'scan', 'flee', 'guard', 'gold', 'bed', 'save', 'quest',
        'status', 'config', 'sound', 'mute', 'slot', 'qdone', 'qtodo'];
      const ok = ids.every((id) => {
        try {
          const u = iconURL(id);
          return typeof u === 'string' && u.startsWith('data:image/png;base64,') && u.length > 500;
        } catch { return false; }
      });
      log(ok, 'icones-todos');
      log(ic('potion').includes('<img') && ic('goldfish').includes('class="ic"'), 'icones-img-tag');
      game.menu.show({ party: game.party, inv: game.inv, gold: game.gold, time: '00:00', flags: game.flags }, () => {}, game._menuActions());
      await frames(3);
      log(document.getElementById('menu-list').querySelector('img.ic') !== null, 'icones-menu-itens');
      log(await closeMenu(), 'icones-menu-fecha');
    }

    // ---- 7. save/load ----
    game.gold = 777;
    log(SaveSystem.save(2, game._snapshot()), 'save-slot2');
    game.gold = 1;
    game._applySave(SaveSystem.load(2));
    log(game.gold === 777, 'load-slot2-restaura');
    SaveSystem.erase(2);

    // ---- 6f. XP, níveis, stats e árvore de skills ----
    log(xpForLevel(1) === 20 && xpForLevel(2) === 60 && xpForLevel(10) > xpForLevel(5), 'xp-curva');
    {
      // level-up: +1✦, crescimento por classe, mensagem com Nv
      const p = newParty();
      const kael0 = { ...p[0] };
      const msgs = grantXp(p, xpForLevel(1));
      log(p[0].level === 2 && p[0].sp === 1 && p[0].xp === 0, 'level-sp', `nv${p[0].level} sp${p[0].sp}`);
      log(p[0].maxHp >= kael0.maxHp + 6 && p[0].atk === kael0.atk + 2 && p[0].def === kael0.def + 2, 'level-growth-kael');
      log(msgs.some((m) => m.includes('Nv 2') && m.includes('✦')), 'level-msg');
      const lyra0 = { ...p[1] };
      grantXp(p, xpForLevel(2));
      log(p[1].level === 3 && p[1].mag >= lyra0.mag + 3, 'level-growth-lyra');
      // atraso (catch-up): Nv1 abaixo da média ganha +25%
      const a = newParty();
      const b = newParty(); b[1].level = 5; b[2].level = 5; // média 3.67
      grantXp(a, 10); grantXp(b, 10);
      log(a[0].xp === 10 && b[0].xp === 13, 'xp-catchup', `${a[0].xp} vs ${b[0].xp}`);
    }
    {
      // árvore: pré-requisito bloqueia, investir gasta ✦ e aplica efeito
      const p = newParty();
      const kael = p[0];
      kael.sp = 3;
      const cure = nodeById('k_cure');
      const r0 = invest(kael, cure);
      log(!r0.ok && r0.reason === 'locked' && kael.sp === 3 && !kael.spells.includes('cure'), 'skill-locked');
      const atk1 = nodeById('k_atk1');
      const atk0 = kael.atk;
      log(invest(kael, atk1).ok && kael.atk === atk0 + 2 && kael.sp === 2 && getRank(kael, 'k_atk1') === 1, 'skill-stat');
      const atk2 = nodeById('k_atk2');
      log(canInvest(kael, atk2).ok && invest(kael, atk2).ok && getRank(kael, 'k_atk2') === 1, 'skill-req-ok');
      log(invest(kael, atk2).ok && getRank(kael, 'k_atk2') === 2 && kael.sp === 0, 'skill-rank2');
      log(!invest(kael, atk2).ok && !invest(kael, nodeById('k_hp1')).ok, 'skill-maxed-nosp');
      kael.sp = 3;
      log(invest(kael, nodeById('k_hp1')).ok, 'skill-hp');
      log(invest(kael, nodeById('k_regen')).ok && skillRank(kael, 'regen') === 1, 'skill-regen');
      log(invest(kael, cure).ok && kael.spells.includes('cure'), 'skill-spell');
      log(!invest(kael, nodeById('k_hp2')).ok, 'skill-no-sp');
      // passivas somam por nível
      kael.sp = 5;
      invest(kael, nodeById('k_crit')); invest(kael, nodeById('k_crit'));
      log(skillRank(kael, 'crit') === 2 && listPassives(kael).some((x) => x.name === 'Crítico' && x.rank === 2), 'skill-passive');
      // árvores por classe têm nós e links válidos (12/14/13)
      const okTrees = [['Guerreiro', 12], ['Maga', 14], ['Clérigo', 13]].every(([c, n]) => {
        const t = treeFor(c);
        return t.length === n && t.every((x) => x.req.every((r) => t.some((m) => m.id === r)));
      });
      log(okTrees, 'skill-trees');
      // save/load preserva sp + nós
      const snap = serializeParty(p);
      const back = restoreParty(JSON.parse(JSON.stringify(snap)));
      log(back[0].sp === kael.sp && getRank(back[0], 'k_atk1') === 1 && back[0].spells.includes('cure'), 'skill-save');
      // migração de save antigo (sem sp/skills): compensa ✦ por nível
      const old = [{ name: 'X', cls: 'Maga', level: 4, xp: 0, hp: 1, maxHp: 1, mp: 1, maxMp: 1, atk: 1, def: 1, spd: 1, mag: 1, spells: [], sprite: 'mage' }];
      const mig = restoreParty(old);
      log(mig[0].sp === 3 && typeof mig[0].skills === 'object', 'skill-migracao');
    }
    {
      // UI: aba Skills abre a árvore; investir pelo teclado gasta ✦; HUD mostra ✦
      game.party[0].sp = (game.party[0].sp || 0) + 2;
      const sp0 = game.party[0].sp, mh0 = game.party[0].maxHp;
      game.menu.show({ party: game.party, inv: game.inv, gold: game.gold, time: '00:00', flags: game.flags, faces: game.faces }, () => {}, game._menuActions());
      await frames(3);
      game.menu.tab = 6; game.menu.sel = 0; game.menu._render();
      await frames(2);
      log(document.getElementById('menu-list').textContent.includes('Árvore'), 'skills-aba');
      await key('Enter'); // abre a árvore do Kael
      await frames(3);
      log(game.skills.active === true && document.querySelectorAll('#skills-nodes .sk-node').length >= 9, 'skills-abre');
      await key('Enter'); // investe no 1º nó (k_hp1, destravado, +12 HP)
      await frames(3);
      log(game.party[0].maxHp === mh0 + 12 && game.party[0].sp === sp0 - 1, 'skills-investe', `sp=${game.party[0].sp}`);
      await key('Escape'); // fecha a árvore, volta ao menu
      await frames(3);
      log(game.skills.active === false && game.menu.active === true, 'skills-fecha');
      log(await closeMenu(), 'skills-menu-fecha');
      game.hud.render(game.party, game.gold, 'town', game.faces, false);
      log(document.getElementById('hud-party').innerHTML.includes('✦'), 'hud-sp');
    }

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

    // ---- 9b. patrulheiro visível: spawn, encosto inicia batalha, fuga volta ao campo ----
    game.walkersEnabled = true;
    game.walkers.length = 0;
    game._walkerT = 9999; // sem nascimentos naturais durante o teste
    game.party.forEach((h) => { h.hp = h.maxHp; h.mp = h.maxMp; });
    game.inv.antidote = 1;
    let w0 = null;
    for (const [tx, ty] of [[30, 25], [25, 25], [35, 25], [30, 20]]) {
      teleport(tx, ty, 'right');
      await frames(2);
      w0 = game._debugSpawnWalker();
      if (w0) break;
    }
    log(!!w0 && game.walkers.length === 1, 'patrulha-spawna');
    if (w0) {
      // cola no patrulheiro: o encosto dispara a batalha (após a graça pós-fuga)
      game.player.x = w0.cx - 12; game.player.y = w0.cy - 10;
    }
    log(await waitFor(() => game.state === 'BATTLE', 15000), 'patrulha-encosto-batalha');
    await frames(3);
    log(game.battle.active && game.battle.enemies.length >= 1, 'patrulha-grupo-formado');
    let fled2 = false;
    {
      const t0 = performance.now();
      while (performance.now() - t0 < 60000 && !fled2) {
        if (!game.battle.active) { fled2 = game.state === 'FIELD'; break; }
        if (game.battle.phase === 'command') {
          while (game.battle.phase === 'command' && game.battle.active) {
            const a = game.inv.antidote > 0 ? { type: 'flee', item: 'antidote' } : { type: 'flee' };
            game.battle._act(game.battle.heroIdx, a);
            await frames(1);
          }
        }
        await frames(3);
      }
    }
    log(fled2 && game.state === 'FIELD', 'patrulha-foge');
    game.walkersEnabled = false;

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
      log((game.flags.bestiary?.slime || 0) >= 6, 'bestiario-conta');
      game.menu.show({ party: game.party, inv: game.inv, gold: game.gold, time: '00:00', flags: game.flags, faces: game.faces }, () => {}, game._menuActions());
      await frames(2);
      game.menu.tab = 7; game.menu.sel = 0; game.menu._render();
      await frames(2);
      log(document.getElementById('menu-list').textContent.includes('Slime') && document.getElementById('menu-detail').textContent.includes('Derrotados'), 'bestiario-visto');
      log(await closeMenu(), 'bestiario-fecha');
    }

    // ---- 13. mobile/colisão: atravessa NPC, tap-to-move e poço realocado ----
    log(game.map.tile(15, 38) !== T.WELL && game.map.tile(22, 38) === T.WELL, 'poco-realocado');
    // atravessa o Pip (15,37) andando para baixo sem travar
    {
      teleport(15, 36, 'down');
      await frames(3);
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown' }));
      await frames(15);
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowDown' }));
      await frames(3);
      log(game.player.tileY >= 37, 'npc-atravessa', `tileY ${game.player.tileY}`);
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
    // ---- 14b. Caverna Ecoante: boca, guardião, recompensa e bestiário ----
    log(HOUSES.some((h) => h.id === 'cave' && h.door.x === 46 && h.door.y === 14), 'caverna-porta');
    log(makeEcho().id === 'echo' && makeEcho().hp > 0, 'caverna-eco-inimigo');
    {
      const ci = buildInterior('cave');
      log(ci.w === 26 && ci.h === 18 && ci.tiles[17 * 26 + 13] === T.DOOR, 'caverna-mapa');
    }
    log(await enterHouse('cave', 46, 15), 'caverna-entra');
    {
      const echo = game.npcs.find((n) => n.id === 'echo');
      log(!!echo, 'caverna-eco');
      game._talk(echo);
      log(await waitFor(() => game.dialog.active, 5000), 'caverna-fala');
      game.dialog.charsShown = game.dialog.fullText.length;
      game.dialog._render();
      await frames(2);
      log(document.getElementById('dialog-text').textContent.includes('LUTAR'), 'caverna-opcoes');
      game.dialog.optSel = 1;
      log(await dismissDialog(), 'caverna-recua');
      log(!game.flags.caveCleared && game.state === 'FIELD', 'caverna-sem-luta');
    }
    await game._exitHouse();
    log(await waitFor(() => game.place?.kind === 'world', 8000), 'caverna-sai');
    {
      const sw0 = game.inv.sword2 || 0;
      await game._afterBattle({ victory: true, fled: false, xp: 0, gold: 0, cave: true, kills: ['echo'] }, 'dungeon');
      await dismissDialog();
      log(game.flags.caveCleared === true && (game.inv.sword2 || 0) === sw0 + 1, 'caverna-recompensa');
      log((game.flags.bestiary?.echo || 0) >= 1, 'bestiario-eco');
    }
    // ciclo dia/noite + pouso na estalagem + portas no minimapa
    {
      const { dayInfo: di, DAY_LEN: dl } = await import('../core/Config.js');
      const d0 = di(0);
      log(d0.t === 0 && d0.night === 0 && d0.icon === '☀️' && d0.label === 'madrugada', 'dia-amanhecer');
      const d1 = di(dl * 0.85);
      log(d1.night > 0.5 && d1.icon === '🌙' && d1.label === 'noite', 'dia-noite');
      const d2 = di(dl * 0.25);
      log(d2.night === 0 && d2.label === 'manhã', 'dia-manha');
      game.time = 200;
      game._restUntilMorning();
      log(Math.abs(di(game.time).t - 0.03) < 0.005, 'dia-pouso');
      teleport(15, 38, 'down');
      await frames(3);
      game.hud.renderMinimap(game.mmBase, game.camera.ox, game.camera.oy, game.player.tileX, game.player.tileY, null, [], [{ x: 10, y: 34 }]);
      const px = game.hud.mm.getContext('2d').getImageData(20, 68, 1, 1).data;
      log(px[0] > 200 && px[1] > 150 && px[2] < 150, 'minimap-portas');
    }
    // quest Eco da Forja (Sana, na ferraria)
    log(await enterHouse('smith', 21, 46), 'forja-entra');
    {
      game.flags.forgeQuest = false;
      game.flags.forgeRewarded = false;
      const cc0 = !!game.flags.caveCleared;
      const sana = game.npcs.find((n) => n.id === 'appr');
      sana.x = sana.homeX; sana.y = sana.homeY;
      teleport(15, 11, 'up');
      await frames(3);
      await key('KeyE');
      log(await waitFor(() => game.dialog.active, 5000), 'forja-fala');
      log(await dismissDialog(), 'forja-fecha');
      log(game.flags.forgeQuest === true, 'forja-inicia');
      game.flags.caveCleared = false;
      game._talk(sana);
      log(await waitFor(() => game.dialog.active, 5000), 'forja-dica-abre');
      game.dialog.charsShown = game.dialog.fullText.length;
      game.dialog._render();
      await frames(2);
      log(document.getElementById('dialog-text').textContent.includes('oeste das Ruínas'), 'forja-dica');
      log(await dismissDialog(), 'forja-dica-fecha');
      game.flags.caveCleared = true;
      const g0 = game.gold, mb0 = game.inv.megabomb || 0;
      game._talk(sana);
      log(await waitFor(() => game.dialog.active, 5000), 'forja-entrega-abre');
      log(await dismissDialog(), 'forja-entrega-fecha');
      log(game.flags.forgeRewarded === true && game.gold === g0 + 150 && (game.inv.megabomb || 0) === mb0 + 2, 'forja-recompensa');
      game._talk(sana);
      log(await waitFor(() => game.dialog.active, 5000), 'forja-fim-abre');
      log(await dismissDialog(), 'forja-fim-fecha');
      void cc0;
    }
    await game._exitHouse();
    log(await waitFor(() => game.place?.kind === 'world', 8000), 'forja-sai');
    // patrulha dentro da caverna + Peixe-Lua noturno
    log(await enterHouse('cave', 46, 15), 'caverna-reentra');
    game.walkersEnabled = true;
    game._touchGrace = 999;
    game._walkerLockUntil = 0;
    game._walkerT = 0; // o teste da patrulha congela o timer; libera aqui
    log(await waitFor(() => game.walkers.length > 0, 12000), 'caverna-patrulha');
    game.walkers.length = 0;
    game.walkersEnabled = false;
    game._touchGrace = 0;
    await game._exitHouse();
    await waitFor(() => game.place?.kind === 'world', 8000);
    {
      const { iconURL } = await import('../ui/ItemIcons.js');
      const u = iconURL('moonfish');
      log(typeof u === 'string' && u.startsWith('data:image/png;base64,') && u.length > 500, 'peixelua-icone');
      const inv = { moonfish: 1 };
      const r = useItem(inv, 'moonfish', { hp: 10, maxHp: 200, mp: 0, maxMp: 10, name: 'T' });
      log(r.ok && r.msg.includes('90'), 'peixelua-efeito');
      game.time = 20; // manhã: Peixe-Lua nunca morde
      let dayHit = false;
      for (let i = 0; i < 50; i++) {
        const c = game._pickCatch();
        if (c.kind === 'fish' && c.spec?.id === 'moonfish') { dayHit = true; break; }
      }
      log(!dayHit, 'peixelua-dia-nunca');
      game.time = 255; // noite funda
      let seenNight = false;
      for (let i = 0; i < 300 && !seenNight; i++) {
        const c = game._pickCatch();
        if (c.kind === 'fish' && c.spec?.id === 'moonfish') seenNight = true;
      }
      log(seenNight, 'peixelua-noite');
      game.time = 20; // de volta à manhã
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
    // NPCs vivos e detalhados: artes por profissão + olham ao redor + rastros
    {
      const arts = ['fisher', 'nomad', 'hunter'].map((k) => game.npcArt[k]);
      log(arts.every((a) => a && a.down && a.down.length === 2), 'npc-artes-profissao');
      const guard = game.npcs.find((n) => n.id === 'guard');
      guard.wt = 0;
      guard.update(0.05, game.map);
      log(['down', 'left', 'right', 'up'].includes(guard.dir), 'npc-olha-ao-redor');
      const w0 = game._wx.length;
      game.player.moving = true; game.player.running = true;
      game._poofT = 1; game._smokeT = 1; game._ghostT = 1;
      game._emitTrail(0.3);
      log(game._wx.length > w0, 'rastro-corrida');
      game.player.running = false;
      game._walkT = 1;
      const w1 = game._wx.length;
      game._emitTrail(0.4);
      log(game._wx.length > w1, 'rastro-caminhada');
      game.player.moving = false; game.player.running = false;
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
    // Terremoto atinge todos os inimigos; Pressa acelera o aliado
    {
      const p = newParty();
      p[1].spells.push('quake'); p[1].mp = p[1].maxMp;
      p[2].spells.push('haste'); p[2].mp = p[2].maxMp;
      game.battle.start(p, game.inv, [makeEnemy('slime', 1), makeEnemy('slime', 1)], { region: 'field', onEnd: () => {} });
      const e0 = game.battle.enemies[0].hp, e1 = game.battle.enemies[1].hp;
      game.battle._heroAct(p[1], 1, { type: 'magic', spell: 'quake' });
      log(game.battle.enemies[0].hp < e0 && game.battle.enemies[1].hp < e1, 'magia-quake');
      const s0 = p[0].spd;
      game.battle._heroAct(p[2], 2, { type: 'magic', spell: 'haste', target: 0 });
      log(p[0].spd === s0 + 5, 'magia-haste');
      game.battle.stop();
    }
    // passivas novas: nível mínimo, carisma no XP e efeitos em batalha
    {
      const p = newParty();
      const lyra = p[1]; lyra.sp = 9;
      invest(lyra, nodeById('l_mag1')); invest(lyra, nodeById('l_mp1')); invest(lyra, nodeById('l_crit'));
      const d0 = invest(lyra, nodeById('l_dodge'));
      log(!d0.ok && d0.reason === 'level' && lyra.sp === 6, 'pass-reqlevel');
      lyra.level = 3;
      log(invest(lyra, nodeById('l_dodge')).ok && skillRank(lyra, 'dodge') === 1, 'pass-reqlevel-ok');
      const milo = p[2];
      milo.skills = { m_charm: 2 };
      const q = newParty(); q[2].skills = { m_charm: 2 };
      grantXp(q, 10);
      log(q[2].xp === 13 && q[0].xp === 10, 'pass-charm-xp');
      log(goldMult(q) === 1, 'pass-gold-neutro');
      const gg = newParty(); gg[1].level = 5; gg[1].sp = 9;
      invest(gg[1], nodeById('l_mag1')); invest(gg[1], nodeById('l_focus')); invest(gg[1], nodeById('l_focus'));
      invest(gg[1], nodeById('l_arch')); invest(gg[1], nodeById('l_gold')); invest(gg[1], nodeById('l_gold'));
      log(skillRank(gg[1], 'gold') === 2 && Math.abs(goldMult(gg) - 1.2) < 1e-9, 'pass-gold');
    }
    // Milagre: sobrevive ao letal 2x (cargas) e cai no 3º
    {
      const p = newParty();
      const t = p[2]; t.maxHp = 200; t.hp = 200; t.skills = { m_endure: 2 };
      game.battle.start(p, game.inv, [makeEnemy('slime', 1)], { region: 'field', onEnd: () => {} });
      const e = game.battle.enemies[0];
      game.battle._hurtHero(t, 9999, e, 0, 'esmaga');
      const s1 = t.hp === 1;
      game.battle._hurtHero(t, 9999, e, 0, 'esmaga');
      const s2 = t.hp === 1;
      game.battle._hurtHero(t, 9999, e, 0, 'esmaga');
      log(s1 && s2 && t.hp <= 0, 'pass-endure');
      game.battle.stop();
    }
    // Revide + esquiva (RNG travado) e roubo de vida
    {
      const rnd = Math.random;
      Math.random = () => 0;
      const p = newParty();
      const t = p[0]; t.maxHp = 200; t.hp = 200; t.atk = 30; t.skills = { k_counter: 2 };
      game.battle.start(p, game.inv, [makeEnemy('slime', 1)], { region: 'field', onEnd: () => {} });
      const e = game.battle.enemies[0];
      const ehp = e.hp;
      game.battle._hurtHero(t, 10, e, 0, 'cutuca');
      const counterOk = e.hp < ehp && t.hp === 190;
      game.battle.stop();
      const q = newParty();
      const d = q[1]; d.maxHp = 200; d.hp = 200; d.skills = { l_dodge: 2 };
      game.battle.start(q, game.inv, [makeEnemy('slime', 1)], { region: 'field', onEnd: () => {} });
      const e2 = game.battle.enemies[0];
      game.battle._hurtHero(d, 50, e2, 0, 'morde');
      const dodgeOk = d.hp === 200 && game.battle.msgEl.innerHTML.includes('esquivou');
      game.battle.stop();
      Math.random = rnd;
      log(counterOk, 'pass-counter');
      log(dodgeOk, 'pass-dodge');
      const r = newParty();
      const k = r[0]; k.atk = 40; k.maxHp = 200; k.hp = 100; k.skills = { k_leech: 2 };
      game.battle.start(r, game.inv, [makeEnemy('slime', 1)], { region: 'field', onEnd: () => {} });
      game.battle._heroAct(k, 0, { type: 'attack', target: 0 });
      log(k.hp > 100, 'pass-lifesteal', `hp=${k.hp}`);
      game.battle.stop();
    }
    // Pressa: herói com swift entra antes na fila do turno
    {
      const p = newParty();
      p[1].skills = { l_swift: 2 };
      const e = makeEnemy('slime', 1); e.spd = 0;
      game.battle.start(p, game.inv, [e], { region: 'field', onEnd: () => {} });
      game.battle.actions = [{ type: 'attack', target: 0 }, { type: 'attack', target: 0 }, { type: 'attack', target: 0 }];
      game.battle._beginExec();
      const q = game.battle.queue;
      const qLyra = q.find((t) => t.side === 'hero' && t.idx === 1);
      const qKael = q.find((t) => t.side === 'hero' && t.idx === 0);
      log(!!qLyra && (qLyra.spd - p[1].spd) >= 6 && !!qKael && (qKael.spd - p[0].spd) < 6, 'pass-swift');
      game.battle.stop();
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
