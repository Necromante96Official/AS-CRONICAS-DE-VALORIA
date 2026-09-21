/**
 * Engine — orquestra o jogo: título, exploração, diálogo, loja, batalha, saves.
 * @module core/Engine
 */
import { TILE, VIEW_W, VIEW_H, ENCOUNTER_RATE } from './Config.js';
import { Input } from './Input.js';
import { AudioMan } from './Audio.js';
import { Camera } from './Camera.js';
import { TileMap } from '../world/TileMap.js';
import { buildMap, regionAt, SPAWN, NPC_DEFS, BOSS_ALTAR, TOY_SPOT, HEAL_CRYSTAL, CHESTS, HUNT_GOAL } from '../world/MapData.js';
import { isEncounterTile, tileColor, T } from '../world/Tiles.js';
import { NPC } from '../world/NPCs.js';
import { Player } from '../entities/Player.js';
import { newParty, aliveHeroes, restoreParty, serializeParty, fullHeal } from '../entities/Party.js';
import { makeEncounter, makeBoss } from '../entities/Enemies.js';
import { newInventory, useItem, ITEMS, SHOP_STOCK } from '../systems/Inventory.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { loadSettings, saveSettings, SPEED_ORDER } from '../systems/Settings.js';
import { Dialog } from '../ui/Dialog.js';
import { Menu } from '../ui/Menu.js';
import { HUD } from '../ui/HUD.js';
import { TitleScreen } from '../ui/TitleScreen.js';
import { Transition, toast } from '../ui/Transition.js';
import { BattleSystem } from '../battle/BattleSystem.js';
import { makeHumanoid, makeDragon, makeCrystal, humanoidFace, dragonFace } from './SpriteFactory.js';
import { SPELLS } from '../entities/Party.js';

const NPC_PALETTES = {
  elder:    { skin: '#e8b88a', hair: '#dddddd', tunic: '#3b4a8c', pants: '#2a2a3a' },
  merchant: { skin: '#f7d7b5', hair: '#8a4a1e', tunic: '#c23b6e', pants: '#3a2a4a' },
  innkeep:  { skin: '#d89a6a', hair: '#4a2f14', tunic: '#2e7d4f', pants: '#3a3a2a' },
  kid:      { skin: '#f2c89b', hair: '#e8a23c', tunic: '#4fc3ff', pants: '#5a4a6e' },
  guard:    { skin: '#e8b88a', hair: '#222222', tunic: '#8c8c9c', pants: '#3a3a4a' },
  hermit:   { skin: '#c89878', hair: '#eeeeee', tunic: '#5e4a7a', pants: '#2a2a3a' },
  fisher:   { skin: '#d89a6a', hair: '#3a2a1a', tunic: '#2e7d8c', pants: '#4a3a2a' },
  nomad:    { skin: '#c89878', hair: '#1e1e1e', tunic: '#c2691e', pants: '#5e3a17' },
  hunter:   { skin: '#e8b88a', hair: '#e8e8e8', tunic: '#3f6b4a', pants: '#2a2a3a' },
};

const HERO_PALETTES = {
  hero:   { skin: '#f2c89b', hair: '#7a4a21', tunic: '#2b6fd6', pants: '#3a3a5a', cape: '#c22a3a' },
  mage:   { skin: '#f7d7b5', hair: '#c23b6e', tunic: '#6a3ec2', pants: '#2a2a4a' },
  cleric: { skin: '#e8b88a', hair: '#3a3a3a', tunic: '#e8e4da', pants: '#5a6e8c' },
};

const GAMEOVER_TIPS = [
  'Dica: treine na grama alta da planície antes das Ruínas.',
  'Dica: a magia Cura do Milo economiza poções.',
  'Dica: a estalagem do Bram cura tudo por 20G.',
  'Dica: Trovão causa dano massivo em um alvo.',
  'Dica: Bomba de Fumaça garante fuga da batalha.',
  'Dica: guarde Éteres para a magia do fim.',
];

export class Engine {
  constructor() {
    this.cv = document.getElementById('game');
    this.g = this.cv.getContext('2d');
    this.g.imageSmoothingEnabled = false;
    this.input = new Input();
    this.audio = new AudioMan();
    this.camera = new Camera();
    this.dialog = new Dialog(this.audio);
    this.menu = new Menu(this.audio);
    this.hud = new HUD();
    this.title = new TitleScreen(this.audio);
    this.battle = new BattleSystem(this.audio);
    this.state = 'TITLE';
    this.time = 0;
    this.gold = 120;
    this.flags = { bossDefeated: false, metElder: false };
    this.npcArt = {};
    for (const [k, p] of Object.entries(NPC_PALETTES)) this.npcArt[k] = makeHumanoid(p, { kind: k });
    this.heroArts = {};
    for (const [k, p] of Object.entries(HERO_PALETTES)) this.heroArts[k] = makeHumanoid(p, { kind: k });
    this.heroArt = this.heroArts.hero;
    this.dragonArt = makeDragon();
    this.crystalArt = makeCrystal();
    // retratos (diálogo + HUD) pré-renderizados
    const faceURL = (cv) => cv.toDataURL();
    this.faces = {
      hero: faceURL(humanoidFace(this.heroArts.hero)),
      mage: faceURL(humanoidFace(this.heroArts.mage)),
      cleric: faceURL(humanoidFace(this.heroArts.cleric)),
    };
    this.faceCanvas = {
      Kael: humanoidFace(this.heroArts.hero),
      Lyra: humanoidFace(this.heroArts.mage),
      Milo: humanoidFace(this.heroArts.cleric),
      'Ancião Theo': humanoidFace(this.npcArt.elder),
      'Mira (Loja)': humanoidFace(this.npcArt.merchant),
      'Bram (Estalagem)': humanoidFace(this.npcArt.innkeep),
      Pip: humanoidFace(this.npcArt.kid),
      'Guarda Cato': humanoidFace(this.npcArt.guard),
      'Eremita Sable': humanoidFace(this.npcArt.hermit),
      'Pescador Kai': humanoidFace(this.npcArt.fisher),
      'Nômade Zara': humanoidFace(this.npcArt.nomad),
      'Caçadora Liv': humanoidFace(this.npcArt.hunter),
      'DRAGÃO DO CAOS': dragonFace(this.dragonArt),
    };
    this.dialog.portraitProvider = (name) => this.faceCanvas[name] || null;
    // preferências + tempo de jogo
    const cfg = loadSettings();
    this.dialog.speed = cfg.speed || 'normal';
    this.playSec = 0;
    this._playT0 = null;
    // clima/ambiente por bioma + cooldown da pesca
    this._wx = [];
    this._fishCd = 0;
    // toque-para-andar: caminho ativo, intenção ao chegar e marca visual
    this._path = null;
    this._pathRun = false;
    this._tapAct = null;
    this._tapMark = null;
    this._tapDown = null;
    this.cv.addEventListener('pointerdown', (e) => {
      this._tapDown = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
    });
    this.cv.addEventListener('pointerup', (e) => {
      const d = this._tapDown;
      this._tapDown = null;
      if (!d || e.pointerId !== d.id) return;
      if (performance.now() - d.t > 500) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 14) return;
      this._handleTap(e.clientX, e.clientY);
    });
    this.cv.addEventListener('pointercancel', () => { this._tapDown = null; });
  }

  init() {
    this.map = new TileMap(buildMap());
    this._buildMinimap();
    this._newGameState();
    this.title.onPick = (action, slot) => this._onTitlePick(action, slot);
    document.getElementById('btn-retry')?.addEventListener('click', () => this._toTitle());
    document.getElementById('btn-ending')?.addEventListener('click', () => this._toTitle());
    // desbloqueia o áudio no primeiro gesto (teclado ou mouse)
    const unlock = () => this.audio.unlock();
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('pointerdown', unlock, { once: true });
    this.title.show();
    requestAnimationFrame((t) => this._loop(t));
  }

  _newGameState() {
    this.player = new Player(SPAWN.x, SPAWN.y);
    this.party = newParty();
    this.inv = newInventory();
    this.gold = 120;
    this.flags = { bossDefeated: false, metElder: false };
    this._lastRegion = null;
    this.npcs = NPC_DEFS.map((d) => new NPC(d));
    this.camera.snap(this.player.cx, this.player.cy);
  }

  /** Pré-renderiza o minimapa (2px por tile). */
  _buildMinimap() {
    const c = document.createElement('canvas');
    c.width = this.map.w * 2; c.height = this.map.h * 2;
    const g = c.getContext('2d');
    for (let y = 0; y < this.map.h; y++) for (let x = 0; x < this.map.w; x++) {
      g.fillStyle = tileColor(this.map.tile(x, y));
      g.fillRect(x * 2, y * 2, 2, 2);
    }
    this.mmBase = c;
  }

  /** Banner de região ao entrar num local novo. @param {string} region */
  _showBanner(region) {
    const el = document.getElementById('region-banner');
    if (!el) return;
    const names = { town: 'Vila Lumen', field: 'Planície Verdejante', forest: 'Bosque Sombrio', dungeon: 'Ruínas do Cristal', altar: 'Altar do Caos', beach: 'Praia do Sol', snow: 'Pico Nevado', desert: 'Deserto Dourado', swamp: 'Pântano Sombrio' };
    const subs = { town: 'povoado pacato', field: 'cuidado com a grama alta', forest: 'feras entre as árvores', dungeon: 'o cristal o aguarda', altar: 'NÃO HÁ VOLTA', beach: 'águas calmas — bom p/ pescar', snow: 'o frio morde — feras fortes', desert: 'o oásis esconde um baú', swamp: 'não beba a água' };
    el.innerHTML = `${names[region] || region}<small>${subs[region] || ''}</small>`;
    el.classList.remove('hidden');
    void el.offsetWidth;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    clearTimeout(this._bannerT);
    this._bannerT = setTimeout(() => el.classList.add('hidden'), 2450);
  }

  // ---------- título ----------
  async _onTitlePick(action, slot) {
    this.audio.unlock();
    if (action === 'new') {
      this._newGameState();
      await this._beginField(true);
    } else if (action === 'load') {
      const data = SaveSystem.load(slot);
      if (!data) { toast('Slot vazio!'); return; }
      this._applySave(data);
      await this._beginField(false);
    }
  }

  _applySave(d) {
    this.player = new Player(0, 0);
    this.player.x = d.x; this.player.y = d.y; this.player.dir = d.dir || 'down';
    this.party = restoreParty(d.party);
    this.inv = d.inv;
    this.gold = d.gold;
    this.flags = d.flags;
    this.playSec = d.playSec || 0;
    this.npcs = NPC_DEFS.map((def) => new NPC(def));
    for (const n of this.npcs) {
      if (n.gift && (d.flags[`gift_${n.id}`] || (n.id === 'hermit' && d.flags.giftTaken))) n.giftGiven = true;
    }
    this.camera.snap(this.player.cx, this.player.cy);
  }

  _snapshot() {
    return {
      x: this.player.x, y: this.player.y, dir: this.player.dir,
      party: serializeParty(this.party), inv: { ...this.inv },
      gold: this.gold, flags: { ...this.flags, giftTaken: this.npcs.find((n) => n.id === 'hermit')?.giftGiven, ...Object.fromEntries(this.npcs.filter((n) => n.gift).map((n) => [`gift_${n.id}`, !!n.giftGiven])) },
      playSec: Math.floor(this._elapsed()),
    };
  }

  /** Segundos de jogo acumulados. */
  _elapsed() {
    return this.playSec + (this._playT0 ? (Date.now() - this._playT0) / 1000 : 0);
  }

  /** Formata segundos como H:MM:SS ou MM:SS. */
  _fmtTime() {
    const s = Math.floor(this._elapsed());
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    const p = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${p(m)}:${p(ss)}` : `${p(m)}:${p(ss)}`;
  }

  async _beginField(fresh) {
    this.title.hide();
    document.getElementById('gameover')?.classList.add('hidden');
    document.getElementById('ending')?.classList.add('hidden');
    this.hud.show();
    this.state = 'FIELD';
    if (!this._playT0) this._playT0 = Date.now();
    await Transition.fadeOut(200);
    await Transition.fadeIn(300);
    if (fresh) {
      this.dialog.say([
        { name: '???', text: 'Ugh... onde...? A vila... o cristal...' },
        { name: 'Kael', text: 'Lyra! Milo! Acordem! Desmaiamos na estrada de novo...' },
        { name: 'Lyra', text: 'O Cristal de Lumen nos chamou em sonho. A vila fica logo ali — vamos falar com o Ancião Theo!' },
      ]);
    } else toast('Jogo carregado!');
  }

  _toTitle() {
    this.battle.stop();
    this.dialog.close();
    this.menu.close();
    document.getElementById('gameover')?.classList.add('hidden');
    document.getElementById('ending')?.classList.add('hidden');
    this.hud.hide();
    this.audio.stopMusic();
    this.state = 'TITLE';
    this.title.show();
  }

  // ---------- loop ----------
  _loop(t) {
    const dt = Math.min(0.05, (t - (this._last ?? t)) / 1000 || 0.016);
    this._last = t;
    this.time += dt;
    this.update(dt);
    this.render();
    this.input.postUpdate();
    requestAnimationFrame((t2) => this._loop(t2));
  }

  update(dt) {
    const inp = this.input;
    // mudo global (tecla M) — funciona em qualquer tela
    if (inp.pressed.mute) {
      this.audio.unlock();
      toast(this.audio.toggleMute() ? 'Som desligado (M)' : 'Som ligado (M)');
    }
    if (this.state === 'TITLE') { this.title.handle(inp); return; }
    if (this.state === 'BATTLE') {
      this.battle.handle(inp);
      this.battle.update(dt);
      this.battle.draw();
      return;
    }
    if (this.state !== 'FIELD') return;
    if (this._busy) return; // transição em andamento: congela o campo

    this.dialog.update(dt);
    // diálogos e menus consomem o input primeiro
    if (this.dialog.active) { this.dialog.handle(inp); this.camera.update(dt); return; }
    if (this.menu.active) {
      this.menu.handle(inp, this._menuActions());
      return;
    }

    // pescaria ativa: E fisga / confirma, Q/Esc cancela (prioridade sobre menu)
    if (this._fishing) {
      if (inp.pressed.menu || inp.pressed.cancel) { this._cancelFish(); return; }
      if (inp.pressed.confirm) { this._fishPress(); return; }
      // movimento cancelado: tick da pescaria roda mais abaixo junto do mundo parado
    } else if (inp.pressed.menu || inp.pressed.cancel) {
      this.audio.unlock(); this.audio.sfx('confirm');
      this._path = null; this._tapAct = null;
      this.menu.show({ party: this.party, inv: this.inv, gold: this.gold, time: this._fmtTime(), flags: this.flags }, (m) => toast(m), this._menuActions());
      return;
    }

    // falar / altar do boss / cristal / brinquedo / baú / pesca
    if (!this._fishing && inp.pressed.confirm) {
      this._path = null; this._tapAct = null;
      if (this._tryBossInteract()) return;
      if (this._tryHealCrystal()) return;
      if (this._tryToyPickup()) return;
      if (this._tryChest()) return;
      const npc = this._facingNpc();
      if (npc) { this._talk(npc); return; }
      if (this._tryFish()) return;
    }

    // movimento (Shift = correr)
    // NPCs NÃO bloqueiam: dá para atravessar sem travar (falar continua pelo E)
    const blockers = [];
    // dragão bloqueia o altar até ser derrotado
    if (!this.flags.bossDefeated) blockers.push({ x: BOSS_ALTAR.x * TILE, y: BOSS_ALTAR.y * TILE });
    // baús são sólidos (abertos ou não)
    for (const c of CHESTS) blockers.push({ x: c.x * TILE, y: c.y * TILE });
    if (this._fishCd > 0) this._fishCd -= dt;
    // pescaria congela o movimento: só o tick da vara/bóia avança
    if (this._fishing) {
      for (const n of this.npcs) n.update(dt, this.map);
      this.camera.follow(this.player.cx, this.player.cy, dt);
      this.camera.update(dt);
      this._wxTick(dt, regionAt(this.player.tileX, this.player.tileY));
      this._tickFish(dt);
      return;
    }
    // toque-para-andar: input manual cancela a rota; sem input, a rota guia
    let ax = inp.axis;
    if (ax.x !== 0 || ax.y !== 0) { this._path = null; this._tapAct = null; }
    else if (this._path && this._path.length) {
      ax = this._pathAxis();
      this._pathStuck = (this._pathStuck || 0) + dt;
      if (this._pathStuck > 1.5) { this._path = null; this._tapAct = null; } // segurança anti-trava
    }
    this.player.update(ax, dt, this.map, blockers, inp.held.run || (this._pathRun && !!this._path && !!this._path.length));
    // sons de passo / trombada
    if (this.player.moving) {
      this._stepT = (this._stepT || 0) + dt * (this.player.running ? 1.5 : 1);
      if (this._stepT > 0.27) { this._stepT = 0; this.audio.sfx('step'); }
      // poeira nos pés ao correr
      if (this.player.running) {
        this._poofT = (this._poofT || 0) + dt;
        if (this._poofT > 0.16 && this._wx.length < 90) {
          this._poofT = 0;
          this._wx.push({
            type: 'poof',
            x: this.player.cx + this.camera.ox + (Math.random() - 0.5) * 10,
            y: this.player.cy + this.camera.oy + 12,
            vx: (Math.random() - 0.5) * 24, vy: -28 - Math.random() * 20,
            t: 0, life: 0.55, seed: Math.random() * 9,
          });
        }
      } else { this._poofT = 0; }
    } else if (ax.x !== 0 || ax.y !== 0) {
      this._bumpT = (this._bumpT || 0) + dt;
      if (this._bumpT > 0.35) { this._bumpT = 0; this.audio.sfx('bump'); }
    } else { this._stepT = 0; this._bumpT = 0; }
    for (const n of this.npcs) n.update(dt, this.map);
    this.camera.follow(this.player.cx, this.player.cy, dt);
    this.camera.update(dt);
    // clima/ambiente do bioma atual (só visual, sem gameplay)
    this._wxTick(dt, regionAt(this.player.tileX, this.player.tileY));

    // encontros aleatórios na grama
    const steps = this.player.consumeSteps();
    if (steps > 0) {
      const tile = this.map.tile(this.player.tileX, this.player.tileY);
      const region = regionAt(this.player.tileX, this.player.tileY);
      if (isEncounterTile(tile) && region !== 'town' && Math.random() < ENCOUNTER_RATE * steps * 2.2) {
        this._startWildBattle(region);
        return;
      }
    }

    // música por região + banner de local novo + HUD (só re-renderiza quando algo mudou)
    const region = regionAt(this.player.tileX, this.player.tileY);
    if (!this._lastRegion) this._lastRegion = region;
    else if (this._lastRegion !== region) { this._lastRegion = region; this._showBanner(region); }
    const want = region === 'town' || region === 'beach' ? 'town' : region === 'dungeon' || region === 'altar' || region === 'swamp' ? 'dungeon' : 'field';
    if (this.audio.ctx && this.audio.currentTrack !== want) this.audio.playMusic(want);
    this.hud.renderMinimap(this.mmBase, this.camera.ox, this.camera.oy, this.player.tileX, this.player.tileY, this.flags.bossDefeated ? null : BOSS_ALTAR);
    const sig = `${region}|${this.gold}|${this.audio.muted}|${this.party.map((h) => `${Math.ceil(h.hp)}/${Math.ceil(h.mp)}/${h.level}`).join(',')}`;
    if (sig !== this._hudSig) { this._hudSig = sig; this.hud.render(this.party, this.gold, region, this.faces, this.audio.muted); }
  }

  /** Ações do menu de pausa (reusadas por teclado e mouse). */
  _menuActions() {
    return {
      useItem: (id, idx) => {
        const r = useItem(this.inv, id, this.party[idx]);
        toast(r.msg);
        this.audio.sfx(r.ok ? 'item' : 'flee-fail');
        this.menu._render();
      },
      useSpell: (hi, spell, ti) => {
        const h = this.party[hi], a = this.party[ti];
        const cost = SPELLS[spell].mp;
        if (h.mp < cost) { toast(`${h.name} não tem MP!`); this.audio.sfx('flee-fail'); return; }
        if (a.hp <= 0) { toast(`${a.name} está caído!`); this.audio.sfx('flee-fail'); return; }
        if (a.hp >= a.maxHp) { toast(`${a.name} já está com HP cheio!`); this.audio.sfx('flee-fail'); return; }
        h.mp -= cost;
        const v = Math.min(Math.round(h.mag * SPELLS[spell].power * 3), a.maxHp - Math.max(0, a.hp));
        a.hp = Math.min(a.maxHp, Math.max(0, a.hp) + v);
        this.audio.sfx('heal');
        toast(`${h.name} curou ${a.name} (+${v} HP)!`);
        this.menu._render();
      },
      getConfig: () => {
        const s = loadSettings();
        return { sound: s.mute ? 'Desligado' : 'Ligado', speed: s.speed };
      },
      cycleConfig: (id) => {
        const s = loadSettings();
        if (id === 'sound') {
          const m = this.audio.toggleMute();
          toast(m ? 'Som desligado (M)' : 'Som ligado (M)');
        } else {
          const i = (SPEED_ORDER.indexOf(s.speed) + 1) % SPEED_ORDER.length;
          s.speed = SPEED_ORDER[i] || 'normal';
          saveSettings(s);
          this.dialog.speed = s.speed;
          this.audio.sfx('confirm');
          toast(`Velocidade do texto: ${s.speed}`);
        }
        this.menu._render();
      },
      save: (slot) => {
        SaveSystem.save(slot, this._snapshot());
        toast(`Jogo salvo no Slot ${slot}!`);
        this.audio.sfx('confirm');
      },
    };
  }
  // ---------- toque-para-andar ----------
  /** Toque/clique no mundo: anda até o local (BFS) e interage ao chegar. */
  _handleTap(clientX, clientY) {
    if (this.state !== 'FIELD' || this._busy) return;
    if (this.dialog.active || this.menu.active) return;
    const r = this.cv.getBoundingClientRect();
    if (!r || r.width <= 0 || r.height <= 0) return;
    const sx = ((clientX - r.left) / r.width) * VIEW_W;
    const sy = ((clientY - r.top) / r.height) * VIEW_H;
    this._tapWorld(sx - this.camera.ox, sy - this.camera.oy);
  }

  /** Rota BFS até o ponto (ou o pisável alcançável mais próximo). */
  _tapWorld(wx, wy) {
    const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
    const sx = this.player.tileX, sy = this.player.tileY;
    const blocked = (x, y) => {
      if (x < 1 || y < 1 || x >= this.map.w - 1 || y >= this.map.h - 1) return true;
      if (this.map.solid(x, y)) return true;
      if (!this.flags.bossDefeated && x === BOSS_ALTAR.x && y === BOSS_ALTAR.y) return true;
      if (CHESTS.some((c) => c.x === x && c.y === y)) return true;
      return false;
    };
    const key = (x, y) => y * this.map.w + x;
    const prev = new Map();
    const seen = new Set([key(sx, sy)]);
    const q = [[sx, sy]];
    while (q.length) {
      const [cx, cy] = q.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy, k = key(nx, ny);
        if (seen.has(k) || blocked(nx, ny)) continue;
        seen.add(k); prev.set(k, [cx, cy]); q.push([nx, ny]);
      }
    }
    let goal = null;
    if (!blocked(tx, ty) && seen.has(key(tx, ty))) goal = [tx, ty];
    else {
      let bd = 1e9;
      for (const k of seen) {
        const x = k % this.map.w, y = (k / this.map.w) | 0;
        const d = Math.abs(x - tx) + Math.abs(y - ty);
        if (d < bd) { bd = d; goal = [x, y]; }
      }
    }
    const tiles = [];
    let cur = goal;
    while (cur && !(cur[0] === sx && cur[1] === sy)) {
      tiles.push(cur);
      cur = prev.get(key(cur[0], cur[1]));
    }
    tiles.reverse();
    this._path = tiles.map(([x, y]) => ({ x: x * TILE + 16, y: y * TILE + 16 }));
    this._pathRun = tiles.length > 10;
    this._pathStuck = 0;
    this._tapAct = this._tapIntent(tx, ty);
    this._tapMark = { x: wx, y: wy, t: this.time };
    this.audio.sfx('cursor');
    if (!this._path.length) this._arriveTap();
  }

  /** O que há no tile tocado (p/ interagir ao chegar). */
  _tapIntent(tx, ty) {
    const npc = this.npcs.find((n) =>
      Math.floor((n.x + 12) / TILE) === tx && Math.floor((n.y + 12) / TILE) === ty);
    if (npc) return { kind: 'npc', npc };
    if (CHESTS.some((c) => c.x === tx && c.y === ty)) return { kind: 'chest' };
    if (tx === BOSS_ALTAR.x && ty === BOSS_ALTAR.y) return { kind: 'spot', which: 'boss' };
    if (tx === HEAL_CRYSTAL.x && ty === HEAL_CRYSTAL.y) return { kind: 'spot', which: 'crystal' };
    if (tx === TOY_SPOT.x && ty === TOY_SPOT.y) return { kind: 'spot', which: 'toy' };
    if (this.map.tile(tx, ty) === T.WATER) return { kind: 'fish', tx, ty };
    return null;
  }

  /** Vira o jogador para um ponto do mundo. */
  _faceToward(wx, wy) {
    const dx = wx - this.player.cx, dy = wy - this.player.cy;
    this.player.dir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  }

  /** Chegou ao destino do toque: executa a interação (se ainda ao alcance). */
  _arriveTap() {
    const act = this._tapAct;
    this._tapAct = null;
    if (!act || this.state !== 'FIELD' || this.dialog.active || this.menu.active) return;
    if (act.kind === 'npc') {
      const nx = act.npc.x + 12, ny = act.npc.y + 12;
      if (Math.hypot(nx - this.player.cx, ny - this.player.cy) > TILE * 1.8) return;
      this._faceToward(nx, ny);
      this._talk(act.npc);
    } else if (act.kind === 'chest') {
      this._tryChest();
    } else if (act.kind === 'fish') {
      this._faceToward(act.tx * TILE + 16, act.ty * TILE + 16);
      this._tryFish(act.tx, act.ty);
    } else if (act.kind === 'spot') {
      if (act.which === 'boss') this._tryBossInteract();
      else if (act.which === 'crystal') this._tryHealCrystal();
      else this._tryToyPickup();
    }
  }

  /** Próximo passo da rota (4 direções, estilo JRPG). */
  _pathAxis() {
    if (!this._path || !this._path.length) return { x: 0, y: 0 };
    const w = this._path[0];
    const dx = w.x - this.player.cx, dy = w.y - this.player.cy;
    if (Math.hypot(dx, dy) < 5) {
      this._path.shift();
      this._pathStuck = 0;
      if (!this._path.length) { this._arriveTap(); return { x: 0, y: 0 }; }
      return this._pathAxis();
    }
    return Math.abs(dx) >= Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) };
  }

  // ---------- interação ----------
  _facingNpc() {
    const ft = this.player.facingTile();
    return this.npcs.find((n) =>
      Math.floor((n.x + 12) / TILE) === ft.x && Math.floor((n.y + 12) / TILE) === ft.y) ||
      this.npcs.find((n) => Math.hypot(n.x - this.player.x, n.y - this.player.y) < TILE * 1.1);
  }

  _talk(npc) {
    npc.dir = { up: 'down', down: 'up', left: 'right', right: 'left' }[this.player.dir];
    this.audio.sfx('talk');
    if (npc.shop) return this._openShop(npc);
    if (npc.inn) return this._openInn(npc);
    if (npc.id === 'kid') return this._talkPip(npc);
    if (npc.id === 'guard') return this._talkGuard(npc);
    const lines = [{ name: npc.name, text: npc.nextLine() }];
    if (npc.gift && !npc.giftGiven) {
      npc.giftGiven = true;
      this.inv[npc.gift] = (this.inv[npc.gift] || 0) + 1;
      lines.push({ name: npc.name, text: `Tome este ${ITEMS[npc.gift].name}. Você vai precisar.` });
      this.audio.sfx('item');
    }
    if (npc.id === 'elder' && !this.flags.metElder) {
      this.flags.metElder = true;
      this.inv.potion += 2;
      lines.push({ name: 'Ancião Theo', text: 'Leve 2 POÇÕES da vila. E lembre-se: a estalagem do Bram cura suas feridas por 20G.' });
    }
    this.dialog.say(lines);
  }

  /** Quest secundária: o boneco perdido do Pip. */
  _talkPip(npc) {
    const f = this.flags;
    if (f.toyRewarded) {
      this.dialog.say([
        { name: npc.name, text: 'Meu Boneco Velho está de volta! Quando eu crescer vou ser Mago igual a Lyra!' },
      ]);
      return;
    }
    if (f.toyFound) {
      f.toyRewarded = true;
      this.gold += 150;
      this.inv.hipotion = (this.inv.hipotion || 0) + 1;
      this.audio.sfx('levelup');
      this.dialog.say([
        { name: npc.name, text: 'É ELE! Meu Boneco Velho! Você é o melhor!' },
        { name: 'Pip', text: 'Tome! Juntei 150G e uma HI-POÇÃO para você. Boa sorte contra o dragão!' },
      ]);
      toast('+150G · +1 Hi-Poção!');
      return;
    }
    if (!f.toyQuest) {
      f.toyQuest = true;
      this.dialog.say([
        { name: npc.name, text: 'Buáá... perdi meu Boneco Velho na grama alta!' },
        { name: 'Pip', text: 'Ele BRILHA de noite... deve estar na planície, a leste da vila. Se achar, me devolve?' },
      ]);
      return;
    }
    this.dialog.say([
      { name: npc.name, text: 'Procure algo BRILHANDO na grama alta, a leste da vila. Por favor!' },
    ]);
  }

  /** Quest de caça: Guarda Cato paga por slimes derrotados. */
  _talkGuard(npc) {
    const f = this.flags;
    const count = f.huntCount || 0;
    if (f.huntRewarded) {
      this.dialog.say([
        { name: npc.name, text: 'A ponte segue segura graças a você. As Ruínas ao nordeste ainda precisam de um herói...' },
      ]);
      return;
    }
    if (!f.huntQuest) {
      f.huntQuest = true;
      this.audio.sfx('confirm');
      this.dialog.say([
        { name: npc.name, text: `Alto lá! Os SLIMES estão se multiplicando na planície e no bosque.` },
        { name: 'Guarda Cato', text: `Derrote ${HUNT_GOAL} slimes e volte aqui: pago 200G e um ÉTER. Caça boa!` },
      ]);
      toast(`Nova quest: cace ${HUNT_GOAL} slimes!`);
      return;
    }
    if (count >= HUNT_GOAL) {
      f.huntRewarded = true;
      this.gold += 200;
      this.inv.ether = (this.inv.ether || 0) + 1;
      this.audio.sfx('levelup');
      this.dialog.say([
        { name: npc.name, text: 'Contei os restos de gosma... trabalho limpo!' },
        { name: 'Guarda Cato', text: 'Aqui estão 200G e um ÉTER. A ponte é sua, herói!' },
      ]);
      toast('+200G · +1 Éter!');
      return;
    }
    this.dialog.say([
      { name: npc.name, text: `Faltam ${HUNT_GOAL - count} slimes. Procure na grama alta da planície! (${count}/${HUNT_GOAL})` },
    ]);
  }

  /** Baú ao alcance do jogador (para o E e para a dica visual). */
  _nearChest() {
    return CHESTS.find((k) =>
      Math.hypot(this.player.cx - (k.x * TILE + 16), this.player.cy - (k.y * TILE + 16)) < TILE * 1.6) || null;
  }

  /** Baú do tesouro: E por perto abre uma única vez. */
  _tryChest() {
    const c = this._nearChest();
    if (!c) return false;
    if (this.flags[`chest_${c.id}`]) {
      this.audio.sfx('bump');
      toast('Baú vazio.');
      return true;
    }
    this.flags[`chest_${c.id}`] = true;
    const parts = [];
    if (c.loot.gold) { this.gold += c.loot.gold; parts.push(`+${c.loot.gold}G`); }
    for (const [id, q] of Object.entries(c.loot.items || {})) {
      this.inv[id] = (this.inv[id] || 0) + q;
      parts.push(`+${q} ${ITEMS[id].name}`);
    }
    this.audio.sfx(c.loot.items && c.loot.items.hipotion ? 'levelup' : 'item');
    this.dialog.say([
      { name: '', text: `(Você abre um baú esquecido...)` },
      { name: 'Baú', text: `${parts.join(' · ')}!` },
    ]);
    toast(parts.join(' · ') + '!');
    return true;
  }

  // ---------- pescaria com vara + mini-game ----------
  /** Inicia a pescaria: E encarando a água (ou tocando a água). Retorna true se lançou a linha. */
  _tryFish(forceTX, forceTY) {
    if (this._fishing || this._fishCd > 0) return false;
    let tx, ty;
    if (forceTX !== undefined && forceTY !== undefined) {
      tx = forceTX; ty = forceTY;
      if (this.map.tile(tx, ty) !== T.WATER) return false;
      this._faceToward(tx * TILE + 16, ty * TILE + 16);
    } else {
      const ft = this.player.facingTile();
      tx = ft.x; ty = ft.y;
      if (this.map.tile(tx, ty) !== T.WATER) return false;
    }
    this._path = null; this._tapAct = null;
    this._fishing = {
      phase: 'cast', t: 0,
      tx, ty,
      bobWX: tx * TILE + 16, bobWY: ty * TILE + 16,
      fromX: this.player.cx, fromY: this.player.cy,
      biteAt: 1.7 + Math.random() * 2.6,
      biteLeft: 0, nibbleT: 0.4 + Math.random() * 1.2,
      cursor: 0, cdir: 1, zoneX: 0.25 + Math.random() * 0.5, zoneW: 0.22, perfectW: 0.07,
      reelT: 0, splashT: 0,
    };
    this.audio.sfx('reel');
    return true;
  }

  /** E durante a pescaria: fisga na hora do "!" ou trava o cursor no mini-game. */
  _fishPress() {
    const f = this._fishing;
    if (!f) return;
    if (f.phase === 'bite') {
      // fisgou! abre o mini-game da fisgada
      f.phase = 'reel'; f.t = 0; f.reelT = 0;
      f.cursor = Math.random();
      f.cdir = Math.random() < 0.5 ? -1 : 1;
      // zona alvo: praia = zona um pouco maior (pesca mais fácil)
      const beach = regionAt(this.player.tileX, this.player.tileY) === 'beach';
      f.zoneW = beach ? 0.24 : 0.19;
      f.perfectW = 0.07;
      f.zoneX = 0.08 + Math.random() * (0.84 - f.zoneW);
      this.audio.sfx('bite');
      this._fishSplash(f.bobWX, f.bobWY, 6);
    } else if (f.phase === 'reel') {
      this._fishStrike();
    } else if (f.phase === 'caught' || f.phase === 'miss') {
      this._endFish();
    }
    // cast/wait: E não faz nada (espera o peixe morder)
  }

  /** Cancela a pescaria (Q/Esc). */
  _cancelFish() {
    if (!this._fishing) return;
    this._fishing = null;
    this._fishCd = 0.5;
    this.audio.sfx('cancel');
    toast('🎣 Linha recolhida...');
  }

  /** Tick da pescaria (mundo parado, só vara/bóia/peixe vivem). */
  _tickFish(dt) {
    const f = this._fishing;
    if (!f) return;
    f.t += dt;
    if (f.phase === 'cast') {
      if (f.t >= 0.45) {
        f.phase = 'wait'; f.t = 0;
        this.audio.sfx('splash');
        this._fishSplash(f.bobWX, f.bobWY, 5);
      }
    } else if (f.phase === 'wait') {
      // mordidinhas falsas (só visual + plop baixo) antes da mordida real
      f.nibbleT -= dt;
      if (f.nibbleT <= 0 && f.t < f.biteAt - 0.6) {
        f.nibbleT = 0.7 + Math.random() * 1.4;
        this.audio.sfx('plop');
        this._fishRipple(f.bobWX, f.bobWY, 1);
      }
      if (f.t >= f.biteAt) {
        f.phase = 'bite'; f.t = 0; f.biteLeft = 0.95;
        this.audio.sfx('bite');
        this._fishSplash(f.bobWX, f.bobWY, 8);
      }
    } else if (f.phase === 'bite') {
      f.biteLeft -= dt;
      if (f.biteLeft <= 0) this._fishMiss('O peixe escapou... (fisgue no “!” com E)');
    } else if (f.phase === 'reel') {
      f.reelT += dt;
      // cursor ping-pong cada vez mais rápido
      const speed = 1.15 + Math.min(1.1, f.reelT * 0.18);
      f.cursor += f.cdir * speed * dt;
      if (f.cursor >= 1) { f.cursor = 1; f.cdir = -1; }
      if (f.cursor <= 0) { f.cursor = 0; f.cdir = 1; }
      if (f.reelT > 8) this._fishMiss('A linha arrebentou por demora...');
    } else if (f.phase === 'caught' || f.phase === 'miss') {
      if (f.t > (f.phase === 'caught' ? 1.5 : 1.1)) this._endFish();
    }
  }

  /** Resolve a tentativa do mini-game (cursor dentro da zona = pega). */
  _fishStrike() {
    const f = this._fishing;
    if (!f || f.phase !== 'reel') return;
    const c = f.cursor;
    const z0 = f.zoneX, z1 = f.zoneX + f.zoneW;
    const p0 = f.zoneX + f.zoneW / 2 - f.perfectW / 2, p1 = p0 + f.perfectW;
    if (c >= z0 && c <= z1) {
      const perfect = c >= p0 && c <= p1;
      this._fishReward(perfect);
    } else {
      this._fishMiss('Errou a zona verde... o peixe fugiu!');
    }
  }

  /** Recompensa da pescaria (praia = mais pérola). */
  _fishReward(perfect) {
    const f = this._fishing;
    const beach = regionAt(this.player.tileX, this.player.tileY) === 'beach';
    const r = Math.random();
    f.phase = 'caught'; f.t = 0;
    this._fishSplash(f.bobWX, f.bobWY, 10);
    if (perfect && r < 0.45) {
      this.inv.fish = (this.inv.fish || 0) + 2;
      this.audio.sfx('catch');
      toast('🐟🐟 FISGADA PERFEITA! +2 Peixes Frescos!');
    } else if (r < 0.52) {
      this.inv.fish = (this.inv.fish || 0) + 1;
      this.audio.sfx('catch');
      toast('🐟 Peixe Fresco pescado! (+1)');
    } else if (r < 0.66) {
      this.gold += 4;
      this.audio.sfx('plop');
      toast('🥾 Uma Bota Velha... (+4G de sucata)');
    } else if (r < (beach ? 0.78 : 0.86)) {
      this.audio.sfx('plop');
      toast('...só algas. Pelo menos a técnica foi boa!');
    } else {
      const v = (beach ? 60 : 40) + (perfect ? 20 : 0);
      this.gold += v;
      this.audio.sfx('levelup');
      this.dialog.say([{ name: '', text: `(Algo brilha na ponta da linha... uma PÉROLA!)` }]);
      toast(`🪙 Pérola vendida! (+${v}G)`);
    }
  }

  _fishMiss(msg) {
    const f = this._fishing;
    if (!f) return;
    f.phase = 'miss'; f.t = 0; f.missMsg = msg;
    this.audio.sfx('cancel');
    toast(`🎣 ${msg}`);
  }

  _endFish() {
    this._fishing = null;
    this._fishCd = 1.2;
  }

  /** Atalho de teste: conclui a pescaria atual com sucesso imediato. @returns {boolean} */
  _debugCatchFish() {
    if (!this._fishing) return false;
    this._fishReward(false);
    this._endFish();
    return true;
  }

  _fishSplash(wx, wy, n) {
    for (let i = 0; i < n && this._wx.length < 120; i++) {
      const a = Math.random() * Math.PI * 2, sp = 30 + Math.random() * 90;
      this._wx.push({
        type: 'splash',
        x: wx + this.camera.ox + (Math.random() - 0.5) * 8,
        y: wy + this.camera.oy + (Math.random() - 0.5) * 6,
        vx: Math.cos(a) * sp, vy: -40 - Math.random() * 90,
        t: 0, life: 0.5 + Math.random() * 0.3, seed: Math.random() * 9,
      });
    }
    this._fishRipple(wx, wy, 2);
  }

  _fishRipple(wx, wy, n) {
    for (let i = 0; i < n && this._wx.length < 120; i++) {
      this._wx.push({
        type: 'ripple',
        x: wx + this.camera.ox, y: wy + this.camera.oy,
        vx: 0, vy: 0, t: -i * 0.18, life: 1.1, seed: Math.random() * 9,
      });
    }
  }

  /** Cristal restaurador: E por perto = cura total. */
  _tryHealCrystal() {
    const d = Math.hypot(this.player.cx - (HEAL_CRYSTAL.x * TILE + 16), this.player.cy - (HEAL_CRYSTAL.y * TILE + 16));
    if (d > TILE * 1.7) return false;
    fullHeal(this.party);
    this.audio.sfx('heal');
    this.dialog.say([
      { name: 'Cristal Restaurador', text: 'O cristal pulsa em azul... HP e MP totalmente restaurados!' },
    ]);
    return true;
  }

  /** Pega o boneco do Pip (só com a quest ativa). */
  _tryToyPickup() {
    if (!this.flags.toyQuest || this.flags.toyFound) return false;
    const d = Math.hypot(this.player.cx - (TOY_SPOT.x * TILE + 16), this.player.cy - (TOY_SPOT.y * TILE + 16));
    if (d > TILE * 1.4) return false;
    this.flags.toyFound = true;
    this.audio.sfx('item');
    toast('Boneco Velho encontrado! Leve ao Pip.');
    this.dialog.say([
      { name: '', text: '(Você encontrou um boneco de pano gasto, brilhando entre a grama.)' },
    ]);
    return true;
  }

  _openShop(npc) {
    const opts = SHOP_STOCK.map((id) => ({
      label: `${ITEMS[id].name}<span class="shop-price">${ITEMS[id].price}G</span><span class="shop-own">possui ${this.inv[id] || 0}</span>`,
      value: id,
    })).concat([{ label: 'Sair', value: null }]);
    this.dialog.say(
      [{ name: npc.name, text: `Ouro: ${this.gold}G. O que vai querer?`, options: opts }],
      null,
      (val) => {
        if (!val) return;
        const it = ITEMS[val];
        if (this.gold < it.price) {
          this.audio.sfx('flee-fail');
          this.dialog.say([{ name: npc.name, text: 'Ouro insuficiente, querido!' }]);
          return;
        }
        this.gold -= it.price;
        this.inv[val] = (this.inv[val] || 0) + 1;
        this.audio.sfx('item');
        toast(`${it.name} comprado! (-${it.price}G)`);
        this._openShop(npc); // mantém a loja aberta
      }
    );
  }

  _openInn(npc) {
    this.dialog.say(
      [{ name: npc.name, text: `Descansar até amanhã? Cura total por 20G. (Ouro: ${this.gold}G)`, options: [{ label: 'Descansar — 20G', value: 'yes' }, { label: 'Agora não', value: null }] }],
      null,
      (val) => {
        if (val !== 'yes') return;
        if (this.gold < 20) {
          this.audio.sfx('flee-fail');
          this.dialog.say([{ name: npc.name, text: 'Volte quando tiver 20G, herói!' }]);
          return;
        }
        this.gold -= 20;
        fullHeal(this.party);
        this.audio.sfx('heal');
        this.dialog.say([{ name: npc.name, text: 'Dormiram como pedras! HP e MP restaurados. Boa jornada!' }]);
      }
    );
  }

  _tryBossInteract() {
    if (this.flags.bossDefeated) return false;
    const d = Math.hypot(this.player.cx - (BOSS_ALTAR.x * TILE + 16), this.player.cy - (BOSS_ALTAR.y * TILE + 16));
    if (d > TILE * 2.2) return false;
    this.audio.sfx('encounter');
    this.dialog.say(
      [{ name: 'DRAGÃO DO CAOS', text: 'QUEM OUSA PISAR NO MEU ALTAR? O CRISTAL SERÁ MEU COMBUSTÍVEL! Venha, pequenos heróis... QUEIMEM!', options: [{ label: '⚔ LUTAR!', value: 'fight' }, { label: 'Recuar', value: null }] }],
      null,
      (v) => { if (v === 'fight') this._startBossBattle(); }
    );
    return true;
  }

  // ---------- batalhas ----------
  async _startWildBattle(region) {
    if (this._busy) return;
    this._path = null; this._tapAct = null; this._tapMark = null;
    this._busy = true;
    try {
      this.audio.sfx('encounter');
      this.audio.playMusic('battle');
      await Transition.swirl(650);
      this.state = 'BATTLE';
      this.hud.hide();
      const avg = this.party.reduce((s, h) => s + h.level, 0) / this.party.length;
      const enemies = makeEncounter(region, avg);
    this.battle.start(this.party, this.inv, enemies, {
      region,
      onEnd: (r) => this._afterBattle(r, region),
    });
    } finally {
      this._busy = false;
    }
  }

  async _startBossBattle() {
    if (this._busy) return;
    this._path = null; this._tapAct = null; this._tapMark = null;
    this._busy = true;
    try {
      this.audio.playMusic('boss');
      await Transition.swirl(800);
      this.state = 'BATTLE';
      this.hud.hide();
    this.battle.start(this.party, this.inv, [makeBoss()], {
      boss: true,
      region: 'boss',
      onEnd: (r) => this._afterBattle(r, 'altar'),
    });
    } finally {
      this._busy = false;
    }
  }

  async _afterBattle(result, region) {
    if (result.fled) {
      this.state = 'FIELD';
      this.hud.show();
      this.hud.render(this.party, this.gold, region, this.faces, this.audio.muted);
      return;
    }
    if (result.victory) {
      this.gold += result.gold;
      toast(`+${result.xp} XP · +${result.gold} G`);
      // quest de caça: conta slimes da família derrotados
      if (this.flags.huntQuest && !this.flags.huntRewarded && result.kills) {
        const n = result.kills.filter((id) => id === 'slime' || id === 'king').length;
        if (n > 0) {
          this.flags.huntCount = (this.flags.huntCount || 0) + n;
          const c = this.flags.huntCount;
          if (c >= HUNT_GOAL) {
            this.audio.sfx('levelup');
            toast(`Caça completa! (${c}/${HUNT_GOAL}) Volte ao Guarda Cato!`);
          } else {
            toast(`Caça: ${c}/${HUNT_GOAL} slimes`);
          }
        }
      }
      if (result.boss) {
        this.flags.bossDefeated = true;
        this.state = 'FIELD';
        this.hud.show();
        await Transition.fadeOut(300);
        this._showEnding();
        return;
      }
      this.state = 'FIELD';
      this.hud.show();
      this.hud.render(this.party, this.gold, region, this.faces, this.audio.muted);
      return;
    }
    // derrota
    this.state = 'FIELD';
    await Transition.fadeOut(400);
    document.getElementById('gameover')?.classList.remove('hidden');
    const tip = document.getElementById('gameover-tip');
    if (tip) tip.textContent = GAMEOVER_TIPS[Math.floor(Math.random() * GAMEOVER_TIPS.length)];
    await Transition.fadeIn(400);
    this.audio.stopMusic();
    this.audio.sfx('die');
    // posição segura: revive com metade do HP na vila
    this.state = 'GAMEOVER';
    this._lastSaveFallback();
  }

  _lastSaveFallback() {
    // ao voltar ao título, o jogador pode continuar de um save; revive o grupo na vila
    const retry = () => {
      this.player = new Player(SPAWN.x, SPAWN.y);
      for (const h of this.party) { h.hp = Math.ceil(h.maxHp / 2); h.mp = Math.ceil(h.maxMp / 2); }
      this.camera.snap(this.player.cx, this.player.cy);
    };
    const btn = document.getElementById('btn-retry');
    if (btn && !btn.dataset.armed) {
      btn.dataset.armed = '1';
      btn.addEventListener('click', retry, { once: false });
    }
  }

  async _showEnding() {
    const el = document.getElementById('ending');
    const turns = this.battle.turnCount;
    document.getElementById('ending-text').textContent =
      `O Dragão do Caos desfez-se em brasas e o Cristal de Lumen voltou a brilhar sobre Valoria. ` +
      `Kael, Lyra e Milo erguem o cristal — a lenda da planície, do bosque e das ruínas será contada por gerações. ` +
      `(Batalha final: ${turns} turnos · Nível médio ${Math.round(this.party.reduce((s, h) => s + h.level, 0) / 3)} · ⏱ ${this._fmtTime()}) ` +
      `Obrigado por jogar! 💎`;
    el?.classList.remove('hidden');
    await Transition.fadeIn(500);
    this.audio.stopMusic();
    this.audio.sfx('victory');
    this.state = 'ENDING';
  }

  // ---------- render ----------
  render() {
    const g = this.g;
    g.fillStyle = '#000';
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    if (this.state === 'TITLE') {
      // fundo animado atrás do título
      this._drawTitleBg();
      return;
    }
    if (this.state === 'BATTLE') return; // BattleSystem desenha no próprio canvas

    const ox = this.camera.ox, oy = this.camera.oy;
    const p = this.player;
    // retângulos dos atores (p/ oclusão das copas)
    const actorRects = [
      ...this.npcs.map((n) => ({ x: n.x + ox, y: n.y + oy, w: 32, h: 40 })),
      { x: p.x + ox - 4, y: p.y + oy - 12, w: 32, h: 40 },
    ];
    this.map.draw(g, ox, oy, this.time, actorRects);

    // cristal do altar
    const cxp = BOSS_ALTAR.x * TILE + ox, cyp = BOSS_ALTAR.y * TILE + oy;
    if (!this.flags.bossDefeated) {
      const float = Math.sin(this.time * 2.4) * 4;
      g.drawImage(this.crystalArt, cxp - 8, cyp - 24 + float, 48, 64);
    }

    // dragão do boss (sentinela no altar)
    if (!this.flags.bossDefeated) {
      const dx = BOSS_ALTAR.x * TILE + ox - 32, dy = BOSS_ALTAR.y * TILE + oy - 56 + Math.sin(this.time * 1.8) * 4;
      g.drawImage(this.dragonArt, dx, dy, 128, 96);
    }

    // cristal restaurador das ruínas (com halo pulsante = "cura aqui")
    {
      const hx = HEAL_CRYSTAL.x * TILE + ox + 16, hy = HEAL_CRYSTAL.y * TILE + oy + 20 + Math.sin(this.time * 2.4) * 3;
      const pulse = 0.5 + 0.3 * Math.sin(this.time * 3);
      g.fillStyle = `rgba(79,195,255,${(0.18 + pulse * 0.2).toFixed(2)})`;
      g.beginPath(); g.ellipse(hx, hy + 4, 16, 7, 0, 0, 7); g.fill();
      g.strokeStyle = `rgba(127,212,255,${pulse.toFixed(2)})`; g.lineWidth = 2;
      g.beginPath(); g.ellipse(hx, hy + 4, 12 + pulse * 6, 5 + pulse * 2, 0, 0, 7); g.stroke();
      g.fillStyle = '#7dff9a';
      g.font = 'bold 13px monospace'; g.textAlign = 'center';
      g.fillText('+', hx - 8 + Math.sin(this.time * 3) * 1, hy - 24);
      g.fillText('+', hx + 8 - Math.sin(this.time * 3) * 1, hy - 18);
      g.drawImage(this.crystalArt, hx - 12, hy - 22, 24, 32);
    }

    // brilho do boneco perdido (quest do Pip): boneco + estrela pulsante
    if (this.flags.toyQuest && !this.flags.toyFound) {
      const sx = TOY_SPOT.x * TILE + ox + 16, sy = TOY_SPOT.y * TILE + oy + 10 + Math.sin(this.time * 4) * 3;
      g.fillStyle = 'rgba(255,233,79,.25)';
      g.beginPath(); g.ellipse(sx, sy + 6, 12, 5, 0, 0, 7); g.fill();
      // corpinho do boneco de pano
      g.fillStyle = '#c98a5e';
      g.beginPath(); g.arc(sx, sy, 4, 0, 7); g.fill();
      g.fillRect(sx - 3, sy + 3, 6, 7);
      g.fillStyle = '#7a3b3b'; g.fillRect(sx - 3, sy + 5, 6, 2);
      g.fillStyle = '#101018'; g.fillRect(sx - 2, sy - 1, 1, 1); g.fillRect(sx + 1, sy - 1, 1, 1);
      const tw = 0.6 + 0.4 * Math.sin(this.time * 5);
      g.fillStyle = `rgba(255,233,79,${tw.toFixed(2)})`;
      g.fillRect(sx - 2, sy - 12, 4, 12);
      g.fillRect(sx - 6, sy - 8, 12, 4);
      g.fillStyle = '#fff';
      g.fillRect(sx - 1, sy - 10, 2, 8);
      g.fillRect(sx - 4, sy - 7, 8, 2);
    }

    // baús do tesouro (fechado brilha; aberto mostra a tampa erguida)
    for (const c of CHESTS) this._drawChest(g, ox, oy, c);

    // sombras suaves sob os atores (profundidade barata estilo 16-bit)
    const shadow = (sx, sy, w) => {
      g.fillStyle = 'rgba(0,0,10,.28)';
      g.beginPath(); g.ellipse(sx, sy, w, w * 0.32, 0, 0, 7); g.fill();
    };
    for (const n of this.npcs) shadow(n.x + ox + 16, n.y + oy + 36, n.id === 'kid' ? 9 : 12);
    shadow(p.x + ox + 12, p.y + oy + 26, 12);
    // entidades ordenadas por Y (Pip é criança: desenhado menor)
    /** @type {{y:number, draw:()=>void}[]} */
    const ents = [];
    for (const n of this.npcs) {
      const sc = n.id === 'kid' ? 0.78 : 1;
      ents.push({ y: n.y, draw: () => this._drawActor(n.x + ox, n.y + oy, this.npcArt[n.kind] || this.npcArt.elder, n.dir, n.moving ? n.animT : 0, sc) });
    }
    ents.push({ y: p.y, draw: () => this._drawActor(p.x + ox - 4, p.y + oy - 12, this.heroArt, p.dir, p.moving ? p.animT : 0, 1) });
    ents.sort((a, b) => a.y - b.y).forEach((e) => e.draw());
    // vara de pescar por cima do jogador + linha e bóia
    if (this._fishing) this._drawFishing(g, ox, oy);
    // copas por cima de quem está atrás das árvores
    this.map.drawCanopy(g, ox, oy, this.time);
    // clima/ambiente do bioma (chuva, neve, brasas, folhas, gaivotas...)
    this._drawWeather(g);
    // luz ambiente: halo quente ao redor do jogador + vinheta viva
    {
      const lx = p.cx + ox, ly = p.cy + oy - 6;
      const halo = g.createRadialGradient(lx, ly, 8, lx, ly, 150);
      halo.addColorStop(0, 'rgba(255,230,160,.10)');
      halo.addColorStop(0.5, 'rgba(255,230,160,.04)');
      halo.addColorStop(1, 'transparent');
      g.fillStyle = halo;
      g.fillRect(lx - 150, ly - 150, 300, 300);
      const vg = g.createRadialGradient(480, 270, 240, 480, 270, 620);
      vg.addColorStop(0, 'transparent');
      vg.addColorStop(1, `rgba(2,3,12,${(0.30 + 0.04 * Math.sin(this.time * 0.8)).toFixed(2)})`);
      g.fillStyle = vg;
      g.fillRect(0, 0, 960, 540);
    }
    // marca do toque (para onde o jogador está indo)
    if (this._tapMark && this.time - this._tapMark.t < 0.6) {
      const k = (this.time - this._tapMark.t) / 0.6;
      const mx = this._tapMark.x + ox, my = this._tapMark.y + oy;
      g.globalAlpha = 1 - k;
      g.strokeStyle = '#ffd75e'; g.lineWidth = 3;
      g.beginPath(); g.ellipse(mx, my, 6 + k * 14, (6 + k * 14) * 0.6, 0, 0, 7); g.stroke();
      g.fillStyle = '#ffd75e';
      g.fillRect(mx - 1.5, my - 1.5, 3, 3);
      g.globalAlpha = 1;
    }

    // balão "▼ E" quando há NPC falável à frente (prioridade sobre o "!" da quest)
    const npc = this._facingNpc();
    // balão "▼ E" sobre o baú próximo (só se não há NPC na frente — mesma prioridade do E)
    const chest = !npc ? this._nearChest() : null;
    if (chest && this.state === 'FIELD' && !this.dialog.active) {
      g.fillStyle = '#ffd75e';
      g.font = 'bold 20px monospace';
      g.strokeStyle = '#000'; g.lineWidth = 4;
      const cx = chest.x * TILE + ox + 16, cy = chest.y * TILE + oy - 26 + Math.sin(this.time * 5) * 2;
      g.strokeText('▼ E', cx - 14, cy);
      g.fillText('▼ E', cx - 14, cy);
    }
    // balão "!" dourado sobre o Pip quando a quest está pendente
    const pip = this.flags.toyQuest && !this.flags.toyRewarded ? this.npcs.find((n) => n.id === 'kid') : null;
    if (pip && pip !== npc && this.state === 'FIELD' && !this.dialog.active) {
      g.fillStyle = '#ffd75e';
      g.font = 'bold 22px monospace';
      g.strokeStyle = '#000'; g.lineWidth = 4;
      const qx = pip.x + ox + 8, qy = pip.y + oy - 24 + Math.sin(this.time * 5) * 3;
      g.strokeText('!', qx, qy);
      g.fillText('!', qx, qy);
    }

    // balão "▼ E" quando há NPC falável
    if (npc && this.state === 'FIELD' && !this.dialog.active) {
      g.fillStyle = '#fff';
      g.font = 'bold 20px monospace';
      g.strokeStyle = '#000'; g.lineWidth = 4;
      const bx = npc.x + ox + 8, by = npc.y + oy - 22 + Math.sin(this.time * 5) * 2;
      g.strokeText('▼ E', bx - 8, by);
      g.fillText('▼ E', bx - 8, by);
    }
    // dica de pesca: "🎣 E" pulsante sobre a água encarada (só fora da pescaria)
    if (!this._fishing && !npc && !chest && this.state === 'FIELD' && !this.dialog.active && !this.menu.active) {
      const ft = this.player.facingTile();
      if (this.map.tile(ft.x, ft.y) === T.WATER) {
        const fx = ft.x * TILE + ox + 16, fy = ft.y * TILE + oy - 6 + Math.sin(this.time * 5) * 2;
        g.font = 'bold 19px monospace'; g.textAlign = 'center';
        g.strokeStyle = '#000'; g.lineWidth = 4;
        g.strokeText('🎣 E', fx, fy);
        g.fillStyle = '#7fd4ff';
        g.fillText('🎣 E', fx, fy);
        g.textAlign = 'start';
        // ondinhas convidativas no tile da água
        g.strokeStyle = `rgba(180,230,255,${(0.45 + 0.25 * Math.sin(this.time * 4)).toFixed(2)})`;
        g.lineWidth = 2;
        g.beginPath(); g.ellipse(fx, fy + 12, 12, 4, 0, 0, 7); g.stroke();
      }
    }
    // painel do mini-game de pesca (por cima de tudo no mundo)
    if (this._fishing) this._drawFishGame(g);
  }

  /** Desenha vara na mão do jogador + linha até a bóia + bóia e mordida. */
  _drawFishing(g, ox, oy) {
    const f = this._fishing;
    if (!f) return;
    const p = this.player;
    const px = p.x + ox + 12, py = p.y + oy + 2; // mãos
    // ponta da vara conforme a direção (vara erguida p/ o lado da água)
    const aim = { x: f.bobWX + ox, y: f.bobWY + oy };
    const dx = aim.x - px, dy = aim.y - py;
    const len = Math.max(1, Math.hypot(dx, dy));
    const nx = dx / len, ny = dy / len;
    // base da vara na mão, ponta 46px em direção à água + leve arco p/ cima
    const bx = px, by = py - 6;
    const tx = bx + nx * 46, ty = by + ny * 30 - 14;
    // sombra da linha de voo durante o arremesso
    const castK = f.phase === 'cast' ? Math.min(1, f.t / 0.45) : 1;
    const tipX = bx + (tx - bx) * castK, tipY = by + (ty - by) * castK;
    // vara: madeira com 3 segmentos + cabo escuro + molinete
    g.strokeStyle = '#101018'; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(bx, by); g.lineTo(tipX, tipY); g.stroke();
    g.strokeStyle = '#8a5a2b'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(bx, by); g.lineTo(tipX, tipY); g.stroke();
    g.strokeStyle = '#c98d4e'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(bx, by); g.lineTo(tipX, tipY); g.stroke();
    g.fillStyle = '#3a2412';
    g.fillRect(bx - 3, by - 1, 7, 5);
    g.fillStyle = '#c0c6d0';
    g.beginPath(); g.arc(bx + nx * 10, by + 5, 3.4, 0, 7); g.fill();
    g.fillStyle = '#5a6270';
    g.beginPath(); g.arc(bx + nx * 10, by + 5, 1.6, 0, 7); g.fill();
    if (castK < 1) return; // linha ainda não chegou na água
    // linha: da ponta da vara até a bóia, com barriga
    const bobX = f.bobWX + ox, bobY = f.bobWY + oy + Math.sin(this.time * 3.2) * 2;
    const midX = (tipX + bobX) / 2, midY = (tipY + bobY) / 2 + 7;
    g.strokeStyle = 'rgba(240,244,255,.9)'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(tipX, tipY);
    g.quadraticCurveTo(midX, midY, bobX, bobY - 4);
    g.stroke();
    // ondulação ao redor da bóia
    const rip = 0.5 + 0.5 * Math.sin(this.time * 4);
    g.strokeStyle = `rgba(180,230,255,${(0.35 + rip * 0.3).toFixed(2)})`;
    g.lineWidth = 2;
    g.beginPath(); g.ellipse(bobX, bobY + 3, 10 + rip * 4, 4 + rip * 1.5, 0, 0, 7); g.stroke();
    // bóia: branca em cima, vermelha embaixo + anteninha
    const tug = f.phase === 'bite' ? Math.sin(this.time * 30) * 2 : 0;
    g.fillStyle = 'rgba(0,0,10,.25)';
    g.beginPath(); g.ellipse(bobX, bobY + 5, 5, 2, 0, 0, 7); g.fill();
    g.fillStyle = '#f2f4ff';
    g.beginPath(); g.arc(bobX, bobY + tug, 4.5, Math.PI, 0); g.fill();
    g.fillStyle = '#d63b3b';
    g.beginPath(); g.arc(bobX, bobY + tug, 4.5, 0, Math.PI); g.fill();
    g.fillStyle = '#101018';
    g.fillRect(bobX - 1, bobY - 9 + tug, 2, 5);
    g.fillStyle = '#ffd75e';
    g.fillRect(bobX - 1, bobY - 10 + tug, 2, 2);
    // "!" da mordida + aro de tempo
    if (f.phase === 'bite') {
      const k = Math.max(0, f.biteLeft / 0.95);
      const jx = bobX, jy = bobY - 30 + Math.sin(this.time * 12) * 2;
      g.font = 'bold 30px monospace'; g.textAlign = 'center';
      g.strokeStyle = '#000'; g.lineWidth = 5;
      const scale = 1 + 0.12 * Math.sin(this.time * 14);
      g.save(); g.translate(jx, jy); g.scale(scale, scale);
      g.strokeText('!', 0, 0); g.fillStyle = '#ffd75e'; g.fillText('!', 0, 0);
      g.restore();
      // anel encolhendo = janela da fisgada
      g.strokeStyle = `rgba(255,215,94,${(0.4 + 0.6 * k).toFixed(2)})`;
      g.lineWidth = 3;
      g.beginPath(); g.arc(bobX, bobY, 8 + (1 - k) * 16, 0, 7); g.stroke();
      g.textAlign = 'start';
      g.font = 'bold 15px monospace';
      g.strokeText('E!', bobX + 12, bobY - 14);
      g.fillStyle = '#fff'; g.fillText('E!', bobX + 12, bobY - 14);
    } else if (f.phase === 'wait' || f.phase === 'cast') {
      g.font = 'bold 13px monospace'; g.textAlign = 'center';
      g.strokeStyle = '#000'; g.lineWidth = 3;
      g.strokeText('...aguardando o peixe (Q sai)', bobX, bobY - 18);
      g.fillStyle = '#cfe0ff'; g.fillText('...aguardando o peixe (Q sai)', bobX, bobY - 18);
      g.textAlign = 'start';
    }
  }

  /** Painel do mini-game: pare o cursor na zona verde (dourado = perfeito). */
  _drawFishGame(g) {
    const f = this._fishing;
    if (!f || (f.phase !== 'reel' && f.phase !== 'caught' && f.phase !== 'miss')) return;
    const W = 460, H = f.phase === 'reel' ? 104 : 64;
    const x = (960 - W) / 2, y = 540 - H - 86;
    // caixa
    g.fillStyle = 'rgba(6,9,20,.92)';
    g.strokeStyle = '#cdd6ff'; g.lineWidth = 2;
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, W, H, 10); else g.rect(x, y, W, H);
    g.fill(); g.stroke();
    g.fillStyle = 'rgba(27,47,158,.5)';
    g.fillRect(x + 4, y + 4, W - 8, 20);
    g.font = 'bold 14px monospace'; g.textAlign = 'center';
    g.fillStyle = '#ffd75e';
    const title = f.phase === 'reel' ? '🎣 FISGOU! Trave no VERDE com E!' : f.phase === 'caught' ? '🎣 BOA!' : '🎣 ...';
    g.fillText(title, 480, y + 18);
    g.textAlign = 'start';
    if (f.phase !== 'reel') return;
    const bx = x + 24, bw = W - 48, by = y + 44, bh = 22;
    // trilho
    g.fillStyle = '#05060f';
    g.fillRect(bx, by, bw, bh);
    g.strokeStyle = '#ffffff55'; g.lineWidth = 1;
    g.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
    // zona verde + núcleo dourado perfeito
    const zx = bx + f.zoneX * bw, zw = f.zoneW * bw;
    const px = bx + (f.zoneX + f.zoneW / 2 - f.perfectW / 2) * bw, pw = f.perfectW * bw;
    g.fillStyle = '#1f9d55';
    g.fillRect(zx, by + 2, zw, bh - 4);
    g.fillStyle = 'rgba(255,215,94,.95)';
    g.fillRect(px, by + 2, pw, bh - 4);
    // marcas de 25/50/75
    g.fillStyle = 'rgba(255,255,255,.25)';
    for (const m of [0.25, 0.5, 0.75]) g.fillRect(bx + m * bw, by + 2, 1, bh - 4);
    // cursor
    const cx = bx + f.cursor * bw;
    const blink = 0.7 + 0.3 * Math.sin(this.time * 10);
    g.fillStyle = `rgba(255,255,255,${blink.toFixed(2)})`;
    g.fillRect(cx - 2, by - 6, 4, bh + 12);
    g.fillStyle = '#ff6b6b';
    g.fillRect(cx - 2, by - 6, 4, 4);
    g.fillRect(cx - 2, by + bh + 2, 4, 4);
    // dica
    g.font = '12px monospace'; g.fillStyle = '#9fb2ff'; g.textAlign = 'center';
    g.fillText('E = fisgar   ·   Q = soltar   ·   dourado = PERFEITO (+bônus)', 480, by + bh + 16);
    g.textAlign = 'start';
  }

  /** Desenha um baú: fechado com cadeado (e brilho) ou aberto com a tampa erguida. */
  _drawChest(g, ox, oy, c) {
    const opened = !!this.flags[`chest_${c.id}`];
    const bx = c.x * TILE + ox, by = c.y * TILE + oy;
    g.fillStyle = 'rgba(0,0,0,.28)';
    g.beginPath(); g.ellipse(bx + 16, by + 28, 13, 3, 0, 0, 7); g.fill();
    // corpo: madeira com cintas douradas
    g.fillStyle = '#4a2f14'; g.fillRect(bx + 3, by + 12, 26, 15);
    g.fillStyle = '#8a5a2b'; g.fillRect(bx + 4, by + 13, 24, 13);
    g.fillStyle = '#6e451f';
    g.fillRect(bx + 4, by + 18, 24, 2);
    for (let i = 0; i < 3; i++) g.fillRect(bx + 5 + i * 8, by + 13, 1, 13);
    g.fillStyle = '#ffd75e'; g.fillRect(bx + 3, by + 13, 2, 13); g.fillRect(bx + 27, by + 13, 2, 13);
    if (!opened) {
      // tampa fechada + cadeado
      g.fillStyle = '#5e3a17'; g.fillRect(bx + 3, by + 6, 26, 8);
      g.fillStyle = '#a8763e'; g.fillRect(bx + 3, by + 6, 26, 3);
      g.fillStyle = '#ffd75e'; g.fillRect(bx + 14, by + 11, 4, 5);
      g.fillStyle = '#4a2f14'; g.fillRect(bx + 15, by + 12, 2, 3);
      // brilho "tem tesouro aqui"
      const tw = 0.5 + 0.4 * Math.sin(this.time * 4 + c.x + c.y);
      g.fillStyle = `rgba(255,233,79,${tw.toFixed(2)})`;
      const sx = bx + 16, sy = by - 2 + Math.sin(this.time * 4) * 2;
      g.fillRect(sx - 1, sy - 6, 2, 12); g.fillRect(sx - 5, sy - 2, 10, 2);
    } else {
      // boca escura + tampa erguida atrás
      g.fillStyle = '#1d120a'; g.fillRect(bx + 5, by + 11, 22, 4);
      g.fillStyle = '#5e3a17'; g.fillRect(bx + 3, by - 6, 26, 10);
      g.fillStyle = '#a8763e'; g.fillRect(bx + 3, by - 6, 26, 3);
      g.fillStyle = '#ffd75e'; g.fillRect(bx + 3, by + 1, 2, 5); g.fillRect(bx + 27, by + 1, 2, 5);
    }
  }

  /** Acumula partículas de clima do bioma. @param {number} dt @param {string} region */
  _wxTick(dt, region) {
    const cap = region === 'forest' || region === 'snow' ? 80 : 50;
    this._wxAcc = (this._wxAcc || 0) + dt;
    const rate = region === 'town' ? 4 : region === 'beach' ? 5 : 14;
    let guard = 0;
    while (this._wxAcc > 1 / rate && guard++ < 8) {
      this._wxAcc -= 1 / rate;
      if (this._wx.length < cap) this._wx.push(this._wxSpawn(region));
    }
    for (const q of this._wx) {
      q.x += q.vx * dt; q.y += q.vy * dt; q.t += dt;
      if (q.type === 'snow') q.x += Math.sin(q.t * 3 + q.seed) * 22 * dt;
      if (q.type === 'leaf') q.x += Math.sin(q.t * 2 + q.seed) * 32 * dt;
      if (q.type === 'splash') q.vy += 420 * dt;
    }
    this._wx = this._wx.filter((q) => q.y < VIEW_H + 20 && q.x > -30 && q.x < VIEW_W + 30 && q.t < q.life);
  }

  /** Cria uma partícula de clima do bioma. @param {string} region */
  _wxSpawn(region) {
    const R = (a, b) => a + Math.random() * (b - a);
    switch (region) {
      case 'forest': return { type: 'rain', x: R(0, VIEW_W), y: -10, vx: -60, vy: 520, t: 0, life: 3, seed: R(0, 9) };
      case 'snow': return { type: 'snow', x: R(0, VIEW_W), y: -10, vx: -15, vy: R(40, 90), t: 0, life: 16, seed: R(0, 9), s: Math.random() < 0.25 ? 3 : 2 };
      case 'dungeon': case 'altar': return { type: 'ember', x: R(0, VIEW_W), y: VIEW_H + 6, vx: R(-15, 15), vy: R(-70, -35), t: 0, life: 7, seed: R(0, 9) };
      case 'beach': return Math.random() < 0.85
        ? { type: 'spark', x: R(0, VIEW_W), y: R(100, VIEW_H), vx: R(-12, 12), vy: R(-14, -4), t: 0, life: R(2, 4), seed: R(0, 9) }
        : { type: 'gull', x: -30, y: R(50, 150), vx: R(50, 90), vy: 0, t: 0, life: 24, seed: R(0, 9) };
      case 'town': return { type: 'dust', x: R(0, VIEW_W), y: R(0, VIEW_H), vx: R(-8, 8), vy: R(-12, -4), t: 0, life: R(3, 6), seed: R(0, 9) };
      case 'desert': return { type: 'sand', x: -20, y: R(60, VIEW_H), vx: R(120, 220), vy: R(-8, 8), t: 0, life: 9, seed: R(0, 9) };
      case 'swamp': return Math.random() < 0.6
        ? { type: 'bog', x: R(0, VIEW_W), y: R(120, VIEW_H), vx: R(-10, 10), vy: R(-12, -4), t: 0, life: R(3, 6), seed: R(0, 9) }
        : { type: 'mist', x: -120, y: R(180, 420), vx: R(16, 30), vy: 0, t: 0, life: 30, seed: R(0, 9) };
      default: return { type: 'leaf', x: R(0, VIEW_W), y: R(-20, VIEW_H), vx: R(-45, -15), vy: R(10, 30), t: 0, life: R(4, 8), seed: R(0, 9), col: ['#7dd87d', '#c9e88a', '#ff8fb3'][(Math.random() * 3) | 0] };
    }
  }

  /** Desenha o clima (espaço de tela, sobre o mundo). @param {CanvasRenderingContext2D} g */
  _drawWeather(g) {
    for (const q of this._wx) {
      if (q.type === 'rain') {
        g.fillStyle = 'rgba(150,200,255,.5)';
        g.fillRect(q.x, q.y, 1.5, 9);
      } else if (q.type === 'snow') {
        g.fillStyle = `rgba(255,255,255,${(0.5 + 0.4 * Math.sin(q.t * 3 + q.seed)).toFixed(2)})`;
        g.fillRect(q.x, q.y, q.s || 2, q.s || 2);
      } else if (q.type === 'ember') {
        g.fillStyle = `rgba(255,${120 + ((q.seed * 40) | 0)},40,${Math.max(0, 1 - q.t / q.life).toFixed(2)})`;
        g.fillRect(q.x, q.y, 3, 3);
      } else if (q.type === 'spark') {
        g.fillStyle = `rgba(255,240,150,${(0.3 + 0.5 * Math.abs(Math.sin(q.t * 3 + q.seed))).toFixed(2)})`;
        g.fillRect(q.x, q.y, 2, 2);
      } else if (q.type === 'gull') {
        g.strokeStyle = 'rgba(40,50,70,.8)'; g.lineWidth = 2; g.lineCap = 'round';
        const w = 5 + Math.sin(q.t * 8) * 2;
        g.beginPath();
        g.moveTo(q.x - 7, q.y); g.quadraticCurveTo(q.x - 3, q.y - w, q.x, q.y);
        g.quadraticCurveTo(q.x + 3, q.y - w, q.x + 7, q.y);
        g.stroke();
      } else if (q.type === 'dust') {
        g.fillStyle = `rgba(255,250,220,${(0.12 + 0.12 * Math.sin(q.t * 2 + q.seed)).toFixed(2)})`;
        g.fillRect(q.x, q.y, 2, 2);
      } else if (q.type === 'sand') {
        g.fillStyle = `rgba(230,200,140,${(0.25 + 0.2 * Math.sin(q.t * 4 + q.seed)).toFixed(2)})`;
        g.fillRect(q.x, q.y, 10, 2);
      } else if (q.type === 'bog') {
        g.fillStyle = `rgba(160,255,150,${(0.3 + 0.4 * Math.abs(Math.sin(q.t * 2.5 + q.seed))).toFixed(2)})`;
        g.fillRect(q.x, q.y, 2, 2);
      } else if (q.type === 'mist') {
        g.fillStyle = 'rgba(200,220,205,.09)';
        g.beginPath(); g.ellipse(q.x, q.y, 110, 16, 0, 0, 7); g.fill();
      } else if (q.type === 'poof') {
        const k = Math.min(1, q.t / q.life);
        g.fillStyle = `rgba(210,200,180,${(0.4 * (1 - k)).toFixed(2)})`;
        g.beginPath(); g.arc(q.x, q.y, 2 + k * 5, 0, 7); g.fill();
      } else if (q.type === 'splash') {
        const k = Math.min(1, q.t / q.life);
        g.fillStyle = `rgba(190,225,255,${(0.9 * (1 - k)).toFixed(2)})`;
        g.fillRect(q.x, q.y, 2.5, 2.5);
        g.fillStyle = `rgba(255,255,255,${(0.7 * (1 - k)).toFixed(2)})`;
        g.fillRect(q.x - 1, q.y - 2, 1.5, 1.5);
      } else if (q.type === 'ripple') {
        if (q.t < 0) { /* atraso escalonado */ } else {
          const k = Math.min(1, q.t / q.life);
          g.strokeStyle = `rgba(190,230,255,${(0.65 * (1 - k)).toFixed(2)})`;
          g.lineWidth = 2;
          g.beginPath(); g.ellipse(q.x, q.y + 3, 4 + k * 16, 2 + k * 6, 0, 0, 7); g.stroke();
        }
      } else {
        g.fillStyle = q.col || '#7dd87d';
        g.fillRect(q.x, q.y, 3, 2);
      }
    }
  }

  _drawActor(x, y, art, dir, animT, scale = 1) {
    const set = art[dir] || art.down;
    const frames = Array.isArray(set) ? set : [set];
    // andando: alterna os 2 frames de passo; parado: frame 0
    const img = animT > 0 ? frames[Math.floor(animT * 8) % frames.length] : frames[0];
    const bob = animT > 0 ? Math.abs(Math.sin(animT * 10)) * -3 : 0;
    const squash = animT > 0 ? 1 + Math.sin(animT * 10) * 0.02 : 1;
    const w = 32 * squash * scale, h = 40 * scale;
    // ancora pelos pés para o menor (criança) não flutuar
    this.g.drawImage(img, x + (32 - w) / 2, y + (40 - h) + bob * scale, w, h);
  }

  _drawTitleBg() {
    const g = this.g;
    const grad = g.createLinearGradient(0, 0, 0, VIEW_H);
    grad.addColorStop(0, '#04060f'); grad.addColorStop(0.55, '#101c5c'); grad.addColorStop(0.78, '#1d3a6e'); grad.addColorStop(1, '#0a1a2e');
    g.fillStyle = grad;
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    // lua + halo
    const mx = 800, my = 110;
    const halo = g.createRadialGradient(mx, my, 4, mx, my, 90);
    halo.addColorStop(0, 'rgba(240,246,255,.9)'); halo.addColorStop(0.25, 'rgba(200,220,255,.35)'); halo.addColorStop(1, 'transparent');
    g.fillStyle = halo;
    g.fillRect(mx - 90, my - 90, 180, 180);
    g.fillStyle = '#f2f6ff';
    g.beginPath(); g.arc(mx, my, 22, 0, 7); g.fill();
    g.fillStyle = '#c9d4ea';
    g.beginPath(); g.arc(mx - 7, my - 4, 5, 0, 7); g.fill();
    g.beginPath(); g.arc(mx + 6, my + 7, 3.5, 0, 7); g.fill();
    // estrelas cintilantes
    g.fillStyle = '#fff';
    for (let i = 0; i < 70; i++) {
      const x = (i * 173 + this.time * 8) % VIEW_W;
      const y = (i * 97) % 300;
      g.globalAlpha = 0.35 + 0.6 * Math.abs(Math.sin(this.time * 1.4 + i * 1.7));
      const s = i % 9 === 0 ? 3 : 2;
      g.fillRect(x, y, s, s);
    }
    g.globalAlpha = 1;
    // montanhas em 2 camadas + lago espelhando a lua
    g.fillStyle = '#131f3d';
    g.beginPath(); g.moveTo(0, 400);
    for (let x = 0; x <= VIEW_W; x += 80) g.lineTo(x, 330 + 40 * Math.abs(Math.sin(x * 0.01 + 2)));
    g.lineTo(VIEW_W, 400); g.closePath(); g.fill();
    g.fillStyle = '#1d3a4e';
    g.beginPath(); g.moveTo(0, 420);
    for (let x = 0; x <= VIEW_W; x += 60) g.lineTo(x, 360 + 30 * Math.abs(Math.sin(x * 0.013)));
    g.lineTo(VIEW_W, 420); g.closePath(); g.fill();
    // neve nos picos
    g.fillStyle = 'rgba(230,240,255,.8)';
    for (let x = 40; x < VIEW_W; x += 160) g.fillRect(x, 344 + 8 * Math.sin(x), 14, 5);
    g.fillStyle = '#14324a';
    g.fillRect(0, 420, VIEW_W, 40);
    // reflexo da lua na água
    g.fillStyle = `rgba(200,225,255,${(0.25 + 0.1 * Math.sin(this.time * 2)).toFixed(2)})`;
    for (let i = 0; i < 8; i++) {
      const w = 60 - i * 6;
      g.fillRect(mx - w / 2 + Math.sin(this.time * 2 + i) * 4, 428 + i * 8, w, 3);
    }
    g.fillStyle = '#1d3a24';
    g.fillRect(0, 492, VIEW_W, 48);
    g.fillStyle = '#2c5a34';
    for (let x = 0; x < VIEW_W; x += 24) {
      const h = 12 + 8 * Math.abs(Math.sin(x * 0.05 + this.time));
      g.fillRect(x, 492 - h, 14, h + 48);
    }
    // vagalumes sobre a grama do título
    for (let i = 0; i < 14; i++) {
      const fx = (i * 137 + Math.sin(this.time * 0.7 + i) * 30 + 960) % 960;
      const fy = 430 + ((i * 53) % 80);
      g.fillStyle = `rgba(255,240,150,${(0.3 + 0.5 * Math.abs(Math.sin(this.time * 2 + i * 2))).toFixed(2)})`;
      g.fillRect(fx, fy, 2, 2);
    }
  }
}
