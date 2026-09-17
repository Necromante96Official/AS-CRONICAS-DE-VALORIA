/**
 * Engine — orquestra o jogo: título, exploração, diálogo, loja, batalha, saves.
 * @module core/Engine
 */
import { TILE, VIEW_W, VIEW_H, ENCOUNTER_RATE } from './Config.js';
import { Input } from './Input.js';
import { AudioMan } from './Audio.js';
import { Camera } from './Camera.js';
import { TileMap } from '../world/TileMap.js';
import { buildMap, regionAt, SPAWN, NPC_DEFS, BOSS_ALTAR, TOY_SPOT, HEAL_CRYSTAL } from '../world/MapData.js';
import { isEncounterTile, tileColor } from '../world/Tiles.js';
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
      'DRAGÃO DO CAOS': dragonFace(this.dragonArt),
    };
    this.dialog.portraitProvider = (name) => this.faceCanvas[name] || null;
    // preferências + tempo de jogo
    const cfg = loadSettings();
    this.dialog.speed = cfg.speed || 'normal';
    this.playSec = 0;
    this._playT0 = null;
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
    const names = { town: 'Vila Lumen', field: 'Planície Verdejante', forest: 'Bosque Sombrio', dungeon: 'Ruínas do Cristal', altar: 'Altar do Caos' };
    const subs = { town: 'povoado pacato', field: 'cuidado com a grama alta', forest: 'feras entre as árvores', dungeon: 'o cristal o aguarda', altar: 'NÃO HÁ VOLTA' };
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
    const giftNpc = this.npcs.find((n) => n.id === 'hermit');
    if (giftNpc && d.flags.giftTaken) giftNpc.giftGiven = true;
    this.camera.snap(this.player.cx, this.player.cy);
  }

  _snapshot() {
    return {
      x: this.player.x, y: this.player.y, dir: this.player.dir,
      party: serializeParty(this.party), inv: { ...this.inv },
      gold: this.gold, flags: { ...this.flags, giftTaken: this.npcs.find((n) => n.id === 'hermit')?.giftGiven },
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

    if (inp.pressed.menu || inp.pressed.cancel) {
      this.audio.unlock(); this.audio.sfx('confirm');
      this.menu.show({ party: this.party, inv: this.inv, gold: this.gold, time: this._fmtTime() }, (m) => toast(m), this._menuActions());
      return;
    }

    // falar / altar do boss / cristal / brinquedo
    if (inp.pressed.confirm) {
      if (this._tryBossInteract()) return;
      if (this._tryHealCrystal()) return;
      if (this._tryToyPickup()) return;
      const npc = this._facingNpc();
      if (npc) { this._talk(npc); return; }
    }

    // movimento (Shift = correr)
    const blockers = this.npcs.map((n) => ({ x: n.x, y: n.y }));
    // dragão bloqueia o altar até ser derrotado
    if (!this.flags.bossDefeated) blockers.push({ x: BOSS_ALTAR.x * TILE, y: BOSS_ALTAR.y * TILE });
    const ax = inp.axis;
    this.player.update(ax, dt, this.map, blockers, inp.held.run);
    // sons de passo / trombada
    if (this.player.moving) {
      this._stepT = (this._stepT || 0) + dt * (this.player.running ? 1.5 : 1);
      if (this._stepT > 0.27) { this._stepT = 0; this.audio.sfx('step'); }
    } else if (ax.x !== 0 || ax.y !== 0) {
      this._bumpT = (this._bumpT || 0) + dt;
      if (this._bumpT > 0.35) { this._bumpT = 0; this.audio.sfx('bump'); }
    } else { this._stepT = 0; this._bumpT = 0; }
    for (const n of this.npcs) n.update(dt, this.map);
    this.camera.follow(this.player.cx, this.player.cy, dt);
    this.camera.update(dt);

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
    const want = region === 'town' ? 'town' : region === 'dungeon' || region === 'altar' ? 'dungeon' : 'field';
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

    // entidades ordenadas por Y (Pip é criança: desenhado menor)
    /** @type {{y:number, draw:()=>void}[]} */
    const ents = [];
    for (const n of this.npcs) {
      const sc = n.id === 'kid' ? 0.78 : 1;
      ents.push({ y: n.y, draw: () => this._drawActor(n.x + ox, n.y + oy, this.npcArt[n.kind] || this.npcArt.elder, n.dir, 0, sc) });
    }
    ents.push({ y: p.y, draw: () => this._drawActor(p.x + ox - 4, p.y + oy - 12, this.heroArt, p.dir, p.moving ? p.animT : 0, 1) });
    ents.sort((a, b) => a.y - b.y).forEach((e) => e.draw());
    // copas por cima de quem está atrás das árvores
    this.map.drawCanopy(g, ox, oy, this.time);

    // balão "▼ E" quando há NPC falável à frente (prioridade sobre o "!" da quest)
    const npc = this._facingNpc();
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
  }

  _drawActor(x, y, art, dir, animT, scale = 1) {
    const img = art[dir] || art.down;
    const bob = animT > 0 ? Math.abs(Math.sin(animT * 10)) * -3 : 0;
    const squash = animT > 0 ? 1 + Math.sin(animT * 10) * 0.02 : 1;
    const w = 32 * squash * scale, h = 40 * scale;
    // ancora pelos pés para o menor (criança) não flutuar
    this.g.drawImage(img, x + (32 - w) / 2, y + (40 - h) + bob * scale, w, h);
  }

  _drawTitleBg() {
    const g = this.g;
    const grad = g.createLinearGradient(0, 0, 0, VIEW_H);
    grad.addColorStop(0, '#060913'); grad.addColorStop(1, '#131c5e');
    g.fillStyle = grad;
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    // estrelas + grama decorativa
    g.fillStyle = '#fff';
    for (let i = 0; i < 60; i++) {
      const x = (i * 173 + this.time * 8) % VIEW_W;
      const y = (i * 97) % 300;
      g.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(this.time + i));
      g.fillRect(x, y, 2, 2);
    }
    g.globalAlpha = 1;
    g.fillStyle = '#1d3a24';
    g.fillRect(0, 400, VIEW_W, 140);
    g.fillStyle = '#2c5a34';
    for (let x = 0; x < VIEW_W; x += 24) {
      const h = 12 + 8 * Math.abs(Math.sin(x + this.time));
      g.fillRect(x, 400 - h, 14, h + 140);
    }
  }
}
