/**
 * Engine — orquestra o jogo: título, exploração, diálogo, loja, batalha, saves.
 * @module core/Engine
 */
import { TILE, VIEW_W, VIEW_H, ENCOUNTER_RATE } from './Config.js';
import { Input } from './Input.js';
import { AudioMan } from './Audio.js';
import { Camera } from './Camera.js';
import { TileMap } from '../world/TileMap.js';
import { buildMap, regionAt, SPAWN, NPC_DEFS, BOSS_ALTAR, TOY_SPOT, HEAL_CRYSTAL, CHESTS, HUNT_GOAL, HERB_GOAL, ELITE, HOUSES, INTERIOR_SPAWN, INTERIOR_DOOR, buildInterior, INTERIOR_NPCS, placeName } from '../world/MapData.js';
import { isEncounterTile, tileColor, T } from '../world/Tiles.js';
import { NPC } from '../world/NPCs.js';
import { Player } from '../entities/Player.js';
import { newParty, aliveHeroes, restoreParty, serializeParty, fullHeal } from '../entities/Party.js';
import { makeEncounter, makeBoss, makeElite } from '../entities/Enemies.js';
import { newInventory, useItem, ITEMS, SHOP_STOCK } from '../systems/Inventory.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { loadSettings, saveSettings, SPEED_ORDER } from '../systems/Settings.js';
import { Dialog } from '../ui/Dialog.js';
import { Menu } from '../ui/Menu.js';
import { HUD } from '../ui/HUD.js';
import { TitleScreen } from '../ui/TitleScreen.js';
import { Transition, toast } from '../ui/Transition.js';
import { BattleSystem } from '../battle/BattleSystem.js';
import { makeHumanoid, makeDragon, makeCrystal, makeAncient, makePortrait, humanoidFace, dragonFace } from './SpriteFactory.js';
import { ic, preloadIcons } from '../ui/ItemIcons.js';
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
  smith:    { skin: '#d89a6a', hair: '#1e1e1e', tunic: '#5e3a17', pants: '#3a2a1a' },
  bard:     { skin: '#f2c89b', hair: '#e8a23c', tunic: '#8e2b8c', pants: '#3a2a4a' },
  sailor:   { skin: '#c89878', hair: '#dddddd', tunic: '#2b6fd6', pants: '#3a3a4a' },
  sage:     { skin: '#e8b88a', hair: '#ffffff', tunic: '#1b2f9e', pants: '#2a2a3a' },
  herbalist:{ skin: '#d89a6a', hair: '#3a2a1a', tunic: '#2e7d46', pants: '#4a3a2a' },
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
  'Dica: Bombas de Fogo do Rurik derretem Golems e o Golem Ancião.',
  'Dica: a magia Gelo da Lyra (Nv 4) pode congelar o inimigo.',
  'Dica: o Elixir restaura HP e MP de uma vez — ótimo contra o Dragão.',
  'Dica: a Yara, no pântano, paga por sapos e cogumelos derrotados.',
];

/**
 * Pokédex da pescaria: cada espécie tem velocidade da barra, tamanho da zona,
 * janela da fisgada e pesos por região. `item` = id em ITEMS (só p/ peixes).
 */
const FISH_DEX = [
  { id: 'lambari', name: 'Lambari Prateado', icon: '🐟', item: 'lambari', color: '#b9c8de', belly: '#eef2fa',
    size: 'P', stars: 1, speed: 0.55, zone: 0.30, perfect: 0.090, bite: 1.25, w: 38, wBeach: 30,
    toast: 'Lambari Prateado pescado!' },
  { id: 'fish', name: 'Peixe Fresco', icon: '🐟', item: 'fish', color: '#4fa8e0', belly: '#cfeaff',
    size: 'M', stars: 2, speed: 0.72, zone: 0.24, perfect: 0.075, bite: 1.05, w: 30, wBeach: 28,
    toast: 'Peixe Fresco pescado!' },
  { id: 'royal', name: 'Peixe Real', icon: '👑', item: 'royal', color: '#3b5fe0', belly: '#9fb2ff',
    size: 'M', stars: 3, speed: 0.95, zone: 0.185, perfect: 0.060, bite: 0.95, w: 15, wBeach: 22,
    toast: 'PEIXE REAL pescado! Escamas azuis!' },
  { id: 'goldfish', name: 'Dourado Lendário', icon: '✨', item: 'goldfish', color: '#e8a91e', belly: '#ffe9a8',
    size: 'G', stars: 5, speed: 1.22, zone: 0.135, perfect: 0.050, bite: 0.80, w: 5, wBeach: 10,
    toast: 'DOUDRADO LENDÁRIO! A lenda da praia!' },
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
    this.ancientArt = makeAncient();
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
      'Rurik (Ferreiro)': humanoidFace(this.npcArt.smith),
      'Felix, o Bardo': humanoidFace(this.npcArt.bard),
      Mia: humanoidFace(this.npcArt.kid),
      'Guarda Dina': humanoidFace(this.npcArt.guard),
      'Velho Tumba': humanoidFace(this.npcArt.sailor),
      'Sábia Sella': humanoidFace(this.npcArt.sage),
      'Herbalista Yara': humanoidFace(this.npcArt.herbalist),
      'Eremita Ash': humanoidFace(this.npcArt.hermit),
      'Lia (Aprendiz)': humanoidFace(this.npcArt.sage),
      'Viajante Nia': humanoidFace(this.npcArt.nomad),
      'Hóspede Tom': humanoidFace(this.npcArt.fisher),
      'Sana (Aprendiz)': humanoidFace(this.npcArt.hunter),
      'GOLEM ANCIÃO': makePortrait(this.ancientArt, 8, 0, 72, 62),
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
    this.worldMap = new TileMap(buildMap());
    this.map = this.worldMap;
    this.interiorMaps = {};
    this.interiorNpcs = {};
    this.place = { kind: 'world' };
    this._buildMinimap();
    this._newGameState();
    try { preloadIcons(); } catch { /* canvas indisponível */ }
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
    this.worldMap = new TileMap(buildMap());
    this.map = this.worldMap;
    this.interiorMaps = {};
    this.interiorNpcs = {};
    this.place = { kind: 'world' };
    this.npcs = NPC_DEFS.map((d) => new NPC(d));
    this.worldNpcs = this.npcs;
    this.camera.snap(this.player.cx, this.player.cy, this.map.w * TILE, this.map.h * TILE);
  }

  /** Mapa atual (mundo ou interior). */
  _curMap() { return this.map; }
  /** Largura/altura do mapa atual em px (p/ a câmera). */
  _mapPx() { return [this.map.w * TILE, this.map.h * TILE]; }
  /** Está dentro de alguma casa? */
  _isInterior() { return !!this.place && this.place.kind === 'interior'; }
  /** Região atual (id do interior ou regionAt do mundo). */
  _curRegion() {
    if (this._isInterior()) return this.place.id;
    return regionAt(this.player.tileX, this.player.tileY);
  }

  /** Entra na casa `id`: troca de cena com fade, reposiciona o jogador e os NPCs. */
  async _enterHouse(id) {
    if (this._busy || this._isInterior()) return;
    const house = HOUSES.find((h) => h.id === id);
    if (!house) return;
    this._busy = true;
    try {
      this.audio.sfx('door');
      await Transition.fadeOut(220);
      this._returnPos = { x: this.player.x, y: this.player.y, dir: this.player.dir };
      if (!this.interiorMaps[id]) {
        this.interiorMaps[id] = new TileMap(buildInterior(id));
        this.interiorNpcs[id] = (INTERIOR_NPCS[id] || []).map((d) => new NPC(d));
      }
      this.worldNpcs = this.npcs;
      this.place = { kind: 'interior', id };
      this.map = this.interiorMaps[id];
      this.npcs = this.interiorNpcs[id];
      this.player.x = INTERIOR_SPAWN.x * TILE + 4;
      this.player.y = INTERIOR_SPAWN.y * TILE;
      this.player.dir = 'up';
      this.player.slideX = 0; this.player.slideY = 0;
      this._path = null; this._tapAct = null; this._tapMark = null;
      this._fishing = null;
      const [mw, mh] = this._mapPx();
      this.camera.snap(this.player.cx, this.player.cy, mw, mh);
      this._lastRegion = id;
      this._showBanner(id);
      await Transition.fadeIn(280);
      toast(`🚪 ${house.name}`);
    } finally {
      this._busy = false;
    }
  }

  /** Sai da casa atual de volta à porta de origem no mundo. */
  async _exitHouse() {
    if (this._busy || !this._isInterior()) return false;
    const house = HOUSES.find((h) => h.id === this.place.id);
    this._busy = true;
    try {
      this.audio.sfx('door');
      await Transition.fadeOut(220);
      this.place = { kind: 'world' };
      this.map = this.worldMap;
      this.npcs = this.worldNpcs || this.npcs;
      const fx = house ? house.front : null;
      if (fx) {
        this.player.x = fx.x * TILE + 4;
        this.player.y = fx.y * TILE;
      } else if (this._returnPos) {
        this.player.x = this._returnPos.x; this.player.y = this._returnPos.y;
      }
      this.player.dir = 'down';
      this.player.slideX = 0; this.player.slideY = 0;
      this._path = null; this._tapAct = null; this._tapMark = null;
      this._fishing = null;
      const [mw, mh] = this._mapPx();
      this.camera.snap(this.player.cx, this.player.cy, mw, mh);
      this._lastRegion = regionAt(this.player.tileX, this.player.tileY);
      await Transition.fadeIn(280);
      return true;
    } finally {
      this._busy = false;
    }
  }

  /** Casa cuja porta está no tile (usado pelo E e pelo toque). */
  _houseAt(tx, ty) {
    return HOUSES.find((h) => h.door.x === tx && h.door.y === ty) || null;
  }

  /** Tenta entrar na casa (E encarando a porta ou em cima dela). Retorna true se consumiu. */
  _tryHouseEnter() {
    if (this._isInterior()) return false;
    const ft = this.player.facingTile();
    let h = this._houseAt(ft.x, ft.y);
    if (!h) h = this._houseAt(this.player.tileX, this.player.tileY);
    if (!h) return false;
    this._faceToward(h.door.x * TILE + 16, h.door.y * TILE + 16);
    this._enterHouse(h.id);
    return true;
  }

  /** Tenta sair da casa (E encarando/em cima da porta interna). */
  _tryHouseExit() {
    if (!this._isInterior()) return false;
    const ft = this.player.facingTile();
    const onDoor = this.player.tileX === INTERIOR_DOOR.x && this.player.tileY === INTERIOR_DOOR.y;
    const faceDoor = ft.x === INTERIOR_DOOR.x && ft.y === INTERIOR_DOOR.y;
    if (!onDoor && !faceDoor) return false;
    this._exitHouse();
    return true;
  }

  /** Pré-renderiza o minimapa (2px por tile, sempre do mundo). */
  _buildMinimap() {
    const c = document.createElement('canvas');
    c.width = this.worldMap.w * 2; c.height = this.worldMap.h * 2;
    const g = c.getContext('2d');
    for (let y = 0; y < this.worldMap.h; y++) for (let x = 0; x < this.worldMap.w; x++) {
      g.fillStyle = tileColor(this.worldMap.tile(x, y));
      g.fillRect(x * 2, y * 2, 2, 2);
    }
    this.mmBase = c;
  }

  /** Banner de região ao entrar num local novo. @param {string} region */
  _showBanner(region) {
    const el = document.getElementById('region-banner');
    if (!el) return;
    const names = { town: 'Vila Lumen', elder: 'Casa do Ancião', shop: 'Loja da Mira', inn: 'Estalagem do Bram', smith: 'Ferraria do Rurik', field: 'Planície Verdejante', forest: 'Bosque Sombrio', dungeon: 'Ruínas do Cristal', altar: 'Altar do Caos', beach: 'Praia do Sol', snow: 'Pico Nevado', desert: 'Deserto Dourado', swamp: 'Pântano Sombrio' };
    const subs = { town: 'povoado pacato', elder: 'o ancião o aguarda', shop: 'ouro na mão, poção na sacola', inn: 'cama quente por 20G', smith: 'martelo quente, lâmina fria', field: 'cuidado com a grama alta', forest: 'feras entre as árvores', dungeon: 'o cristal o aguarda', altar: 'NÃO HÁ VOLTA', beach: 'águas calmas — bom p/ pescar', snow: 'o frio morde — feras fortes', desert: 'o oásis esconde um baú', swamp: 'não beba a água' };
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
    this.worldMap = new TileMap(buildMap());
    this.interiorMaps = {};
    this.interiorNpcs = {};
    this._buildMinimap();
    this.npcs = NPC_DEFS.map((def) => new NPC(def));
    this.worldNpcs = this.npcs;
    for (const n of this.npcs) {
      if (n.gift && (d.flags[`gift_${n.id}`] || (n.id === 'hermit' && d.flags.giftTaken))) n.giftGiven = true;
    }
    // save feito dentro de casa: volta para a porta da casa no mundo
    this.place = { kind: 'world' };
    this.map = this.worldMap;
    if (d.place && d.place.kind === 'interior') {
      const house = HOUSES.find((h) => h.id === d.place.id);
      if (house) {
        this.player.x = house.front.x * TILE + 4;
        this.player.y = house.front.y * TILE;
      }
    }
    const [mw, mh] = [this.map.w * TILE, this.map.h * TILE];
    this.camera.snap(this.player.cx, this.player.cy, mw, mh);
  }

  _snapshot() {
    return {
      x: this.player.x, y: this.player.y, dir: this.player.dir,
      party: serializeParty(this.party), inv: { ...this.inv },
      gold: this.gold, flags: { ...this.flags, giftTaken: this.npcs.find((n) => n.id === 'hermit')?.giftGiven, ...Object.fromEntries(this.npcs.filter((n) => n.gift).map((n) => [`gift_${n.id}`, !!n.giftGiven])) },
      playSec: Math.floor(this._elapsed()),
      place: this._isInterior() ? { ...this.place } : { kind: 'world' },
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

    // falar / portas de casas / altar do boss / cristal / brinquedo / baú / pesca
    if (!this._fishing && inp.pressed.confirm) {
      this._path = null; this._tapAct = null;
      if (this._tryHouseExit()) return;
      if (this._tryHouseEnter()) return;
      if (!this._isInterior()) {
        if (this._tryBossInteract()) return;
        if (this._tryEliteInteract()) return;
        if (this._tryHealCrystal()) return;
        if (this._tryToyPickup()) return;
        if (this._tryChest()) return;
      }
      const npc = this._facingNpc();
      if (npc) { this._talk(npc); return; }
      if (!this._isInterior() && this._tryFish()) return;
    }

    // movimento (Shift = correr)
    // NPCs NÃO bloqueiam: dá para atravessar sem travar (falar continua pelo E)
    const blockers = [];
    if (!this._isInterior()) {
      // dragão bloqueia o altar até ser derrotado
      if (!this.flags.bossDefeated) blockers.push({ x: BOSS_ALTAR.x * TILE, y: BOSS_ALTAR.y * TILE });
      // baús são sólidos (abertos ou não)
      for (const c of CHESTS) blockers.push({ x: c.x * TILE, y: c.y * TILE });
    }
    if (this._fishCd > 0) this._fishCd -= dt;
    // pescaria congela o movimento: só o tick da vara/bóia avança
    if (this._fishing) {
      for (const n of this.npcs) n.update(dt, this.map);
      const [fmw, fmh] = this._mapPx();
      this.camera.follow(this.player.cx, this.player.cy, dt, fmw, fmh);
      this.camera.update(dt);
      this._wxTick(dt, this._curRegion());
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
      this._emitTrail(dt);
    } else if (ax.x !== 0 || ax.y !== 0) {
      this._bumpT = (this._bumpT || 0) + dt;
      if (this._bumpT > 0.35) { this._bumpT = 0; this.audio.sfx('bump'); }
    } else { this._stepT = 0; this._bumpT = 0; this._poofT = 0; this._smokeT = 0; this._ghostT = 0; this._walkT = 0; }
    for (const n of this.npcs) {
      n.update(dt, this.map);
      // patrulha levanta poeirinha atrás dos pés (fora do sprite)
      if (n.moving && Math.random() < dt * 5 && this._wx.length < 110) {
        const b = this._behind(n.x + 16 + this.camera.ox, n.y + 20 + this.camera.oy, n.dir, 3);
        this._wx.push({
          type: 'stepdust',
          x: b.x, y: b.y,
          vx: -b.dx * 14 + (Math.random() - 0.5) * 10, vy: -b.dy * 8 - 12 - Math.random() * 8,
          t: 0, life: 0.4, seed: Math.random() * 9, col: '210,200,180',
        });
      }
    }
    const [mmw, mmh] = this._mapPx();
    this.camera.follow(this.player.cx, this.player.cy, dt, mmw, mmh);
    this.camera.update(dt);
    // clima/ambiente do bioma atual (só visual, sem gameplay)
    this._wxTick(dt, this._curRegion());

    // encontros aleatórios na grama (só no mundo, nunca dentro de casa)
    const steps = this.player.consumeSteps();
    if (steps > 0 && !this._isInterior()) {
      const tile = this.map.tile(this.player.tileX, this.player.tileY);
      const region = regionAt(this.player.tileX, this.player.tileY);
      if (isEncounterTile(tile) && region !== 'town' && Math.random() < ENCOUNTER_RATE * steps * 2.2) {
        this._startWildBattle(region);
        return;
      }
    }

    // música por região + banner de local novo + HUD (só re-renderiza quando algo mudou)
    const region = this._curRegion();
    if (!this._lastRegion) this._lastRegion = region;
    else if (this._lastRegion !== region) { this._lastRegion = region; this._showBanner(region); }
    const want = this._isInterior() || region === 'town' || region === 'beach' ? 'town' : region === 'dungeon' || region === 'altar' || region === 'swamp' ? 'dungeon' : 'field';
    if (this.audio.ctx && this.audio.currentTrack !== want) this.audio.playMusic(want);
    if (this.hud.mm) this.hud.mm.style.display = this._isInterior() ? 'none' : '';
    if (!this._isInterior()) this.hud.renderMinimap(this.mmBase, this.camera.ox, this.camera.oy, this.player.tileX, this.player.tileY, this.flags.bossDefeated ? null : BOSS_ALTAR);
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
      if (!this._isInterior()) {
        if (!this.flags.bossDefeated && x === BOSS_ALTAR.x && y === BOSS_ALTAR.y) return true;
        if (CHESTS.some((c) => c.x === x && c.y === y)) return true;
      }
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
    if (this._isInterior()) {
      if (tx === INTERIOR_DOOR.x && ty === INTERIOR_DOOR.y) return { kind: 'house-exit' };
      return null;
    }
    const house = this._houseAt(tx, ty);
    if (house) return { kind: 'house-enter', id: house.id };
    if (CHESTS.some((c) => c.x === tx && c.y === ty)) return { kind: 'chest' };
    if (tx === BOSS_ALTAR.x && ty === BOSS_ALTAR.y) return { kind: 'spot', which: 'boss' };
    if (tx === ELITE.x && ty === ELITE.y) return { kind: 'spot', which: 'elite' };
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
    } else if (act.kind === 'house-enter') {
      const house = HOUSES.find((h) => h.id === act.id);
      if (house) {
        const dx = house.door.x * TILE + 16, dy = house.door.y * TILE + 16;
        if (Math.hypot(dx - this.player.cx, dy - this.player.cy) > TILE * 2.2) return;
        this._faceToward(dx, dy);
        this._enterHouse(act.id);
      }
    } else if (act.kind === 'house-exit') {
      this._tryHouseExit();
    } else if (act.kind === 'chest') {
      this._tryChest();
    } else if (act.kind === 'fish') {
      this._faceToward(act.tx * TILE + 16, act.ty * TILE + 16);
      this._tryFish(act.tx, act.ty);
    } else if (act.kind === 'spot') {
      if (act.which === 'boss') this._tryBossInteract();
      else if (act.which === 'elite') this._tryEliteInteract();
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
    if (npc.id === 'herbalist') return this._talkHerbalist(npc);
    if (npc.id === 'sailor') return this._talkSailor(npc);
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

  /** Quest de ervas: Herbalista Yara paga por sapos e cogumelos do pântano. */
  _talkHerbalist(npc) {
    const f = this.flags;
    const count = f.herbCount || 0;
    if (f.herbRewarded) {
      this.dialog.say([
        { name: npc.name, text: 'Meu tônico fez efeito? O pântano segue verdejante graças a você!' },
      ]);
      return;
    }
    if (!f.herbQuest) {
      f.herbQuest = true;
      this.audio.sfx('confirm');
      this.dialog.say([
        { name: npc.name, text: `Minhas ervas somem na gosma dos SAPOS GIGANTES e dos COGUMELOS!` },
        { name: 'Herbalista Yara', text: `Derrote ${HERB_GOAL} deles no pântano e eu pago 150G e um HI-ÉTER. Boa colheita!` },
      ]);
      toast(`Nova quest: cace ${HERB_GOAL} sapos/cogumelos!`);
      return;
    }
    if (count >= HERB_GOAL) {
      f.herbRewarded = true;
      this.gold += 150;
      this.inv.hiether = (this.inv.hiether || 0) + 1;
      this.audio.sfx('levelup');
      this.dialog.say([
        { name: npc.name, text: 'Que cheiro de vitória... e de sapo derrotado!' },
        { name: 'Herbalista Yara', text: 'Aqui estão 150G e um HI-ÉTER do meu melhor lote. Beba com sabedoria!' },
      ]);
      toast('+150G · +1 Hi-Éter!');
      return;
    }
    this.dialog.say([
      { name: npc.name, text: `Faltam ${HERB_GOAL - count} pragas. Procure no pântano a sudoeste! (${count}/${HERB_GOAL})` },
    ]);
  }

  /** Quest de pesca: Velho Tumba quer um Peixe Real de verdade. */
  _talkSailor(npc) {
    const f = this.flags;
    if (f.pearlRewarded) {
      this.dialog.say([
        { name: npc.name, text: 'Aquele Peixe Real... ah, bons tempos! O mar agradece, e eu também!' },
      ]);
      return;
    }
    // presente de boas-vindas (uma vez), como os outros NPCs
    const lines = [];
    if (npc.gift && !npc.giftGiven) {
      npc.giftGiven = true;
      this.inv[npc.gift] = (this.inv[npc.gift] || 0) + 1;
      lines.push({ name: npc.name, text: `Tome este ${ITEMS[npc.gift].name}. Isca boa pega peixe bom.` });
      this.audio.sfx('item');
    }
    if (!f.pearlQuest) {
      f.pearlQuest = true;
      this.audio.sfx('confirm');
      lines.push(
        { name: npc.name, text: 'Trinta anos de mar... e nunca pesquei um PEIXE REAL de verdade!' },
        { name: 'Velho Tumba', text: 'Traga-me um PEIXE REAL (pesque encarando a água!) e conto onde escondi 200G e 2 BOMBAS!' },
      );
      this.dialog.say(lines);
      toast('Nova quest: pesque um Peixe Real!');
      return;
    }
    if ((this.inv.royal || 0) >= 1) {
      this.inv.royal--;
      f.pearlRewarded = true;
      this.gold += 200;
      this.inv.bomb = (this.inv.bomb || 0) + 2;
      this.audio.sfx('levelup');
      lines.push(
        { name: npc.name, text: 'AZUL! Escamas azuis de verdade! Você é pescador de verdade!' },
        { name: 'Velho Tumba', text: 'Como prometido: 200G e 2 BOMBAS DE FOGO do meu paiol. Queimem os golems por mim!' },
      );
      this.dialog.say(lines);
      toast('+200G · +2 Bombas de Fogo!');
      return;
    }
    lines.push({ name: npc.name, text: 'Nada de Peixe Real ainda? Encare a ÁGUA e aperte E. Na praia a sorte é maior!' });
    this.dialog.say(lines);
  }

  /** Baú ao alcance do jogador (para o E e para a dica visual). */
  _nearChest() {
    return CHESTS.find((k) =>
      Math.hypot(this.player.cx - (k.x * TILE + 16), this.player.cy - (k.y * TILE + 16)) < TILE * 1.6) || null;
  }

  /** Baú do tesouro: E por perto abre uma única vez. */
  _tryChest() {
    if (this._isInterior()) return false;
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

  // ---------- pescaria com vara + mini-game por espécie ----------
  /** Sorteia o que mordeu o anzol (espécie ou sucata). @returns {{kind:string, spec?:any}} */
  _pickCatch() {
    const beach = regionAt(this.player.tileX, this.player.tileY) === 'beach';
    const r = Math.random();
    // sucatas e tesouros (fração fixa, resto = peixe da DEX)
    if (r < 0.09) return { kind: 'boot' };
    if (r < 0.20) return { kind: 'algae' };
    const pearlCh = beach ? 0.30 : 0.26;
    if (r < pearlCh) return { kind: 'pearl', beach };
    let total = 0;
    for (const s of FISH_DEX) total += beach ? s.wBeach : s.w;
    let roll = Math.random() * total;
    for (const s of FISH_DEX) {
      roll -= beach ? s.wBeach : s.w;
      if (roll <= 0) return { kind: 'fish', spec: s };
    }
    return { kind: 'fish', spec: FISH_DEX[1] };
  }

  /** Inicia a pescaria: E encarando a água (ou tocando a água). Retorna true se lançou a linha. */
  _tryFish(forceTX, forceTY) {
    if (this._isInterior()) return false;
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
    this.player.moving = false; this.player.animT = 0;
    this.player.slideX = 0; this.player.slideY = 0;
    const catch_ = this._pickCatch();
    const spec = catch_.kind === 'fish' ? catch_.spec
      : catch_.kind === 'boot' ? { ...FISH_DEX[0], name: 'Bota Velha', icon: '🥾' }
      : catch_.kind === 'algae' ? { ...FISH_DEX[0], name: 'Algas', icon: '🌿' }
      : { ...FISH_DEX[2], name: 'Pérola', icon: '🪙' };
    this._fishing = {
      phase: 'cast', t: 0,
      tx, ty,
      bobWX: tx * TILE + 16, bobWY: ty * TILE + 16,
      fromX: this.player.cx, fromY: this.player.cy,
      catch: catch_, spec,
      biteAt: 1.4 + Math.random() * 2.4,
      biteLeft: 0, nibbleT: 0.4 + Math.random() * 1.2,
      cursor: 0, cdir: 1, trail: [],
      zoneX: 0.25 + Math.random() * 0.5, zoneW: 0.22, perfectW: 0.07,
      reelT: 0, splashT: 0, dashT: 0, dashIn: 1.2 + Math.random() * 1.4,
      struggle: 0, reelAngle: 0, grade: '', resultText: '', missMsg: '',
    };
    this.audio.sfx('reel');
    return true;
  }

  /** E durante a pescaria: fisga na hora do "!" ou trava o cursor no mini-game. */
  _fishPress() {
    const f = this._fishing;
    if (!f) return;
    if (f.phase === 'bite') {
      // fisgou! o mini-game usa os parâmetros da espécie que mordeu
      const beach = regionAt(this.player.tileX, this.player.tileY) === 'beach';
      const ease = beach && f.catch.kind === 'fish' ? 1.12 : 1; // praia facilita um pouco
      f.zoneW = Math.min(0.34, f.spec.zone * ease);
      f.perfectW = f.spec.perfect;
      f.zoneX = 0.06 + Math.random() * (0.88 - f.zoneW);
      f.phase = 'reel'; f.t = 0; f.reelT = 0;
      f.cursor = Math.random();
      f.cdir = Math.random() < 0.5 ? -1 : 1;
      f.trail.length = 0;
      f.dashIn = 0.9 + Math.random() * 1.2;
      f.struggle = 0;
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
        f.phase = 'bite'; f.t = 0; f.biteLeft = f.spec.bite;
        this.audio.sfx('bite');
        this._fishSplash(f.bobWX, f.bobWY, 8);
      }
    } else if (f.phase === 'bite') {
      f.biteLeft -= dt;
      if (f.biteLeft <= 0) this._fishMiss('O peixe escapou... (fisgue no “!” com E)');
    } else if (f.phase === 'reel') {
      f.reelT += dt;
      f.reelAngle += dt * (4 + f.struggle * 10);
      // --- cursor inteligente: base lenta + temperamento da espécie ---
      const ramp = Math.min(0.28, f.reelT * 0.022); // acelera de leve com o tempo
      let sp = (0.60 + ramp) * f.spec.speed;
      // "se debate": rajadas curtas que aceleram e podem inverter
      f.struggle = Math.max(0, f.struggle - dt);
      f.dashIn -= dt;
      if (f.dashIn <= 0 && f.struggle <= 0) {
        f.struggle = 0.45 + Math.random() * 0.45;
        f.dashIn = 1.1 + Math.random() * 1.6;
        if (Math.random() < 0.38) f.cdir *= -1; // arranque vira o cursor
        this.audio.sfx('plop');
        this._fishRipple(f.bobWX, f.bobWY, 1);
      }
      if (f.struggle > 0) sp *= 1.75;
      f.cursor += f.cdir * sp * dt;
      // oscilação fina (o peixe "nada" — exige microcorreção)
      f.cursor += Math.sin(f.reelT * 3.3) * 0.10 * dt * f.spec.speed;
      if (f.cursor >= 1) { f.cursor = 1; f.cdir = -1; }
      if (f.cursor <= 0) { f.cursor = 0; f.cdir = 1; }
      f.trail.push(f.cursor);
      if (f.trail.length > 14) f.trail.shift();
      if (f.reelT > 10) this._fishMiss('A linha arrebentou por demora...');
    } else if (f.phase === 'caught' || f.phase === 'miss') {
      if (f.t > (f.phase === 'caught' ? 1.7 : 1.1)) this._endFish();
    }
  }

  /** Veredito ao vivo do cursor (p/ o painel ser preciso). @returns {{txt:string,col:string}} */
  _fishVerdict() {
    const f = this._fishing;
    if (!f) return { txt: '', col: '#fff' };
    const c = (f.cursor - (f.zoneX + f.zoneW / 2)) / (f.zoneW / 2); // -1..1 (0 = centro)
    const a = Math.abs(c);
    if (a <= (f.perfectW / f.zoneW)) return { txt: 'PERFEITO!', col: '#ffd75e' };
    if (a <= 0.55) return { txt: 'ÓTIMO', col: '#37e08b' };
    if (a <= 1) return { txt: 'BOM...', col: '#9fb2ff' };
    return { txt: c < 0 ? '◀ LONGE' : 'LONGE ▶', col: '#ff6b6b' };
  }

  /** Resolve a tentativa do mini-game (cursor dentro da zona = pega). */
  _fishStrike() {
    const f = this._fishing;
    if (!f || f.phase !== 'reel') return;
    const c = f.cursor;
    const z0 = f.zoneX, z1 = f.zoneX + f.zoneW;
    const mid = f.zoneX + f.zoneW / 2;
    const halfP = f.perfectW / 2;
    if (c >= z0 && c <= z1) {
      const d = Math.abs(c - mid) / (f.zoneW / 2);
      const grade = Math.abs(c - mid) <= halfP ? 'PERFEITA' : d <= 0.55 ? 'ÓTIMA' : 'BOA';
      this._fishReward(grade);
    } else {
      this._fishMiss('Errou a zona verde... o peixe fugiu!');
    }
  }

  /** Recompensa da pescaria conforme espécie + precisão. */
  _fishReward(grade) {
    const f = this._fishing;
    f.phase = 'caught'; f.t = 0; f.grade = grade;
    this._fishSplash(f.bobWX, f.bobWY, 10);
    const k = f.catch.kind;
    const mult = grade === 'PERFEITA' ? 2 : 1;
    if (k === 'fish') {
      const s = f.spec;
      this.inv[s.item] = (this.inv[s.item] || 0) + mult;
      this.audio.sfx('catch');
      f.resultText = `${s.icon} ${s.name} ×${mult} — fisgada ${grade}!`;
      toast(`${s.icon} ${s.toast} (+${mult})${grade === 'PERFEITA' ? ' PERFEITA!' : ''}`);
    } else if (k === 'boot') {
      this.gold += 4;
      this.audio.sfx('plop');
      f.resultText = '🥾 Bota Velha (+4G de sucata)';
      toast('🥾 Uma Bota Velha... (+4G de sucata)');
    } else if (k === 'algae') {
      this.audio.sfx('plop');
      f.resultText = '🌿 Só algas... técnica boa, lago ruim.';
      toast('...só algas. Pelo menos a técnica foi boa!');
    } else {
      const beach = regionAt(this.player.tileX, this.player.tileY) === 'beach';
      const v = (beach ? 60 : 40) + (grade === 'PERFEITA' ? 20 : grade === 'ÓTIMA' ? 10 : 0);
      this.gold += v;
      this.audio.sfx('levelup');
      f.resultText = `🪙 Pérola vendida! (+${v}G) — fisgada ${grade}`;
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
    this._fishCd = 1.0;
  }

  /** Atalho de teste: conclui a pescaria atual com sucesso imediato. @returns {boolean} */
  _debugCatchFish() {
    if (!this._fishing) return false;
    this._fishReward('BOA');
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
    if (this._isInterior()) return false;
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
    if (this._isInterior()) return false;
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
      label: `${ic(id)}${ITEMS[id].name}<span class="shop-price">${ic('gold', 16)}${ITEMS[id].price}G</span><span class="shop-own">possui ${this.inv[id] || 0}</span>`,
      value: id,
    })).concat([{ label: '« Sair', value: null }]);
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
      [{ name: npc.name, text: `Descansar até amanhã? Cura total por 20G. (Ouro: ${this.gold}G)`, options: [{ label: `${ic('bed')}Descansar — 20G`, value: 'yes' }, { label: 'Agora não', value: null }] }],
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
    if (this._isInterior()) return false;
    if (this.flags.bossDefeated) return false;
    const d = Math.hypot(this.player.cx - (BOSS_ALTAR.x * TILE + 16), this.player.cy - (BOSS_ALTAR.y * TILE + 16));
    if (d > TILE * 2.2) return false;
    this.audio.sfx('encounter');
    this.dialog.say(
      [{ name: 'DRAGÃO DO CAOS', text: 'QUEM OUSA PISAR NO MEU ALTAR? O CRISTAL SERÁ MEU COMBUSTÍVEL! Venha, pequenos heróis... QUEIMEM!', options: [{ label: `${ic('attack')} LUTAR!`, value: 'fight' }, { label: `${ic('flee')} Recuar`, value: null }] }],
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

  /** Sentinela opcional do deserto: o Golem Ancião aguarda na clareira. */
  _tryEliteInteract() {
    if (this._isInterior()) return false;
    if (this.flags.eliteDefeated) return false;
    const d = Math.hypot(this.player.cx - (ELITE.x * TILE + 16), this.player.cy - (ELITE.y * TILE + 16));
    if (d > TILE * 2.2) return false;
    this.audio.sfx('encounter');
    this.dialog.say(
      [{ name: 'GOLEM ANCIÃO', text: '...QUEM... PISA... NA CLAREIRA...? PEDRA... NÃO... PERDOA...! Venha, poeira valente — seja ESMAGADA!', options: [{ label: `${ic('attack')} LUTAR!`, value: 'fight' }, { label: `${ic('flee')} Recuar`, value: null }] }],
      null,
      (v) => { if (v === 'fight') this._startEliteBattle(); }
    );
    return true;
  }

  async _startEliteBattle() {
    if (this._busy) return;
    this._path = null; this._tapAct = null; this._tapMark = null;
    this._busy = true;
    try {
      this.audio.sfx('encounter');
      this.audio.playMusic('boss');
      await Transition.swirl(700);
      this.state = 'BATTLE';
      this.hud.hide();
      this.battle.start(this.party, this.inv, [makeElite()], {
        region: 'desert',
        onEnd: (r) => this._afterBattle({ ...r, elite: true }, 'desert'),
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
      // quest de ervas: conta sapos e cogumelos do pântano
      if (this.flags.herbQuest && !this.flags.herbRewarded && result.kills) {
        const n = result.kills.filter((id) => id === 'toad' || id === 'shroom').length;
        if (n > 0) {
          this.flags.herbCount = (this.flags.herbCount || 0) + n;
          const c = this.flags.herbCount;
          if (c >= HERB_GOAL) {
            this.audio.sfx('levelup');
            toast(`Ervas completas! (${c}/${HERB_GOAL}) Volte à Herbalista Yara!`);
          } else {
            toast(`Ervas: ${c}/${HERB_GOAL} pragas`);
          }
        }
      }
      // mini-chefe do deserto: marca a vitória e paga o tônico extra
      if (result.elite && !this.flags.eliteDefeated) {
        this.flags.eliteDefeated = true;
        this.inv.elixir = (this.inv.elixir || 0) + 1;
        this.audio.sfx('levelup');
        this.dialog.say([
          { name: '', text: '(O Golem Ancião desmorona numa pilha de pedras mansas. Entre os escombros, um frasco dourado...)' },
          { name: 'Golem Ancião', text: '...DESCULPE... OBRIGADO... ...zzz...' },
        ]);
        toast('+1 Elixir! O deserto respira aliviado.');
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
      this.place = { kind: 'world' };
      this.map = this.worldMap;
      this.npcs = this.worldNpcs || NPC_DEFS.map((d) => new NPC(d));
      this.worldNpcs = this.npcs;
      this.player = new Player(SPAWN.x, SPAWN.y);
      for (const h of this.party) { h.hp = Math.ceil(h.maxHp / 2); h.mp = Math.ceil(h.maxMp / 2); }
      this.camera.snap(this.player.cx, this.player.cy, this.map.w * TILE, this.map.h * TILE);
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

    const inHouse = this._isInterior();
    if (!inHouse) {
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

    // golem ancião (sentinela opcional do deserto)
    if (!this.flags.eliteDefeated) {
      const ex = ELITE.x * TILE + ox, ey = ELITE.y * TILE + oy;
      const bob = Math.sin(this.time * 1.4) * 3;
      // anel de runas no chão
      const pulse = 0.5 + 0.3 * Math.sin(this.time * 2.2);
      g.strokeStyle = `rgba(255,215,94,${pulse.toFixed(2)})`; g.lineWidth = 2;
      g.beginPath(); g.ellipse(ex + 16, ey + 26, 22 + pulse * 4, 9 + pulse * 2, 0, 0, 7); g.stroke();
      g.drawImage(this.ancientArt, ex + 16 - 55, ey - 62 + bob, 110, 100);
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
    } else {
      // dentro de casa: tapete de saída + brilho na porta
      const ex = INTERIOR_DOOR.x * TILE + ox + 16, ey = INTERIOR_DOOR.y * TILE + oy;
      const tw = 0.5 + 0.4 * Math.sin(this.time * 4);
      g.fillStyle = `rgba(255,215,94,${(0.25 + tw * 0.25).toFixed(2)})`;
      g.beginPath(); g.ellipse(ex, ey + 10, 16, 6, 0, 0, 7); g.fill();
    }

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
      const seed = (n.x * 0.07 + n.y * 0.13) % 6.28;
      ents.push({ y: n.y, draw: () => this._drawActor(n.x + ox, n.y + oy, this.npcArt[n.kind] || this.npcArt.elder, n.dir, n.moving ? n.animT : 0, sc, seed) });
    }
    ents.push({ y: p.y, draw: () => this._drawActor(p.x + ox - 4, p.y + oy - 12, this.heroArt, p.dir, p.moving ? p.animT : 0, 1, 0.7) });
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
      const vg = g.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 320, VIEW_W / 2, VIEW_H / 2, 830);
      vg.addColorStop(0, 'transparent');
      vg.addColorStop(1, `rgba(2,3,12,${(0.30 + 0.04 * Math.sin(this.time * 0.8)).toFixed(2)})`);
      g.fillStyle = vg;
      g.fillRect(0, 0, VIEW_W, VIEW_H);
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
    // porta de casa à frente (mundo) ou porta de saída (interior)
    let housePrompt = null, exitPrompt = false;
    if (this.state === 'FIELD' && !this.dialog.active && !this.menu.active) {
      if (this._isInterior()) {
        const ft0 = this.player.facingTile();
        if ((ft0.x === INTERIOR_DOOR.x && ft0.y === INTERIOR_DOOR.y) ||
            (this.player.tileX === INTERIOR_DOOR.x && this.player.tileY === INTERIOR_DOOR.y)) exitPrompt = true;
      } else if (!npc) {
        const ft0 = this.player.facingTile();
        housePrompt = this._houseAt(ft0.x, ft0.y) || this._houseAt(this.player.tileX, this.player.tileY);
      }
    }
    if (exitPrompt) {
      g.fillStyle = '#ffd75e';
      g.font = 'bold 20px monospace';
      g.strokeStyle = '#000'; g.lineWidth = 4;
      const ex = INTERIOR_DOOR.x * TILE + ox + 16, ey = INTERIOR_DOOR.y * TILE + oy - 26 + Math.sin(this.time * 5) * 2;
      g.textAlign = 'center';
      g.strokeText('🚪 E Sair', ex, ey);
      g.fillText('🚪 E Sair', ex, ey);
      g.textAlign = 'start';
    } else if (housePrompt) {
      g.fillStyle = '#7fd4ff';
      g.font = 'bold 20px monospace';
      g.strokeStyle = '#000'; g.lineWidth = 4;
      const hx = housePrompt.door.x * TILE + ox + 16, hy = housePrompt.door.y * TILE + oy - 26 + Math.sin(this.time * 5) * 2;
      g.textAlign = 'center';
      g.strokeText(`🏠 E ${housePrompt.name}`, hx, hy);
      g.fillText(`🏠 E ${housePrompt.name}`, hx, hy);
      g.textAlign = 'start';
    }
    // balão "▼ E" sobre o baú próximo (só se não há NPC na frente — mesma prioridade do E)
    const chest = !npc && !housePrompt && !inHouse ? this._nearChest() : null;
    if (chest && this.state === 'FIELD' && !this.dialog.active) {
      g.fillStyle = '#ffd75e';
      g.font = 'bold 20px monospace';
      g.strokeStyle = '#000'; g.lineWidth = 4;
      const cx = chest.x * TILE + ox + 16, cy = chest.y * TILE + oy - 26 + Math.sin(this.time * 5) * 2;
      g.strokeText('▼ E', cx - 14, cy);
      g.fillText('▼ E', cx - 14, cy);
    }
    // balão "!" dourado sobre quem tem quest pendente (Pip, Yara, Tumba)
    const questNpcs = [];
    if (this.flags.toyQuest && !this.flags.toyRewarded) questNpcs.push('kid');
    if (this.flags.herbQuest && !this.flags.herbRewarded && (this.flags.herbCount || 0) >= HERB_GOAL) questNpcs.push('herbalist');
    if (this.flags.pearlQuest && !this.flags.pearlRewarded && (this.inv.royal || 0) >= 1) questNpcs.push('sailor');
    for (const qid of questNpcs) {
      const qn = this.npcs.find((n) => n.id === qid);
      if (!qn || qn === npc || this.state !== 'FIELD' || this.dialog.active) continue;
      g.fillStyle = '#ffd75e';
      g.font = 'bold 22px monospace';
      g.strokeStyle = '#000'; g.lineWidth = 4;
      const qx = qn.x + ox + 8, qy = qn.y + oy - 24 + Math.sin(this.time * 5) * 3;
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
    // dica de pesca: "🎣 E" pulsante sobre a água encarada (só fora da pescaria e fora de casa)
    if (!this._fishing && !npc && !chest && !housePrompt && !inHouse && this.state === 'FIELD' && !this.dialog.active && !this.menu.active) {
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

  /** Peixe da espécie (corpo, cauda, escamas, olho) p/ bóia fisgada e troféu. */
  _drawFishSpec(g, x, y, s, sc = 1, flop = 0, flip = 1) {
    g.save();
    g.translate(x, y);
    g.scale(flip * sc, sc);
    if (flop) g.rotate(Math.sin(flop) * 0.35);
    // cauda (bate p/ os lados)
    const wag = Math.sin(flop * 2.2 || this.time * 10) * 4;
    g.fillStyle = s.color;
    g.beginPath();
    g.moveTo(-11, 0); g.lineTo(-19, -6 + wag); g.lineTo(-19, 6 + wag);
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1;
    g.stroke();
    // corpo + barriga
    g.fillStyle = s.color;
    g.beginPath(); g.ellipse(0, 0, 12, 6, 0, 0, 7); g.fill();
    g.fillStyle = s.belly;
    g.beginPath(); g.ellipse(1, 2.5, 9, 3, 0, 0, 7); g.fill();
    // listra do Real / brilho do Lendário
    if (s.id === 'royal') {
      g.fillStyle = '#cfe0ff';
      g.beginPath(); g.ellipse(-1, -1.5, 8, 2, 0, 0, 7); g.fill();
    }
    // escamas
    g.fillStyle = 'rgba(255,255,255,.5)';
    for (const [ex, ey] of [[-4, -1], [0, -2], [4, -1], [-2, 1], [2, 2]]) {
      g.beginPath(); g.arc(ex, ey, 1.1, 0, 7); g.fill();
    }
    // dorsal + barbatana
    g.fillStyle = s.color;
    g.beginPath(); g.moveTo(-3, -6); g.lineTo(2, -11); g.lineTo(6, -6); g.closePath(); g.fill();
    // guelra + olho
    g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1;
    g.beginPath(); g.arc(4, 0, 3.4, -1.1, 1.1); g.stroke();
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(7, -1.5, 2.2, 0, 7); g.fill();
    g.fillStyle = '#101018';
    g.beginPath(); g.arc(7.7, -1.5, 1.1, 0, 7); g.fill();
    // boca
    g.strokeStyle = '#101018'; g.lineWidth = 1;
    g.beginPath(); g.arc(10.5, 1, 2, 0.3, 2.6); g.stroke();
    // coroa do Real / aura do Lendário
    if (s.id === 'royal' || s.id === 'goldfish') {
      g.fillStyle = '#ffd75e';
      for (let i = -1; i <= 1; i++) {
        g.beginPath();
        g.moveTo(2 + i * 3 - 1.4, -9); g.lineTo(2 + i * 3, -12.5); g.lineTo(2 + i * 3 + 1.4, -9);
        g.closePath(); g.fill();
      }
    }
    if (s.id === 'goldfish') {
      const tw = 0.5 + 0.5 * Math.sin(this.time * 6);
      g.fillStyle = `rgba(255,233,150,${(0.5 + tw * 0.5).toFixed(2)})`;
      g.fillRect(-13, -13, 2, 2); g.fillRect(11, -12, 2, 2); g.fillRect(12, 8, 2, 2);
    }
    g.restore();
  }

  /** Pescador equipado: chapéu de palha, caixa de apetrechos, mãos na vara. */
  _drawFisherGear(g, hx, hy, lean) {
    // caixa de apetrechos aos pés (vermelha, com trava dourada + alça)
    const bx = hx - 20 + lean * 4, by = hy + 34;
    g.fillStyle = 'rgba(0,0,10,.25)';
    g.beginPath(); g.ellipse(bx, by + 9, 11, 3, 0, 0, 7); g.fill();
    g.fillStyle = '#8c2f2f'; g.fillRect(bx - 9, by - 2, 18, 11);
    g.fillStyle = '#c23b3b'; g.fillRect(bx - 9, by - 2, 18, 4);
    g.fillStyle = '#ffd75e'; g.fillRect(bx - 2, by + 1, 4, 4);
    g.fillStyle = '#4a2f14'; g.fillRect(bx - 6, by - 6, 12, 3);
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(bx - 8, by - 1, 16, 1.5);
    // balde com água + rabo de peixe p/ fora (charme de pescador)
    const kx = hx + 20 + lean * 4, ky = hy + 34;
    g.fillStyle = 'rgba(0,0,10,.25)';
    g.beginPath(); g.ellipse(kx, ky + 8, 9, 2.6, 0, 0, 7); g.fill();
    g.fillStyle = '#5a6e8c';
    g.beginPath();
    g.moveTo(kx - 7, ky - 4); g.lineTo(kx + 7, ky - 4); g.lineTo(kx + 5, ky + 8); g.lineTo(kx - 5, ky + 8);
    g.closePath(); g.fill();
    g.fillStyle = '#7fa3c9';
    g.beginPath();
    g.moveTo(kx - 7, ky - 4); g.lineTo(kx + 7, ky - 4); g.lineTo(kx + 6, ky - 1); g.lineTo(kx - 6, ky - 1);
    g.closePath(); g.fill();
    g.fillStyle = '#4fa8e0';
    g.beginPath(); g.moveTo(kx + 1, ky - 8); g.lineTo(kx + 7, ky - 12); g.lineTo(kx + 7, ky - 4); g.closePath(); g.fill();
    // chapéu de palha (aba + copa + fita) inclinado p/ a água
    g.save();
    g.translate(hx + lean * 3, hy - 12);
    g.rotate(lean * 0.06);
    g.fillStyle = 'rgba(0,0,10,.2)';
    g.beginPath(); g.ellipse(1.5, 3.5, 13, 3.4, 0, 0, 7); g.fill();
    g.fillStyle = '#d9b878';
    g.beginPath(); g.ellipse(0, 0, 13, 4.4, 0, 0, 7); g.fill();
    g.fillStyle = '#c2a05e';
    g.beginPath(); g.ellipse(0, -3.4, 7, 4.6, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#e8cf92';
    g.beginPath(); g.ellipse(-2, -4.5, 3.4, 2.2, -0.4, Math.PI, 0); g.fill();
    g.fillStyle = '#c23b3b';
    g.fillRect(-7, -3.4, 14, 2.6);
    g.fillStyle = '#8c2f2f';
    g.fillRect(4, -3.4, 3, 2.6);
    // isca pendurada na aba (pena branca + miçanga)
    const sw = Math.sin(this.time * 5) * 1.5;
    g.strokeStyle = '#e8ecff'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(10, 1); g.lineTo(11 + sw, 7); g.stroke();
    g.fillStyle = '#ffd75e'; g.fillRect(10.4 + sw, 7, 2, 2);
    g.restore();
  }

  /** Vara detalhada: blank cônico em curva, passadores, molinete com manivela. */
  _drawRod(g, bx, by, tipX, tipY, bend, reeling) {
    // curva da vara (entorta p/ baixo quando o peixe puxa)
    const mx = (bx + tipX) / 2, my = (by + tipY) / 2 + bend * 26;
    const at = (t) => {
      const u = 1 - t;
      return { x: u * u * bx + 2 * u * t * mx + t * t * tipX, y: u * u * by + 2 * u * t * my + t * t * tipY };
    };
    const N = 16;
    const pts = [];
    for (let i = 0; i <= N; i++) pts.push(at(i / N));
    // contorno escuro + segmentos cônicos de bambu
    const segCols = ['#5e3a17', '#7a4e22', '#a8763e', '#c98d4e', '#e8b878'];
    g.lineCap = 'round';
    for (let i = 0; i < N; i++) {
      const w = 5.5 - (i / N) * 4;
      g.strokeStyle = '#101018'; g.lineWidth = w + 1.6;
      g.beginPath(); g.moveTo(pts[i].x, pts[i].y); g.lineTo(pts[i + 1].x, pts[i + 1].y); g.stroke();
    }
    for (let i = 0; i < N; i++) {
      const w = 4.6 - (i / N) * 3.4;
      g.strokeStyle = segCols[Math.min(segCols.length - 1, (i / N * segCols.length) | 0)];
      g.lineWidth = w;
      g.beginPath(); g.moveTo(pts[i].x, pts[i].y); g.lineTo(pts[i + 1].x, pts[i + 1].y); g.stroke();
    }
    // enrolamento dos passadores
    g.strokeStyle = '#3a2412'; g.lineWidth = 2.5;
    for (const t of [0.3, 0.52, 0.74]) {
      const q = at(t);
      g.beginPath(); g.moveTo(q.x - 2, q.y - 1); g.lineTo(q.x + 2, q.y + 1); g.stroke();
    }
    // passadores (anéis) por onde a linha corre
    for (const t of [0.42, 0.64, 0.86]) {
      const q = at(t);
      g.fillStyle = '#101018';
      g.beginPath(); g.arc(q.x, q.y + 2.5, 2.2, 0, 7); g.fill();
      g.fillStyle = '#9fb2ff';
      g.beginPath(); g.arc(q.x, q.y + 2.5, 1.1, 0, 7); g.fill();
    }
    // ponteira laranja (visibilidade)
    const tip = pts[N];
    g.fillStyle = '#e8763a';
    g.fillRect(tip.x - 1.5, tip.y - 1.5, 3.5, 3.5);
    g.fillStyle = '#ffd75e';
    g.fillRect(tip.x - 1, tip.y - 1, 1.6, 1.6);
    // cabo de cortiça + butt
    const b0 = at(0), b1 = at(0.12);
    g.strokeStyle = '#3a2412'; g.lineWidth = 7;
    g.beginPath(); g.moveTo(b0.x, b0.y); g.lineTo(b1.x, b1.y); g.stroke();
    g.strokeStyle = '#d9b878'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(b0.x, b0.y); g.lineTo(b1.x, b1.y); g.stroke();
    g.strokeStyle = '#8a5a2b'; g.lineWidth = 5;
    for (const t of [0.03, 0.07, 0.11]) {
      const q = at(t);
      g.beginPath(); g.moveTo(q.x - 2, q.y - 2); g.lineTo(q.x + 2, q.y + 2); g.stroke();
    }
    // molinete: corpo + bobina + manivela girando ao recolher
    const rm = at(0.16);
    const rdx = tipX - bx, rdy = tipY - by;
    const rl = Math.max(1, Math.hypot(rdx, rdy));
    const pxn = -rdy / rl, pyn = rdx / rl; // perpendicular (lado de baixo)
    const side = pyn >= 0 ? 1 : -1;
    const rx = rm.x + pxn * 7 * side, ry = rm.y + pyn * 7 * side;
    g.fillStyle = '#101018';
    g.fillRect(rm.x - 1, rm.y - 1, rx - rm.x + 2, ry - rm.y + 2); // haste
    g.fillStyle = '#c0c6d0';
    g.beginPath(); g.arc(rx, ry, 4.6, 0, 7); g.fill();
    g.fillStyle = '#5a6270';
    g.beginPath(); g.arc(rx, ry, 2.6, 0, 7); g.fill();
    g.fillStyle = '#e8ecff';
    g.beginPath(); g.arc(rx - 1, ry - 1, 1.2, 0, 7); g.fill();
    // manivela (gira no mini-game)
    const f = this._fishing;
    const ang = (f ? f.reelAngle : this.time * 2) * (reeling ? 1 : 0.15);
    const hx = rx + Math.cos(ang) * 5.5, hy = ry + Math.sin(ang) * 5.5;
    g.strokeStyle = '#e8ecff'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(rx, ry); g.lineTo(hx, hy); g.stroke();
    g.fillStyle = '#8a5a2b';
    g.beginPath(); g.arc(hx, hy, 1.8, 0, 7); g.fill();
    return { tip, guides: [0.42, 0.64, 0.86].map(at) };
  }

  /** Desenha vara na mão do jogador + linha até a bóia + bóia e mordida. */
  _drawFishing(g, ox, oy) {
    const f = this._fishing;
    if (!f) return;
    const p = this.player;
    const hx = p.x + ox + 12, hy = p.y + oy - 4; // cabeça
    const aim = { x: f.bobWX + ox, y: f.bobWY + oy };
    const dx = aim.x - hx, dy = aim.y - hy;
    const len = Math.max(1, Math.hypot(dx, dy));
    const nx = dx / len, ny = dy / len;
    const lean = Math.max(-1, Math.min(1, nx)); // inclina p/ a água
    // apetrechos (atrás da vara, na frente do sprite já desenhado)
    this._drawFisherGear(g, hx, hy, lean);
    // mãos: luva da túnica + punho na empunhadura
    const bx = hx + nx * 6, by = hy + 14;
    const bx2 = bx + nx * 12, by2 = by + ny * 6 - 4;
    // vara longa em direção à água (entorta no mini-game / se debate)
    const bend = f.phase === 'reel' ? 0.35 + (f.struggle > 0 ? 0.5 : 0) + Math.min(0.3, f.reelT * 0.02)
      : f.phase === 'bite' ? 0.3 : f.phase === 'caught' ? -0.25 : 0.08;
    const castK = f.phase === 'cast' ? Math.min(1, f.t / 0.45) : 1;
    const fullTx = bx + nx * 62, fullTy = by + ny * 40 - 22;
    const tipTX = bx + (fullTx - bx) * castK, tipTY = by + (fullTy - by) * castK;
    const { tip } = this._drawRod(g, bx, by, tipTX, tipTY, bend, f.phase === 'reel');
    // braços estendidos até o cabo
    g.strokeStyle = '#2b6fd6'; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(hx - 4, hy + 12); g.lineTo(bx, by); g.stroke();
    g.beginPath(); g.moveTo(hx + 4, hy + 13); g.lineTo(bx2, by2); g.stroke();
    g.fillStyle = '#f2c89b';
    g.beginPath(); g.arc(bx, by, 3, 0, 7); g.fill();
    g.beginPath(); g.arc(bx2, by2, 3, 0, 7); g.fill();
    g.strokeStyle = '#101018'; g.lineWidth = 1;
    g.beginPath(); g.arc(bx, by, 3, 0, 7); g.stroke();
    g.beginPath(); g.arc(bx2, by2, 3, 0, 7); g.stroke();
    if (castK < 1) {
      // chumbada voando p/ a água durante o arremesso
      const t = castK;
      const lx = bx + (f.bobWX + ox - bx) * t, ly = by + (f.bobWY + oy - by) * t - Math.sin(t * Math.PI) * 26;
      g.fillStyle = '#c0c6d0';
      g.fillRect(lx - 1.5, ly - 1.5, 3, 3);
      return;
    }
    // linha: da ponteira até a bóia (tensão muda a cor e a barriga)
    const bobX = f.bobWX + ox, bobY = f.bobWY + oy + Math.sin(this.time * 3.2) * 2;
    const struggling = f.phase === 'reel' && f.struggle > 0;
    const slack = f.phase === 'miss' ? 22 : struggling ? 1.5 : f.phase === 'bite' ? 3 : 8;
    const midX = (tip.x + bobX) / 2, midY = (tip.y + bobY) / 2 + slack;
    g.strokeStyle = struggling ? 'rgba(255,120,80,.95)' : f.phase === 'bite' ? 'rgba(255,215,94,.95)' : f.phase === 'miss' ? 'rgba(160,170,190,.5)' : 'rgba(240,244,255,.9)';
    g.lineWidth = struggling ? 2 : 1.5;
    g.beginPath(); g.moveTo(tip.x, tip.y);
    g.quadraticCurveTo(midX, midY, bobX, bobY - 6);
    g.stroke();
    // ticks de tensão quando o peixe se debate
    if (struggling) {
      g.strokeStyle = 'rgba(255,120,80,.8)'; g.lineWidth = 1.5;
      for (const t of [0.3, 0.55, 0.8]) {
        const u = 1 - t;
        const qx = u * u * tip.x + 2 * u * t * midX + t * t * bobX;
        const qy = u * u * tip.y + 2 * u * t * midY + t * t * (bobY - 6);
        const o = Math.sin(this.time * 30 + t * 9) * 3;
        g.beginPath(); g.moveTo(qx - 3, qy + o); g.lineTo(qx + 3, qy - o); g.stroke();
      }
    }
    // sombra de profundidade + ondulação ao redor da bóia
    g.fillStyle = 'rgba(6,20,40,.35)';
    g.beginPath(); g.ellipse(bobX, bobY + 4, 11, 4.5, 0, 0, 7); g.fill();
    const rip = 0.5 + 0.5 * Math.sin(this.time * 4);
    g.strokeStyle = `rgba(180,230,255,${(0.35 + rip * 0.3).toFixed(2)})`;
    g.lineWidth = 2;
    g.beginPath(); g.ellipse(bobX, bobY + 3, 11 + rip * 5, 4 + rip * 2, 0, 0, 7); g.stroke();
    g.strokeStyle = `rgba(180,230,255,${(0.18 + rip * 0.15).toFixed(2)})`;
    g.beginPath(); g.ellipse(bobX, bobY + 3, 18 + rip * 6, 7 + rip * 2.5, 0, 0, 7); g.stroke();
    // bóia detalhada: sombra, corpo listrado, brilho, antena com luz
    const tug = f.phase === 'bite' ? Math.sin(this.time * 30) * 2.5 : struggling ? Math.sin(this.time * 24) * 2 : 0;
    g.fillStyle = 'rgba(0,0,10,.25)';
    g.beginPath(); g.ellipse(bobX, bobY + 7, 6, 2.2, 0, 0, 7); g.fill();
    g.fillStyle = '#f2f4ff';
    g.beginPath(); g.arc(bobX, bobY + tug, 6, Math.PI * 1.02, Math.PI * 1.98); g.fill();
    g.fillStyle = '#d63b3b';
    g.beginPath(); g.arc(bobX, bobY + tug, 6, 0, Math.PI); g.fill();
    g.fillStyle = '#8e1f2b';
    g.fillRect(bobX - 6, bobY + tug - 1, 12, 2);
    g.fillStyle = '#101018';
    g.fillRect(bobX - 6, bobY + tug - 2.4, 12, 1.6);
    g.fillStyle = 'rgba(255,255,255,.85)';
    g.beginPath(); g.arc(bobX - 2, bobY + tug - 3, 1.6, 0, 7); g.fill();
    g.fillStyle = '#101018';
    g.fillRect(bobX - 1.2, bobY - 13 + tug, 2.4, 6);
    const blinkT = f.phase === 'bite' ? (Math.sin(this.time * 20) > 0 ? 1 : 0.3) : 0.65 + 0.35 * Math.sin(this.time * 3);
    g.fillStyle = `rgba(255,215,94,${blinkT.toFixed(2)})`;
    g.fillRect(bobX - 1.6, bobY - 15 + tug, 3.2, 3.2);
    g.fillStyle = '#fff';
    g.fillRect(bobX - 1, bobY - 14.4 + tug, 1.2, 1.2);
    // vulto do peixe rondando a bóia na espera (sombra na água = dica!)
    if (f.phase === 'wait') {
      const ang = this.time * 0.9;
      const sx = bobX + Math.cos(ang) * 16, sy = bobY + 5 + Math.sin(ang * 1.4) * 4;
      const sh = f.spec.size === 'G' ? 1.25 : f.spec.size === 'M' ? 0.95 : 0.7;
      g.fillStyle = 'rgba(6,20,40,.4)';
      g.beginPath(); g.ellipse(sx, sy, 9 * sh, 3.4 * sh, Math.sin(ang) * 0.4, 0, 7); g.fill();
    }
    // "!" da mordida + aro de tempo
    if (f.phase === 'bite') {
      const k = Math.max(0, f.biteLeft / f.spec.bite);
      const jx = bobX, jy = bobY - 34 + Math.sin(this.time * 12) * 2;
      g.font = 'bold 32px monospace'; g.textAlign = 'center';
      g.strokeStyle = '#000'; g.lineWidth = 5;
      const scale = 1 + 0.12 * Math.sin(this.time * 14);
      g.save(); g.translate(jx, jy); g.scale(scale, scale);
      g.strokeText('!', 0, 0); g.fillStyle = '#ffd75e'; g.fillText('!', 0, 0);
      g.restore();
      g.strokeStyle = `rgba(255,215,94,${(0.4 + 0.6 * k).toFixed(2)})`;
      g.lineWidth = 3;
      g.beginPath(); g.arc(bobX, bobY, 9 + (1 - k) * 18, 0, 7); g.stroke();
      g.textAlign = 'start';
      g.font = 'bold 15px monospace';
      g.strokeText('E!', bobX + 13, bobY - 15);
      g.fillStyle = '#fff'; g.fillText('E!', bobX + 13, bobY - 15);
    } else if (f.phase === 'reel') {
      if (struggling) {
        g.font = 'bold 14px monospace'; g.textAlign = 'center';
        g.strokeStyle = '#000'; g.lineWidth = 3;
        const wob = Math.sin(this.time * 18) * 2;
        g.strokeText('⚠ SE DEBATE!', bobX + wob, bobY - 20);
        g.fillStyle = '#ff8a6b'; g.fillText('⚠ SE DEBATE!', bobX + wob, bobY - 20);
        g.textAlign = 'start';
      }
    } else if (f.phase === 'caught' && f.catch.kind === 'fish') {
      // troféu erguido sobre a cabeça, se debatendo + faíscas
      const sc = f.spec.size === 'G' ? 1.35 : f.spec.size === 'M' ? 1.05 : 0.8;
      const fy = hy - 34 + Math.sin(this.time * 9) * 2;
      this._drawFishSpec(g, hx, fy, f.spec, sc, this.time * 7, lean >= 0 ? 1 : -1);
      g.fillStyle = `rgba(255,240,170,${(0.5 + 0.5 * Math.sin(this.time * 8)).toFixed(2)})`;
      for (const [ox2, oy2] of [[-14, -8], [13, -6], [-9, 8], [11, 9]]) {
        g.fillRect(hx + ox2, fy + oy2, 2.4, 2.4);
      }
      g.font = 'bold 15px monospace'; g.textAlign = 'center';
      g.strokeStyle = '#000'; g.lineWidth = 4;
      g.strokeText(`FISGADA ${f.grade}!`, hx, fy - 20);
      g.fillStyle = '#ffd75e'; g.fillText(`FISGADA ${f.grade}!`, hx, fy - 20);
      g.textAlign = 'start';
    } else if (f.phase === 'wait' || f.phase === 'cast') {
      g.font = 'bold 13px monospace'; g.textAlign = 'center';
      g.strokeStyle = '#000'; g.lineWidth = 3;
      g.strokeText('...aguardando o peixe (Q sai)', bobX, bobY - 20);
      g.fillStyle = '#cfe0ff'; g.fillText('...aguardando o peixe (Q sai)', bobX, bobY - 20);
      g.textAlign = 'start';
    }
  }

  /** Painel do mini-game: sombra/estrelas do peixe, cursor preciso, veredito ao vivo. */
  _drawFishGame(g) {
    const f = this._fishing;
    if (!f || (f.phase !== 'reel' && f.phase !== 'caught' && f.phase !== 'miss')) return;
    const W = 640, H = f.phase === 'reel' ? 148 : 92;
    const x = (VIEW_W - W) / 2, y = VIEW_H - H - 100;
    // caixa
    g.fillStyle = 'rgba(6,9,20,.93)';
    g.strokeStyle = '#cdd6ff'; g.lineWidth = 2;
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, W, H, 10); else g.rect(x, y, W, H);
    g.fill(); g.stroke();
    g.fillStyle = 'rgba(27,47,158,.5)';
    g.fillRect(x + 4, y + 4, W - 8, 22);
    g.textAlign = 'center';
    if (f.phase === 'reel') {
      // ficha do peixe misterioso: sombra + dificuldade + velocidade
      const stars = '★'.repeat(f.spec.stars) + '☆'.repeat(5 - f.spec.stars);
      const velBars = f.spec.speed < 0.65 ? '▰▱▱' : f.spec.speed < 0.9 ? '▰▰▱' : '▰▰▰';
      g.font = 'bold 14px monospace';
      g.fillStyle = '#ffd75e';
      g.fillText(`❓ PEIXE MISTERIOSO · sombra ${f.spec.size} · ${stars}`, VIEW_W / 2, y + 19);
      g.font = '11px monospace'; g.fillStyle = '#9fb2ff';
      g.fillText(`velocidade ${velBars} · sombra G = raro e veloz · Q solta`, VIEW_W / 2, y + 36);
      const bx = x + 24, bw = W - 48, by = y + 56, bh = 24;
      // trilho com gradiente + cantos
      const rail = g.createLinearGradient(bx, 0, bx + bw, 0);
      rail.addColorStop(0, '#0a1030'); rail.addColorStop(0.5, '#16236b'); rail.addColorStop(1, '#0a1030');
      g.fillStyle = rail;
      g.fillRect(bx, by, bw, bh);
      g.strokeStyle = '#ffffff55'; g.lineWidth = 1;
      g.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
      // zona verde (gradiente) + núcleo dourado + centro
      const zx = bx + f.zoneX * bw, zw = f.zoneW * bw;
      const zg = g.createLinearGradient(0, by, 0, by + bh);
      zg.addColorStop(0, '#2bd97b'); zg.addColorStop(0.5, '#1f9d55'); zg.addColorStop(1, '#157a40');
      g.fillStyle = zg;
      g.fillRect(zx, by + 2, zw, bh - 4);
      g.strokeStyle = 'rgba(220,255,230,.7)'; g.lineWidth = 1;
      g.strokeRect(zx + 0.5, by + 2.5, zw - 1, bh - 5);
      const px = bx + (f.zoneX + f.zoneW / 2 - f.perfectW / 2) * bw, pw = f.perfectW * bw;
      g.fillStyle = 'rgba(255,215,94,.95)';
      g.fillRect(px, by + 2, pw, bh - 4);
      g.fillStyle = '#fff';
      g.fillRect(px + pw / 2 - 0.75, by + 2, 1.5, bh - 4);
      // ticks finos de precisão
      g.fillStyle = 'rgba(255,255,255,.22)';
      for (let i = 1; i < 20; i++) {
        if (i % 5 === 0) continue;
        g.fillRect(bx + (i / 20) * bw, by + bh - 6, 1, 4);
      }
      g.fillStyle = 'rgba(255,255,255,.4)';
      for (const m of [0.25, 0.5, 0.75]) g.fillRect(bx + m * bw, by + 2, 1, 4);
      // rastro do cursor (precisão legível)
      for (let i = 0; i < f.trail.length; i++) {
        const a = (i + 1) / f.trail.length;
        g.fillStyle = `rgba(160,190,255,${(a * 0.35).toFixed(2)})`;
        g.fillRect(bx + f.trail[i] * bw - 1.5, by - 2, 3, bh + 4);
      }
      // cursor
      const cx = bx + f.cursor * bw;
      const inPerfect = Math.abs(f.cursor - (f.zoneX + f.zoneW / 2)) <= f.perfectW / 2;
      if (inPerfect) {
        g.fillStyle = 'rgba(255,215,94,.35)';
        g.fillRect(cx - 7, by - 6, 14, bh + 12);
      }
      const blink = 0.75 + 0.25 * Math.sin(this.time * 10);
      g.fillStyle = `rgba(255,255,255,${blink.toFixed(2)})`;
      g.fillRect(cx - 2.5, by - 7, 5, bh + 14);
      g.fillStyle = '#ff6b6b';
      g.fillRect(cx - 2.5, by - 7, 5, 5);
      g.fillRect(cx - 2.5, by + bh + 2, 5, 5);
      g.fillStyle = '#101018';
      g.fillRect(cx - 0.75, by - 7, 1.5, 5);
      g.fillRect(cx - 0.75, by + bh + 2, 1.5, 5);
      // veredito ao vivo + alerta de arranque
      const v = this._fishVerdict();
      g.font = 'bold 15px monospace';
      g.strokeStyle = '#000'; g.lineWidth = 3;
      const vy = by + bh + 22;
      g.strokeText(v.txt, VIEW_W / 2, vy);
      g.fillStyle = v.col; g.fillText(v.txt, VIEW_W / 2, vy);
      if (f.struggle > 0) {
        g.font = 'bold 12px monospace';
        const flash = Math.sin(this.time * 16) > 0 ? '#ff8a6b' : '#ffd75e';
        g.strokeText('⚠ ARRANQUE! segure o ritmo...', VIEW_W / 2, vy + 15);
        g.fillStyle = flash; g.fillText('⚠ ARRANQUE! segure o ritmo...', VIEW_W / 2, vy + 15);
      } else {
        g.font = '11px monospace'; g.fillStyle = '#9fb2ff';
        g.fillText('E = fisgar · dourado = PERFEITA (×2)', VIEW_W / 2, vy + 15);
      }
    } else if (f.phase === 'caught') {
      g.font = 'bold 15px monospace';
      g.fillStyle = '#37e08b';
      g.fillText(f.catch.kind === 'fish' ? `${f.spec.icon} ${f.spec.name} — FISGADA ${f.grade}!` : '🎣 BOA!', VIEW_W / 2, y + 19);
      g.font = '13px monospace'; g.fillStyle = '#f2f4ff';
      g.fillText(f.resultText || '', VIEW_W / 2, y + 44);
      g.font = '11px monospace'; g.fillStyle = '#9fb2ff';
      g.fillText('E continua pescando · Q recolhe', VIEW_W / 2, y + 64);
    } else {
      g.font = 'bold 14px monospace';
      g.fillStyle = '#ff6b6b';
      g.fillText('🎣 Escapou...', VIEW_W / 2, y + 19);
      g.font = '12px monospace'; g.fillStyle = '#f2f4ff';
      g.fillText(f.missMsg || '', VIEW_W / 2, y + 42);
      g.font = '11px monospace'; g.fillStyle = '#9fb2ff';
      g.fillText('E tenta de novo · Q recolhe', VIEW_W / 2, y + 62);
    }
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
        const col = q.col || '210,200,180';
        const r0 = q.big ? 3 : 2, gr = q.big ? 8 : 5;
        g.fillStyle = `rgba(${col},${(0.42 * (1 - k)).toFixed(2)})`;
        g.beginPath(); g.arc(q.x, q.y, r0 + k * gr, 0, 7); g.fill();
        // miolo claro = volume
        g.fillStyle = `rgba(255,250,235,${(0.25 * (1 - k)).toFixed(2)})`;
        g.beginPath(); g.arc(q.x - 1, q.y - 1, (r0 + k * gr) * 0.45, 0, 7); g.fill();
      } else if (q.type === 'stepdust') {
        const k = Math.min(1, q.t / q.life);
        g.fillStyle = `rgba(${q.col || '210,200,180'},${(0.3 * (1 - k)).toFixed(2)})`;
        g.fillRect(q.x, q.y, 2, 2);
      } else if (q.type === 'smoke') {
        const k = Math.min(1, q.t / q.life);
        const r = 3 + k * 9;
        g.fillStyle = `rgba(120,120,132,${(0.34 * (1 - k)).toFixed(2)})`;
        g.beginPath(); g.arc(q.x, q.y, r, 0, 7); g.fill();
        g.fillStyle = `rgba(205,205,215,${(0.22 * (1 - k)).toFixed(2)})`;
        g.beginPath(); g.arc(q.x - r * 0.25, q.y - r * 0.25, r * 0.5, 0, 7); g.fill();
      } else if (q.type === 'ghost') {
        const k = Math.min(1, q.t / q.life);
        g.save();
        g.globalAlpha = 0.3 * (1 - k);
        g.drawImage(q.img, q.x, q.y, q.w, q.h);
        g.restore();
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

  /** Cor da poeira conforme o terreno pisado (rastro com leitura do chão). @returns {string} "r,g,b" */
  _trailTint() {
    const t = this.map.tile(this.player.tileX, this.player.tileY);
    if (t === T.SNOW) return '245,248,255';
    if (t === T.SAND || t === T.DUNE || t === T.PATH || t === T.SOIL) return '216,190,140';
    if (t === T.BRIDGE || t === T.FLOOR) return '175,145,105';
    if (t === T.SWAMP || t === T.DARK_GRASS) return '125,165,110';
    if (t === T.TALL_GRASS) return '140,190,120';
    return '210,200,180';
  }

  /** Ponto de emissão ATRÁS do ator (nunca em cima do sprite): centro - direção*26. */
  _behind(cx, cy, dir, jitter = 4) {
    const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir] || [0, 1];
    // jitter lateral (perpendicular) + pequeno ao longo do eixo (sem invadir o sprite)
    const jx = (Math.random() - 0.5) * jitter * 2;
    const jz = (Math.random() - 0.5) * 6;
    return {
      x: cx - d[0] * (26 + jz) + -d[1] * jx,
      y: cy - d[1] * (26 + jz) + d[0] * jx,
      dx: d[0], dy: d[1],
    };
  }

  /** Rastros do jogador: corrida solta poeira + fumaça + afterimage; caminhada, poeira leve. */
  _emitTrail(dt) {
    // centro do sprite (não da caixa de colisão) + offset da câmera
    const sx = this.player.cx + this.camera.ox;
    const sy = this.player.cy + this.camera.oy - 2;
    const tint = this._trailTint();
    if (this.player.running) {
      // poeira grossa chutada para trás
      this._poofT = (this._poofT || 0) + dt;
      if (this._poofT > 0.09 && this._wx.length < 110) {
        this._poofT = 0;
        const b = this._behind(sx, sy, this.player.dir);
        this._wx.push({
          type: 'poof',
          x: b.x, y: b.y,
          vx: -b.dx * 26 + (Math.random() - 0.5) * 22, vy: -b.dy * 14 - 26 - Math.random() * 22,
          t: 0, life: 0.6, seed: Math.random() * 9, col: tint, big: true,
        });
      }
      // fumaça cinza subindo atrás (esforço da corrida)
      this._smokeT = (this._smokeT || 0) + dt;
      if (this._smokeT > 0.22 && this._wx.length < 110) {
        this._smokeT = 0;
        const b = this._behind(sx, sy, this.player.dir);
        this._wx.push({
          type: 'smoke',
          x: b.x, y: b.y - 4,
          vx: -b.dx * 12 + (Math.random() - 0.5) * 10, vy: -b.dy * 10 - 44 - Math.random() * 18,
          t: 0, life: 0.9, seed: Math.random() * 9,
        });
      }
      // afterimage: rastro do corpo
      this._ghostT = (this._ghostT || 0) + dt;
      if (this._ghostT > 0.12 && this._wx.length < 110) {
        this._ghostT = 0;
        const set = this.heroArt[this.player.dir] || this.heroArt.down;
        const frames = Array.isArray(set) ? set : [set];
        const img = this.player.animT > 0 ? frames[Math.floor(this.player.animT * 8) % frames.length] : frames[0];
        this._wx.push({
          type: 'ghost', img,
          x: this.player.x + this.camera.ox - 4, y: this.player.y + this.camera.oy - 12,
          w: 32, h: 40, vx: 0, vy: 0, t: 0, life: 0.32, seed: 0,
        });
      }
      this._walkT = 0;
    } else {
      // caminhada: poeirinha leve e espaçada, sempre atrás dos pés
      this._walkT = (this._walkT || 0) + dt;
      if (this._walkT > 0.3 && this._wx.length < 110) {
        this._walkT = 0;
        const b = this._behind(sx, sy, this.player.dir, 3);
        this._wx.push({
          type: 'stepdust',
          x: b.x, y: b.y,
          vx: -b.dx * 14 + (Math.random() - 0.5) * 10, vy: -b.dy * 8 - 14 - Math.random() * 8,
          t: 0, life: 0.42, seed: Math.random() * 9, col: tint,
        });
      }
      this._poofT = 0; this._smokeT = 0; this._ghostT = 0;
    }
  }

  _drawActor(x, y, art, dir, animT, scale = 1, seed = 0) {
    const set = art[dir] || art.down;
    const frames = Array.isArray(set) ? set : [set];
    let img, bob, squash;
    if (animT > 0) {
      // andando: alterna os 2 frames de passo
      img = frames[Math.floor(animT * 8) % frames.length];
      bob = Math.abs(Math.sin(animT * 10)) * -3;
      squash = 1 + Math.sin(animT * 10) * 0.02;
    } else {
      // parado mas vivo: respiração (sobe/desce 1px, peito estufa de leve)
      img = frames[0];
      const br = this.time * 2.2 + seed;
      bob = Math.sin(br) * -1.1;
      squash = 1 + Math.sin(br) * 0.008;
    }
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
      const fx = (i * 137 + Math.sin(this.time * 0.7 + i) * 30 + VIEW_W) % VIEW_W;
      const fy = 430 + ((i * 53) % 80);
      g.fillStyle = `rgba(255,240,150,${(0.3 + 0.5 * Math.abs(Math.sin(this.time * 2 + i * 2))).toFixed(2)})`;
      g.fillRect(fx, fy, 2, 2);
    }
  }
}
