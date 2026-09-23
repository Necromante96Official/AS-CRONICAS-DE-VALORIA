/**
 * BattleSystem — batalha por turnos estilo FF: Atacar / Magia / Item / Fugir.
 * @module battle/BattleSystem
 */
import { SPELLS, grantXp, aliveHeroes, partyWiped } from '../entities/Party.js';
import { ITEMS } from '../systems/Inventory.js';
import { foeImage } from '../entities/Enemies.js';
import { ic } from '../ui/ItemIcons.js';
import { makeHumanoid, humanoidFace, makePortrait } from '../core/SpriteFactory.js';

const PALETTES = {
  hero:   { skin: '#f2c89b', hair: '#7a4a21', tunic: '#2b6fd6', pants: '#3a3a5a', cape: '#c22a3a' },
  mage:   { skin: '#f7d7b5', hair: '#c23b6e', tunic: '#6a3ec2', pants: '#2a2a4a' },
  cleric: { skin: '#e8b88a', hair: '#3a3a3a', tunic: '#e8e4da', pants: '#5a6e8c' },
};

function enemySprite(id) {
  return foeImage(id);
}

const physDmg = (atk, def) => Math.max(1, Math.round(atk * 2.2 - def * 1.2 + Math.random() * 4));
const magDmg = (mag, power, def) => Math.max(1, Math.round(mag * power * 2 - def + Math.random() * 6));

/** Paleta de cenário por região (céu, brilho, chão, detalhe). */
const SCENERY = {
  field:   { sky: ['#7ec8ff', '#cfeaff', '#ffe9b8'], sun: '#fff3c4', far: '#5a8c5a', near: '#3f7a44', ground: '#4da64d', groundD: '#3a7d3a', deco: 'flowers', night: false },
  forest:  { sky: ['#0a2018', '#14402c', '#1d5c38'], sun: '#e8ffe8', far: '#0d2b1e', near: '#123a28', ground: '#2a6134', groundD: '#1d4727', deco: 'mushroom', night: true },
  dungeon: { sky: ['#0d0a1e', '#241a4e', '#33206b'], sun: '#bff3ff', far: '#1a1440', near: '#241c58', ground: '#3a3f5e', groundD: '#2a2e46', deco: 'torch', night: true },
  altar:   { sky: ['#0d0a1e', '#241a4e', '#33206b'], sun: '#bff3ff', far: '#1a1440', near: '#241c58', ground: '#3a3f5e', groundD: '#2a2e46', deco: 'torch', night: true },
  boss:    { sky: ['#1e060a', '#5e1020', '#a02838'], sun: '#ff9b5b', far: '#3a0a12', near: '#521420', ground: '#4a2028', groundD: '#33141c', deco: 'embers', night: true },
  beach:   { sky: ['#3d7ac8', '#7ec8ff', '#cfeaff'], sun: '#fff8dc', far: '#2b6fd6', near: '#e0c886', ground: '#e0c886', groundD: '#b8945a', deco: 'shells', night: false },
  snow:    { sky: ['#8aa4c4', '#c9d8ea', '#eef4fd'], sun: '#ffffff', far: '#7d8aa0', near: '#a8b8cc', ground: '#e8f0ff', groundD: '#b9c8de', deco: 'snowfall', night: false },
  desert:  { sky: ['#e8933a', '#f5c86e', '#ffe9b8'], sun: '#fff3c4', far: '#c98a3a', near: '#d9b878', ground: '#d9b878', groundD: '#a8845c', deco: 'cactus', night: false },
  swamp:   { sky: ['#0e1a12', '#1d3325', '#2e4a38'], sun: '#c9e88a', far: '#0a140e', near: '#16241b', ground: '#2e4a38', groundD: '#1d3325', deco: 'fog', night: true },
};

export class BattleSystem {
  /** @param {import('../core/Audio.js').AudioMan} audio */
  constructor(audio) {
    this.audio = audio;
    this.el = document.getElementById('battle');
    this.cv = document.getElementById('battle-canvas');
    this.g = this.cv.getContext('2d');
    this.msgEl = document.getElementById('battle-msg');
    this.partyEl = document.getElementById('battle-party');
    this.foesEl = document.getElementById('battle-foes');
    this.bottomEl = document.getElementById('battle-bottom');
    this.cmdEl = document.getElementById('battle-cmds');
    this.bossBar = document.getElementById('boss-bar');
    this.bossName = document.getElementById('boss-name');
    this.bossFill = document.getElementById('boss-fill');
    this.active = false;
    this.heroArt = {};
    for (const [k, p] of Object.entries(PALETTES)) this.heroArt[k] = makeHumanoid(p, { kind: k });
    this.heroIcons = {};
    for (const k of Object.keys(this.heroArt)) {
      try {
        this.heroIcons[k] = humanoidFace(this.heroArt[k]).toDataURL();
      } catch { this.heroIcons[k] = ''; }
    }
    this._resetFx();
    // mouse: passar por cima seleciona
    this.cmdEl.addEventListener('mouseover', (e) => {
      const o = e.target.closest('.opt');
      if (!o || !this.active || this.phase !== 'command') return;
      const i = [...this.cmdEl.querySelectorAll('.opt')].indexOf(o);
      if (i >= 0 && i !== this.sel && i < (this.optCount || 99)) { this.sel = i; this._renderCmds(); }
    });
    // mouse: clicar num comando = selecionar + confirmar
    this.cmdEl.addEventListener('click', (e) => {
      const o = e.target.closest('.opt');
      if (!o || !this.active || this.phase !== 'command') return;
      this.audio.unlock();
      const i = [...this.cmdEl.querySelectorAll('.opt')].indexOf(o);
      if (i < 0) return;
      this.sel = i;
      if (this.menu === 'main' || this.menu === 'magic' || this.menu === 'item') this._confirm();
      else {
        // em menus de alvo, só seleciona (segundo clique confirma)
        this._renderCmds();
        if (o.classList.contains('sel') && this._lastClick === i) this._confirm();
        this._lastClick = i;
      }
    });
  }

  _resetFx() {
    this.anim = null;      // {who:'hero'|'enemy', idx, t}
    this.flashT = 0;
    this.flashColor = '255,120,40';
    this.particles = [];   // {x,y,vx,vy,life,maxLife,color,size,grav}
    this.floats = [];      // {x,y,text,color,t,crit} — texto flutuante no canvas
    this.shots = [];       // projéteis {kind,x0,y0,x1,y1,t,dur,color}
    this.rings = [];       // ondas de choque {x,y,t,dur,color,maxR}
    this.hitStop = 0;
    this.shakeT = 0; this.shakeM = 0;
    this.banner = null;    // {text, sub, t, dur}
    this.time = 0;
    this.victoryT = 0;
  }

  /**
   * @param {import('../entities/Party.js').Hero[]} party
   * @param {Record<string,number>} inv
   * @param {import('../entities/Enemies.js').Enemy[]} enemies
   * @param {{boss?:boolean, region?:string, onEnd:(r:any)=>void}} opts
   */
  start(party, inv, enemies, opts) {
    this.party = party; this.inv = inv; this.enemies = enemies;
    this.isBoss = !!opts.boss;
    this.region = opts.region || 'field';
    this.onEnd = opts.onEnd;
    this.phase = 'intro';
    this.phaseT = 0;
    this.heroIdx = 0;
    this.menu = 'main'; this.sel = 0; this._mainSel = null;
    this.actions = [];
    this.queue = [];
    this.turnCount = 0;
    this.fled = false;
    this._resetFx();
    for (const h of this.party) { h.guard = false; }
    for (const e of this.enemies) { e._showHp = e.hp; e.burn = 0; e.burnDmg = 0; e.stun = false; e.charge = false; e.spawnT = 0.5 + Math.random() * 0.4; }
    this.active = true;
    this.el.classList.remove('hidden');
    for (const c of [...this.el.classList]) if (c.startsWith('bg-')) this.el.classList.remove(c);
    if (opts.region) this.el.classList.add('bg-' + opts.region);
    if (this.isBoss) this.el.classList.add('bg-boss');
    this.enemyArt = enemies.map((e) => enemySprite(e.sprite));
    this.enemyIcons = this.enemyArt.map((cv) => { try { return makePortrait(cv, 0, 0, cv.width, cv.height).toDataURL(); } catch { return ''; } });
    if (this.isBoss && enemies[0]) {
      this.bossName.textContent = `☠ ${enemies[0].name} ☠`;
      this.bossBar.classList.remove('hidden');
    } else {
      this.bossBar.classList.add('hidden');
    }
    this._banner(`${enemies.map((e) => e.name).join(' & ')}`, enemies.length > 1 ? 'inimigos surgem!' : 'um inimigo surge!');
    this._log(`${enemies.map((e) => e.name).join(', ')} surge${enemies.length > 1 ? 'm' : ''}!`);
    this._renderAll();
  }

  stop() { this.active = false; this.el.classList.add('hidden'); this.bossBar?.classList.add('hidden'); }

  // ---------- layout dos combatentes (visão lateral, pés no chão) ----------
  // Palco nativo HD 1280x453: inimigos à esquerda-centro, heróis à direita
  // (abaixo e à esquerda dos painéis DOM do topo — sem sobreposição).
  heroPos(i) {
    // formação em diagonal: fileira de trás levemente acima (profundidade)
    const F = [{ x: 700, y: 395 }, { x: 795, y: 370 }, { x: 860, y: 393 }];
    if (i < F.length && this.party.length === F.length) return F[i];
    return { x: 700 + i * 80, y: 395 - (i % 2 ? 25 : 0) };
  }
  heroScale(i) {
    // fileira de trás um pouco menor (perspectiva)
    return (this.party.length === 3 && i === 1) ? 0.9 : 1;
  }
  enemyPos(i) {
    const n = this.enemies.length;
    if (this.isBoss) return { x: 400, y: 300 };
    if (n === 1) return { x: 370, y: 355 };
    if (n === 2) return [{ x: 280, y: 365 }, { x: 480, y: 345 }][i] || { x: 370, y: 355 };
    return [{ x: 220, y: 368 }, { x: 390, y: 348 }, { x: 550, y: 365 }][i] || { x: 370, y: 355 };
  }

  // ---------- log / render ----------
  _log(html) {
    this.msgEl.innerHTML = html;
    this.msgEl.scrollTop = 9999;
  }

  _banner(text, sub = '') {
    this.banner = { text, sub, t: 0, dur: 1.6 };
  }

  _renderAll() {
    // topo-esquerda: foto + HP dos inimigos vivos (alvo atual destacado)
    const cursor = this.phase === 'command' && this.menu === 'targetE' ? this._foeAtCursor() : -2;
    if (this.foesEl) {
      this.foesEl.innerHTML = this._aliveFoes().map((idx) => {
        const e = this.enemies[idx];
        const tags = `${e.burn > 0 ? '🔥' : ''}${e.stun ? '💫' : ''}${e.charge ? '⚡' : ''}`;
        return `<div class="bfoe ${idx === cursor ? 'targeted' : ''}">
          <img src="${(this.enemyIcons || [])[idx] || ''}" alt="" />
          <div class="bfoe-info"><span class="bfoe-nm">${tags}${e.name}</span>
          <div class="bbar hp"><div style="width:${(100 * Math.max(0, e.hp) / e.maxHp).toFixed(0)}%"></div></div></div>
        </div>`;
      }).join('');
    }
    // topo-direita: foto + HP/MP da party (sem painel de turno)
    this.partyEl.innerHTML = this.party.map((h, i) => {
      const low = h.hp > 0 && h.hp < h.maxHp * 0.3;
      const tags = `${h.guard ? '<span class="btag guard">🛡</span>' : ''}${low ? '<span class="btag low">!</span>' : ''}`;
      return `
      <div class="bchar ${this.phase === 'command' && i === this.heroIdx ? 'active' : ''} ${low ? 'lowhp' : ''} ${h.hp <= 0 ? 'dead' : ''}">
        <img class="bface" src="${this.heroIcons[h.sprite] || this.heroIcons.hero || ''}" alt="" />
        <div class="bchar-info">
          <div class="brow"><span class="bnm">${h.hp <= 0 ? '✝' : '●'} ${h.name}</span><span class="blv">Nv${h.level}</span>${tags}<span class="bnums">HP ${Math.max(0, Math.ceil(h.hp))}/${h.maxHp} · MP ${Math.max(0, Math.ceil(h.mp))}/${h.maxMp}</span></div>
          <div class="bbar hp"><div style="width:${(100 * Math.max(0, h.hp) / h.maxHp).toFixed(0)}%"></div></div>
          <div class="bbar mp"><div style="width:${(100 * Math.max(0, h.mp) / h.maxMp).toFixed(0)}%"></div></div>
        </div>
      </div>`;
    }).join('');
    if (this.isBoss && this.enemies[0] && this.bossFill) {
      const b = this.enemies[0];
      this.bossFill.style.width = `${(100 * Math.max(0, b.hp) / b.maxHp).toFixed(1)}%`;
    }
    this._renderCmds();
  }

  /** Índices reais dos inimigos vivos (alvos válidos). */
  _aliveFoes() {
    const out = [];
    this.enemies.forEach((e, idx) => { if (e.hp > 0) out.push(idx); });
    return out;
  }

  /** Índice real do inimigo sob o cursor (lista só de vivos + « Voltar). */
  _foeAtCursor() {
    const alive = this._aliveFoes();
    if (this.sel >= alive.length) return -1; // « Voltar
    return alive[this.sel];
  }

  /** Garante cursor dentro da lista válida ao abrir/atualizar o menu de alvo. */
  _clampTargetCursor() {
    if (this.menu === 'targetE') {
      const n = this._aliveFoes().length + 1; // vivos + Voltar
      if (this.sel >= n) this.sel = 0;
    }
  }

  _renderCmds() {
    // fora da escolha (animação/execução): esconde a barra — sem janela vazia
    if (this.bottomEl) this.bottomEl.style.display = this.phase === 'command' ? '' : 'none';
    if (this.phase !== 'command') return;
    const h = this.party[this.heroIdx];
    let opts = [];
    if (this.menu === 'main') opts = [
      `${ic('attack')} Atacar`, `${ic('magic')} Magia`, `${ic('item')} Item`,
      `${ic('scan')} Analisar`, `${ic('flee')} Fugir`, `${ic('guard')} Defender`,
    ];
    else if (this.menu === 'magic') opts = [...h.spells.map((s) => ({
      html: `${ic(s)}${SPELLS[s].name}<span class="cost">${SPELLS[s].mp}MP</span><span class="row-sub"> — ${SPELLS[s].desc}</span>`,
      cls: h.mp < SPELLS[s].mp ? ' nomp' : '',
    })), { html: '« Voltar', cls: '' }];
    else if (this.menu === 'item') opts = [...Object.keys(ITEMS).filter((id) => (this.inv[id] || 0) > 0 && ITEMS[id].battle).map((id) => `${ic(id)}${ITEMS[id].name}<span class="count">×${this.inv[id]}</span>`), '« Voltar'];
    else if (this.menu === 'targetE') {
      // Derrotados somem da seleção: lista só os vivos + « Voltar.
      this._clampTargetCursor();
      opts = [...this._aliveFoes().map((idx) => {
        const e = this.enemies[idx];
        const tags = `${e.burn > 0 ? ic('fire', 16) : ''}${e.stun ? ic('magic', 16) : ''}${e.charge ? ic('thunder', 16) : ''}`;
        return `<span>${tags}${e.name}</span><span class="foe-hp">${Math.max(0, Math.ceil(e.hp))}/${e.maxHp}</span>`;
      }), '« Voltar'];
    }
    else if (this.menu === 'targetA') opts = [...this.party.map((a) => `${a.hp <= 0 ? '✝ ' : ''}${a.guard ? ic('guard', 16) : ''}${a.name}<span class="foe-hp">${Math.max(0, Math.ceil(a.hp))}/${a.maxHp}</span>`), '« Voltar'];
    this.cmdEl.innerHTML = `<div class="cmd-title">${h.name} ❯</div>` +
      opts.map((o, i) => {
        const html = typeof o === 'string' ? o : o.html;
        const cls = typeof o === 'string' ? '' : o.cls;
        return `<div class="opt${cls} ${i === this.sel ? 'sel' : ''}">${html}</div>`;
      }).join('');
    this.optCount = opts.length;
    this.cmdEl.scrollTop = 9999;
  }

  // ---------- input ----------
  /** @param {import('../core/Input.js').Input} input */
  handle(input) {
    if (!this.active || this.phase !== 'command') return true;
    const h = this.party[this.heroIdx];
    const move = (max) => {
      if (input.pressed.up) { this.sel = (this.sel + max - 1) % max; this.audio.sfx('cursor'); this._renderCmds(); return true; }
      if (input.pressed.down) { this.sel = (this.sel + 1) % max; this.audio.sfx('cursor'); this._renderCmds(); return true; }
      return false;
    };
    const count = this.optCount || this.cmdEl.children.length;
    if (move(count)) return true;
    if (!input.pressed.confirm && !input.pressed.cancel) return true;

    if (input.pressed.cancel) {
      if (this.menu === 'main') return true;
      this.audio.sfx('cancel');
      this.menu = 'main'; this.sel = 0; this.pending = null;
      this._renderCmds(); return true;
    }
    // confirm
    this._confirm();
    return true;
  }

  _confirm() {
    if (!this.active || this.phase !== 'command') return;
    const h = this.party[this.heroIdx];
    this.audio.sfx('confirm');
    if (this.menu === 'main') {
      const c = ['attack', 'magic', 'item', 'scan', 'flee', 'guard'][this.sel];
      if (c === 'attack') { this._mainSel = this.sel; this.pending = { type: 'attack' }; this.menu = 'targetE'; this.sel = 0; }
      else if (c === 'magic') { this._mainSel = this.sel; this.menu = 'magic'; this.sel = 0; }
      else if (c === 'item') { this._mainSel = this.sel; this.menu = 'item'; this.sel = 0; }
      else if (c === 'scan') { this._mainSel = this.sel; this.pending = { type: 'scan' }; this.menu = 'targetE'; this.sel = 0; }
      else if (c === 'guard') { this._act(this.heroIdx, { type: 'guard' }); return true; }
      else if (c === 'flee') { this._act(this.heroIdx, { type: 'flee' }); return true; }
    } else if (this.menu === 'magic') {
      if (this.sel >= h.spells.length) { this.menu = 'main'; this.sel = 1; }
      else {
        const sid = h.spells[this.sel];
        if (h.mp < SPELLS[sid].mp) { this._log(`${h.name} não tem MP para ${SPELLS[sid].name}!`); this.audio.sfx('flee-fail'); return true; }
        this.pending = { type: 'magic', spell: sid };
        this.menu = SPELLS[sid].target === 'ally' ? 'targetA' : 'targetE';
        this.sel = 0;
      }
    } else if (this.menu === 'item') {
      const ids = Object.keys(ITEMS).filter((id) => (this.inv[id] || 0) > 0 && ITEMS[id].battle);
      if (this.sel >= ids.length) { this.menu = 'main'; this.sel = 2; }
      else {
        const id = ids[this.sel];
        if (ITEMS[id].flee) { this._act(this.heroIdx, { type: 'flee', item: id }); return true; }
        this.pending = { type: 'item', item: id };
        this.menu = ITEMS[id].dmg ? 'targetE' : 'targetA'; this.sel = 0;
      }
    } else if (this.menu === 'targetE') {
      const alive = this._aliveFoes();
      if (this.sel >= alive.length) { this.menu = this.pending?.type === 'attack' ? 'main' : (this.pending?.type === 'magic' ? 'magic' : (this.pending?.type === 'item' ? 'item' : 'main')); this.sel = 0; }
      else {
        const realIdx = alive[this.sel];
        if (realIdx === undefined || this.enemies[realIdx].hp <= 0) { this.audio.sfx('flee-fail'); this.sel = 0; this._renderCmds(); return true; }
        this._act(this.heroIdx, { ...this.pending, target: realIdx });
        return true;
      }
    } else if (this.menu === 'targetA') {
      if (this.sel >= this.party.length) { this.menu = this.pending?.type === 'item' ? 'item' : 'magic'; this.sel = 0; }
      else {
        const t = this.party[this.sel];
        const isRevive = this.pending?.type === 'item' && !!ITEMS[this.pending.item]?.revive;
        if (t.hp <= 0 && !isRevive) {
          this._log(`${t.name} está caído! Só uma Pena de Fênix o traz de volta.`);
          this.audio.sfx('flee-fail');
          return true;
        }
        if (t.hp > 0 && isRevive) {
          this._log(`${t.name} ainda está de pé!`);
          this.audio.sfx('flee-fail');
          return true;
        }
        this._act(this.heroIdx, { ...this.pending, target: this.sel });
        return true;
      }
    }
    this._renderCmds();
    return true;
  }

  /** Registra ação do herói e avança. */
  _act(heroIdx, action) {
    const h = this.party[heroIdx];
    if (action.type === 'guard') {
      h.guard = true;
      this.audio.sfx('confirm');
      this._ringFx(this.heroPos(heroIdx), '#6bb8ff');
      this._floatText(this.heroPos(heroIdx), -30, '🛡 GUARDA', '#6bb8ff', false);
      this._log(`${h.name} ergue a guarda! Dano reduzido até o próximo turno.`);
      this.actions[heroIdx] = { type: 'guard' };
    } else {
      this.actions[heroIdx] = action;
    }
    this.heroIdx++;
    // pula heróis caídos
    while (this.heroIdx < this.party.length && this.party[this.heroIdx].hp <= 0) {
      this.actions[this.heroIdx] = { type: 'skip' };
      this.heroIdx++;
    }
    this.menu = 'main'; this.sel = this._mainSel ?? 0; this.pending = null;
    if (this.heroIdx >= this.party.length) this._beginExec();
    else { this._log(`O que ${this.party[this.heroIdx].name} fará?`); this._renderAll(); }
  }

  // ---------- execução dos turnos ----------
  _beginExec() {
    this.phase = 'exec';
    this._mainSel = null; // nova rodada: cursor volta ao Atacar
    this.turnCount++;
    this.queue = [];
    this.party.forEach((h, i) => {
      const a = this.actions[i];
      if (h.hp > 0 && a && a.type !== 'skip' && a.type !== 'guard') this.queue.push({ side: 'hero', idx: i, spd: h.spd + Math.random() * 3, act: a });
    });
    this.enemies.forEach((e, i) => {
      if (e.hp > 0) this.queue.push({ side: 'enemy', idx: i, spd: e.spd + Math.random() * 3 });
    });
    this.queue.sort((a, b) => b.spd - a.spd);
    this.phaseT = 0.4;
    this._renderAll();
  }

  /** @param {number} dt */
  update(dt) {
    if (!this.active) return;
    this.time += dt;
    if (this.hitStop > 0) { this.hitStop -= dt; }
    const step = this.hitStop > 0 ? dt * 0.05 : dt;
    // partículas
    for (const p of this.particles) { p.x += p.vx * step; p.y += p.vy * step; p.vy += (p.grav ?? 300) * step; p.life -= step; }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const f of this.floats) { f.y -= 44 * step; f.t += step; }
    this.floats = this.floats.filter((f) => f.t < 1.1);
    for (const s of this.shots) { s.t += step; }
    this.shots = this.shots.filter((s) => s.t < s.dur);
    for (const r of this.rings) { r.t += step; }
    this.rings = this.rings.filter((r) => r.t < r.dur);
    // barras de HP suavizadas dos inimigos
    for (const e of this.enemies) {
      if (e._showHp === undefined) e._showHp = e.hp;
      e._showHp += (Math.max(0, e.hp) - e._showHp) * Math.min(1, step * 6);
      if (Math.abs(e._showHp - Math.max(0, e.hp)) < 0.5) e._showHp = Math.max(0, e.hp);
      if (e.spawnT > 0) e.spawnT -= step;
      if (e.hitT > 0) e.hitT -= step;
    }
    for (const h of this.party) { if (h.hitT > 0) h.hitT -= step; }
    if (this.anim) { this.anim.t -= step; if (this.anim.t <= 0) this.anim = null; }
    if (this.flashT > 0) this.flashT -= step;
    if (this.shakeT > 0) this.shakeT -= step;
    if (this.banner) { this.banner.t += dt; if (this.banner.t > this.banner.dur) this.banner = null; }
    if (this.victoryT > 0) this.victoryT -= dt;

    if (this.phase === 'intro') {
      this.phaseT += dt;
      if (this.phaseT > 0.9) {
        this.phase = 'command'; this.heroIdx = 0;
        this.actions = new Array(this.party.length).fill(null);
        while (this.heroIdx < this.party.length && this.party[this.heroIdx].hp <= 0) { this.actions[this.heroIdx] = { type: 'skip' }; this.heroIdx++; }
        this.menu = 'main'; this.sel = 0; this.pending = null;
        this._log(`O que ${this.party[this.heroIdx].name} fará?`);
        this._renderAll();
      }
    } else if (this.phase === 'exec') {
      this.phaseT -= step;
      if (this.phaseT <= 0 && !this.anim) this._stepQueue();
    } else if (this.phase === 'done') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) {
        const r = this.endResult;
        this.stop();
        this.onEnd(r);
      }
    }
  }

  _stepQueue() {
    if (this._checkEnd()) return;
    const turn = this.queue.shift();
    if (!turn) {
      // nova rodada: a guarda cai, nova fase de comandos
      for (const h of this.party) h.guard = false;
      this.heroIdx = 0; this.actions = new Array(this.party.length).fill(null);
      this.phase = 'command';
      while (this.heroIdx < this.party.length && this.party[this.heroIdx].hp <= 0) { this.actions[this.heroIdx] = { type: 'skip' }; this.heroIdx++; }
      this._log(`O que ${this.party[this.heroIdx].name} fará? (Turno ${this.turnCount + 1})`);
      this._renderAll();
      return;
    }
    if (turn.side === 'hero') {
      const h = this.party[turn.idx];
      if (h.hp <= 0) { this._stepQueue(); return; }
      if (turn.act?.type === 'guard') { this._renderAll(); }
      else this._heroAct(h, turn.idx, turn.act);
    } else {
      const e = this.enemies[turn.idx];
      if (e.hp <= 0) { this._stepQueue(); return; }
      // atordoado: perde o turno
      if (e.stun && !e.boss) {
        e.stun = false;
        this._floatText(this.enemyPos(turn.idx), -20, '💫 ATORDOADO', '#cfe8ff', false);
        this._log(`${e.name} está atordoado e perde o turno!`);
        this._renderAll();
      } else {
        // queimadura corrói no início do turno do inimigo
        if (e.burn > 0 && e.hp > 0) {
          e.burn--;
          e.hp -= e.burnDmg;
          e.hitT = 0.3;
          this._burstFx(this.enemyPos(turn.idx), '#ff7b2e', 10);
          this._floatDmg(this.enemyPos(turn.idx), e.burnDmg, '#ff9b3c');
          this._log(`${e.name} sofre ${e.burnDmg} de queimadura!`);
          if (e.hp <= 0) { this.audio.sfx('die'); this._soulFx(this.enemyPos(turn.idx)); this._renderAll(); }
          else this._enemyAct(e, turn.idx);
        } else {
          this._enemyAct(e, turn.idx);
        }
      }
    }
    this.phaseT = 0.65;
  }

  /** Alvo inimigo válido: mantém o escolhido ou redireciona ao primeiro vivo. @returns {number} índice ou -1 */
  _resolveEnemyTarget(idx) {
    if (this.enemies[idx] && this.enemies[idx].hp > 0) return idx;
    return this.enemies.findIndex((e) => e.hp > 0);
  }

  /** Descrição de análise por espécie. @param {string} id */
  _scanFlavor(id) {
    return {
      slime: 'Corpo mole: fraco contra Fogo. Às vezes cospe ácido que ignora defesa.',
      bat: 'Rápido, mas frágil. Caia antes que voe. Mira nos mais frágeis.',
      golem: 'Casca dura: prefira magias. Esmaga quem tem mais HP.',
      wisp: 'Arde em essência azul. Carrega energia antes do golpe forte!',
      crab: 'Casca dura de praia! Pinça esmagadora de vez em quando.',
      scorpion: 'Ferrão venenoso que fura defesa. Rápido e frágil.',
      shroom: 'Solta esporos que o curam. Derrube rápido!',
      king: 'Um rei entre gosmas! Recompensa real para quem vencer.',
      skeleton: 'Ossos velhos, ódio novo. Lâmina enferrujada, mas certeira. GELO o deixa lento!',
      orc: 'Brutamontes do deserto. Fica FURIOSO quando ferido — derrube rápido!',
      toad: 'Papo inflável, língua comprida. Atinge os mais frágeis de longe!',
      wolf: 'Veloz como a nevasca! Mordidas duplas em quem estiver mais ferido.',
      ancient: 'O colosso do deserto! Runas acendem na fúria. Traga BOMBAS e magia!',
      dragon: 'O CAOS encarnado. Fases de fúria: baforadas, regeneração e fúria final!',
    }[id] || 'Sem dados no bestiário.';
  }

  _heroAct(h, hi, act) {
    if (act.type === 'scan') {
      const ti = this._resolveEnemyTarget(act.target ?? 0);
      if (ti < 0) return;
      const e = this.enemies[ti];
      this.audio.sfx('cursor');
      const extra = `${e.burn > 0 ? ' · 🔥queimando' : ''}${e.stun ? ' · 💫atordoado' : ''}`;
      this._log(`🔍 ${e.name}: HP ${Math.max(0, Math.ceil(e.hp))}/${e.maxHp} · ATK ${e.atk} · DEF ${e.def}${extra}<br/>${this._scanFlavor(e.id)}`);
      this._renderAll();
      return;
    }
    if (act.type === 'flee') {
      if (this.isBoss) { this._log('Não há como fugir do Dragão do Caos!'); this.audio.sfx('flee-fail'); return; }
      if (act.item) {
        this.inv[act.item]--;
        this.audio.sfx('run');
        this._log(`${h.name} usou ${ITEMS[act.item].name}! Fuga garantida!`);
        this._finish(false, true);
        return;
      }
      if (Math.random() < 0.6) {
        this.audio.sfx('run');
        this._log(`${h.name} bateu em retirada!`);
        this._finish(false, true);
      } else { this._log(`${h.name} não conseguiu fugir!`); this.audio.sfx('flee-fail'); }
      return;
    }
    if (act.type === 'attack') {
      const ti = this._resolveEnemyTarget(act.target ?? 0);
      if (ti < 0) return;
      const e = this.enemies[ti];
      const crit = Math.random() < 0.12;
      const dmg = Math.round(physDmg(h.atk, e.def) * (crit ? 1.7 : 1));
      e.hp -= dmg;
      e.hitT = 0.35;
      this.audio.sfx(crit ? 'crit' : 'hit');
      // avanço: o herói corre até o alvo e volta (golpe físico)
      { const from = this.heroPos(hi), to = this.enemyPos(this.enemies.indexOf(e));
        this.anim = { who: 'hero', idx: hi, t: 0.38, dur: 0.38, fx: from.x, fy: from.y, tx: to.x, ty: to.y }; }
      const pos = this.enemyPos(this.enemies.indexOf(e));
      this._slashFx(pos, crit);
      this._strikeFx(pos, '#fff');
      this._floatDmg(pos, dmg, crit ? '#ffd75e' : '#fff', crit);
      if (crit) { this.hitStop = 0.12; this._shake(5, 0.25); }
      this._log(`${h.name} ataca ${e.name}! ${crit ? 'CRÍTICO! ' : ''}${dmg} de dano!${e.hp <= 0 ? ` ${e.name} foi derrotado!` : ''}`);
      if (e.hp <= 0) { this.audio.sfx('die'); this._soulFx(pos); }
    } else if (act.type === 'magic') {
      const sp = SPELLS[act.spell];
      h.mp -= sp.mp;
      if (sp.target === 'enemy') {
        const ti = this._resolveEnemyTarget(act.target ?? 0);
        if (ti < 0) return;
        const e = this.enemies[ti];
        const dmg = magDmg(h.mag, sp.power, e.def);
        e.hp -= dmg;
        e.hitT = 0.4;
        this.audio.sfx(spellSfx(act.spell));
        this.anim = { who: 'hero', idx: hi, t: 0.4, dur: 0.4 };
        const from = this.heroPos(hi), to = this.enemyPos(this.enemies.indexOf(e));
        const col = spellColor(act.spell);
        if (act.spell === 'thunder') {
          this._boltFx(to, col);
          this._shake(4, 0.2);
          if (!e.boss && e.hp > 0 && Math.random() < 0.25) {
            e.stun = true;
            this._log(`${h.name} conjura ${sp.name} em ${e.name}! ${dmg} de dano! ${e.name} ficou ATORDOADO!${e.hp <= 0 ? ` ${e.name} foi derrotado!` : ''}`);
          } else {
            this._log(`${h.name} conjura ${sp.name} em ${e.name}! ${dmg} de dano!${e.hp <= 0 ? ` ${e.name} foi derrotado!` : ''}`);
          }
        } else if (act.spell === 'ice') {
          this._cometFx(from, to, col);
          this._burstFx(to, col);
          this._ringFx(to, col);
          if (!e.boss && e.hp > 0 && Math.random() < 0.30) {
            e.stun = true;
            this._log(`${h.name} conjura ${sp.name} em ${e.name}! ${dmg} de dano! ${e.name} foi CONGELADO! ❄${e.hp <= 0 ? ` ${e.name} foi derrotado!` : ''}`);
          } else {
            this._log(`${h.name} conjura ${sp.name} em ${e.name}! ${dmg} de dano!${e.hp <= 0 ? ` ${e.name} foi derrotado!` : ''}`);
          }
        } else {
          this._cometFx(from, to, col);
          this._burstFx(to, col);
          this._ringFx(to, col);
          if (e.hp > 0) { e.burn = 2; e.burnDmg = Math.max(2, Math.round(h.mag * 0.8)); }
          this._log(`${h.name} conjura ${sp.name} em ${e.name}! ${dmg} de dano!${e.hp <= 0 ? ` ${e.name} foi derrotado!` : ' Queimando! 🔥'}`);
        }
        this._floatDmg(to, dmg, col, false);
        if (e.hp <= 0) this.audio.sfx('die');
        if (e.hp <= 0) this._soulFx(to);
      } else {
        // Cura redireciona se o alvo caiu no meio do turno.
        let ti = act.target ?? 0;
        if (!this.party[ti] || this.party[ti].hp <= 0) {
          const alt = [...this.party.keys()].filter((i) => this.party[i].hp > 0)
            .sort((a, b) => (this.party[a].hp / this.party[a].maxHp) - (this.party[b].hp / this.party[b].maxHp))[0];
          if (alt === undefined) return;
          ti = alt;
        }
        const a = this.party[ti];
        if (a.hp >= a.maxHp) { this._log(`${a.name} já está com HP cheio!`); this.audio.sfx('flee-fail'); return; }
        const v = Math.min(Math.round(h.mag * sp.power * 3), a.maxHp - Math.max(0, a.hp));
        a.hp = Math.min(a.maxHp, Math.max(0, a.hp) + v);
        this.audio.sfx('heal');
        this.anim = { who: 'hero', idx: hi, t: 0.35, dur: 0.35 };
        this._healFx(this.heroPos(ti));
        this._floatDmg(this.heroPos(ti), `+${v}`, '#7dff9a', false);
        this._log(`${h.name} conjura ${sp.name} em ${a.name}! +${v} HP!`);
      }
    } else if (act.type === 'item') {
      const it = ITEMS[act.item];
      let ti = act.target ?? 0;
      if (it.dmg) {
        // Bomba de Fogo: dano fixo explosivo num inimigo (ignora defesa parcial)
        const ei2 = this._resolveEnemyTarget(act.target ?? 0);
        if (ei2 < 0) return;
        const e = this.enemies[ei2];
        const dmg = Math.round(it.dmg * (0.9 + Math.random() * 0.25));
        e.hp -= dmg;
        e.hitT = 0.4;
        this.inv[act.item]--;
        this.audio.sfx('fire');
        this.anim = { who: 'hero', idx: hi, t: 0.35, dur: 0.35 };
        const to = this.enemyPos(ei2);
        this._cometFx(this.heroPos(hi), to, '#ff7b2e');
        this._burstFx(to, '#ff7b2e', 30);
        this._burstFx(to, '#ffd75e', 16);
        this._ringFx(to, '#ff9b3c');
        this._shake(5, 0.25);
        this._floatDmg(to, dmg, '#ff9b3c', false);
        this._log(`${h.name} atira ${it.name} em ${e.name}! ${dmg} de dano explosivo!${e.hp <= 0 ? ` ${e.name} foi derrotado!` : ''}`);
        if (e.hp <= 0) { this.audio.sfx('die'); this._soulFx(to); }
        this._renderAll();
        return;
      }
      if (it.revive) {
        // Fênix mira o caído exato (sem redirecionar p/ vivos)
        const a = this.party[ti];
        if (!a || a.hp > 0) { this._log('Sem alvo caído para a Pena de Fênix!'); this.audio.sfx('flee-fail'); return; }
        this.inv[act.item]--;
        const v = Math.min(Math.ceil(a.maxHp * it.revive), a.maxHp);
        a.hp = v;
        this.audio.sfx('levelup');
        this.anim = { who: 'hero', idx: hi, t: 0.4, dur: 0.4 };
        this._healFx(this.heroPos(ti), '#ffd75e');
        this._ringFx(this.heroPos(ti), '#ffd75e');
        this._floatDmg(this.heroPos(ti), `+${v}`, '#ffd75e', false);
        this._log(`${h.name} usa ${it.name} em ${a.name}! Renasceu com ${v} HP!`);
        this._renderAll();
        return;
      }
      if (!this.party[ti] || this.party[ti].hp <= 0) {
        const alt = [...this.party.keys()].filter((i) => this.party[i].hp > 0)
          .sort((a, b) => (this.party[a].hp / this.party[a].maxHp) - (this.party[b].hp / this.party[b].maxHp))[0];
        if (alt === undefined) return;
        ti = alt;
      }
      const a = this.party[ti];
      if (it.heal && a.hp >= a.maxHp) { this._log(`${a.name} já está com HP cheio!`); this.audio.sfx('flee-fail'); return; }
      if (it.mp && a.mp >= a.maxMp) { this._log(`${a.name} já está com MP cheio!`); this.audio.sfx('flee-fail'); return; }
      this.inv[act.item]--;
      this.audio.sfx('item');
      if (it.heal) {
        const v = Math.min(it.heal, a.maxHp - Math.max(0, a.hp));
        a.hp = Math.min(a.maxHp, Math.max(0, a.hp) + v);
        this._healFx(this.heroPos(ti));
        this._floatDmg(this.heroPos(ti), `+${v}`, '#7dff9a', false);
        this._log(`${h.name} usa ${it.name} em ${a.name}! +${v} HP!`);
      } else if (it.mp) {
        const v = Math.min(it.mp, a.maxMp - a.mp);
        a.mp += v;
        this._floatDmg(this.heroPos(ti), `+${v} MP`, '#6bb8ff', false);
        this._log(`${h.name} usa ${it.name} em ${a.name}! +${v} MP!`);
      }
    }
    this._renderAll();
  }

  /** Escolhe o herói-alvo com IA por espécie (fraquezas, foco, finalização). */
  _pickTarget(e) {
    const alive = aliveHeroes(this.party);
    if (!alive.length) return null;
    // 1) finalização: herói que morre com um golpe médio
    const avgHit = e.atk * 2.2;
    const finishable = alive.filter((h) => h.hp > 0 && h.hp < avgHit * 0.8 && !h.guard);
    if (finishable.length && Math.random() < 0.65) {
      return finishable.sort((a, b) => a.hp - b.hp)[0];
    }
    // 2) sabor por espécie
    const r = Math.random();
    if (e.id === 'bat' && r < 0.6) return [...alive].sort((a, b) => a.def - b.def)[0]; // mira frágeis
    if ((e.id === 'golem' || e.id === 'orc' || e.id === 'ancient') && r < 0.55) return [...alive].sort((a, b) => b.maxHp - a.maxHp)[0]; // esmaga tanques
    if (e.id === 'wolf' && r < 0.6) return [...alive].sort((a, b) => b.spd - a.spd)[0]; // caça os mais velozes
    if ((e.id === 'wisp' || e.id === 'king') && r < 0.3) return [...alive].sort((a, b) => (b.mag + b.atk) - (a.mag + a.atk))[0]; // cala o maior dano
    // 3) padrão: 70% o mais ferido (%), resto aleatório (evita guarda de vez em quando)
    const byWeak = [...alive].sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp));
    if (r < 0.7) return byWeak.find((h) => !h.guard) || byWeak[0];
    return alive[Math.floor(Math.random() * alive.length)];
  }

  /** @param {{x:number,y:number}|null} [lungeTo] alvo do avanço (nulo = golpe à distância) */
  _hurtHero(t, rawDmg, e, ei, label, lungeTo = null) {
    const ti = this.party.indexOf(t);
    let dmg = rawDmg;
    let blocked = false;
    if (t.guard) { dmg = Math.max(1, Math.ceil(rawDmg / 2)); blocked = true; }
    t.hp -= dmg;
    t.hitT = 0.35;
    if (lungeTo) {
      const from = this.enemyPos(ei);
      this.anim = { who: 'enemy', idx: ei, t: 0.38, dur: 0.38, fx: from.x, fy: from.y, tx: lungeTo.x, ty: lungeTo.y };
    } else {
      this.anim = { who: 'enemy', idx: ei, t: 0.35, dur: 0.35 };
    }
    this._strikeFx(this.heroPos(ti), '#ff6b6b');
    this._floatDmg(this.heroPos(ti), blocked ? `🛡${dmg}` : dmg, blocked ? '#6bb8ff' : '#ff6b6b', false);
    if (dmg >= 20) this._shake(4, 0.2);
    this._log(`${e.name} ${label} ${t.name}! ${dmg} de dano!${blocked ? ' (bloqueado 🛡)' : ''}${t.hp <= 0 ? ` ${t.name} caiu!` : ''}`);
    this._renderAll();
  }

  _enemyAct(e, ei) {
    const alive = aliveHeroes(this.party);
    if (!alive.length) return;
    // Boss enfurecido abaixo de 30% de HP (uma vez por batalha)
    if (e.boss && !e.enraged && e.hp < e.maxHp * 0.3) {
      e.enraged = true;
      e.atk += 7;
      this.audio.sfx('crit');
      this.flashT = 0.35; this.flashColor = '255,60,60';
      this._shake(7, 0.4);
      this._banner(e.name, 'ENFURECE-SE! 🔥');
      this._log(`${e.name} ENFURECE-SE! O ódio do Caos queima mais forte! (ATK ↑)`);
      this._renderAll();
      return;
    }
    // Boss: regeneração sombria única aos 45% (segunda fase)
    if (e.boss && !e.secondWind && e.hp < e.maxHp * 0.45) {
      e.secondWind = true;
      const v = Math.round(e.maxHp * 0.18);
      e.hp = Math.min(e.maxHp, e.hp + v);
      this.audio.sfx('heal');
      this._healFx(this.enemyPos(ei), '#c084ff');
      this._banner(e.name, 'REGENERAÇÃO SOMBRIA!');
      this._log(`${e.name} suga as trevas do altar! +${v} HP! Acabe com ele!`);
      this._renderAll();
      return;
    }
    // Boss: a cada 3º turno, baforada em área
    if (e.boss && this.turnCount % 3 === 0) {
      this.audio.sfx('fire');
      this.anim = { who: 'enemy', idx: ei, t: 0.4, dur: 0.4 };
      this.flashT = 0.25; this.flashColor = '255,120,40';
      this._shake(6, 0.35);
      const ep = this.enemyPos(ei);
      const parts = [];
      for (const h of alive) {
        const dmg0 = Math.max(1, magDmg(11, 1.5, 2));
        const ti = this.party.indexOf(h);
        let dmg = dmg0;
        if (h.guard) dmg = Math.max(1, Math.ceil(dmg0 / 2));
        h.hp -= dmg;
        h.hitT = 0.35;
        parts.push(`${h.name} sofre ${dmg}`);
        const hp = this.heroPos(ti);
        this._cometFx({ x: ep.x + 40, y: ep.y }, hp, '#ff7b3c');
        this._burstFx(hp, '#ff7b3c');
        this._floatDmg(hp, h.guard ? `🛡${dmg}` : dmg, h.guard ? '#6bb8ff' : '#ff9b3c', false);
      }
      this._log(`${e.name} cospe CHAMAS DO CAOS! ${parts.join(' · ')}!`);
      this._renderAll();
      return;
    }
    // Fagulha: carrega e descarrega
    if (e.id === 'wisp') {
      if (!e.charge && Math.random() < 0.35) {
        e.charge = true;
        this.audio.sfx('cursor');
        this._ringFx(this.enemyPos(ei), '#7fd4ff');
        this._floatText(this.enemyPos(ei), -20, '⚡ CARREGANDO', '#7fd4ff', false);
        this._log(`${e.name} crepita e acumula energia azul...`);
        this._renderAll();
        return;
      }
      const t = this._pickTarget(e);
      const ti = this.party.indexOf(t);
      const heavy = e.charge;
      e.charge = false;
      const dmg = Math.round(physDmg(e.atk, t.def) * (heavy ? 1.8 : 1));
      this.audio.sfx(heavy ? 'fire' : 'hit');
      if (heavy) { this._boltFx(this.heroPos(ti), '#7fd4ff'); this._shake(4, 0.2); }
      this._hurtHero(t, dmg, e, ei, heavy ? 'descarrega VOLTAGEM em' : 'ataca', heavy ? null : this.heroPos(ti));
      return;
    }
    // Slime Rei: esmagamento real no mais resistente
    if (e.id === 'king' && Math.random() < 0.3) {
      const t = [...alive].sort((a, b) => b.maxHp - a.maxHp)[0];
      const dmg = Math.round(physDmg(e.atk + 3, t.def));
      this.audio.sfx('crit');
      this._shake(5, 0.25);
      this._hurtHero(t, dmg, e, ei, 'esmaga com o PESO REAL', this.heroPos(this.party.indexOf(t)));
      return;
    }
    // Slime: gosma ácida ignora metade da defesa
    if (e.id === 'slime' && Math.random() < 0.22) {
      const t = this._pickTarget(e);
      const dmg = Math.max(1, Math.round(e.atk * 2.2 - t.def * 0.6 + Math.random() * 4));
      this.audio.sfx('hit');
      this._burstFx(this.heroPos(this.party.indexOf(t)), '#4fe07a', 12);
      this._hurtHero(t, dmg, e, ei, 'cospindo GOSMA ÁCIDA em');
      return;
    }
    // Caranguejo: pinça esmagadora no mais resistente
    if (e.id === 'crab' && Math.random() < 0.3) {
      const t = [...alive].sort((a, b) => b.maxHp - a.maxHp)[0];
      const dmg = Math.round(physDmg(e.atk, t.def) * 1.5);
      this.audio.sfx('crit');
      this._shake(5, 0.25);
      this._hurtHero(t, dmg, e, ei, 'com a PINÇA ESMAGADORA', this.heroPos(this.party.indexOf(t)));
      return;
    }
    // Escorpião: ferrão fura metade da defesa
    if (e.id === 'scorpion' && Math.random() < 0.25) {
      const t = this._pickTarget(e);
      const dmg = Math.max(1, Math.round(e.atk * 2.2 - t.def * 0.6 + Math.random() * 4));
      this.audio.sfx('crit');
      this._burstFx(this.heroPos(this.party.indexOf(t)), '#8e2bff', 12);
      this._hurtHero(t, dmg, e, ei, 'com o FERRÃO VENENOSO em', this.heroPos(this.party.indexOf(t)));
      return;
    }
    // Esqueleto: lâmina enferrujada — crítico certeiro no mais ferido
    if (e.id === 'skeleton' && Math.random() < 0.25) {
      const t = [...alive].sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
      const dmg = Math.round(physDmg(e.atk + 2, t.def) * 1.5);
      this.audio.sfx('crit');
      this._shake(4, 0.2);
      this._hurtHero(t, dmg, e, ei, 'com a LÂMINA ENFERRUJADA', this.heroPos(this.party.indexOf(t)));
      return;
    }
    // Orc: fúria quando ferido (uma vez) + clava pesada no mais resistente
    if (e.id === 'orc' && !e.enraged && e.hp < e.maxHp * 0.5) {
      e.enraged = true;
      e.atk += 4;
      this.audio.sfx('crit');
      this._shake(5, 0.3);
      this._floatText(this.enemyPos(ei), -20, '😡 FÚRIA!', '#ff6b6b', false);
      this._log(`${e.name} entra em FÚRIA! (ATK ↑)`);
      this._renderAll();
      return;
    }
    if (e.id === 'orc' && Math.random() < 0.3) {
      const t = [...alive].sort((a, b) => b.maxHp - a.maxHp)[0];
      const dmg = Math.round(physDmg(e.atk, t.def) * 1.4);
      this.audio.sfx('crit');
      this._shake(4, 0.2);
      this._hurtHero(t, dmg, e, ei, 'com a CLAVA DE OSSO', this.heroPos(this.party.indexOf(t)));
      return;
    }
    // Sapo: língua comprida fura defesa dos mais frágeis
    if (e.id === 'toad' && Math.random() < 0.3) {
      const t = [...alive].sort((a, b) => a.def - b.def)[0];
      const dmg = Math.max(1, Math.round(e.atk * 2.2 - t.def * 0.6 + Math.random() * 4));
      this.audio.sfx('hit');
      this._burstFx(this.heroPos(this.party.indexOf(t)), '#4da64d', 12);
      this._hurtHero(t, dmg, e, ei, 'com a LÍNGUA COMPRIDA');
      return;
    }
    // Lobo: mordida dupla no mais ferido
    if (e.id === 'wolf' && Math.random() < 0.35) {
      const t = [...alive].sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
      const dmg = Math.round(physDmg(e.atk, t.def) * 1.35);
      this.audio.sfx('crit');
      this._hurtHero(t, dmg, e, ei, 'com a MORDIDA DUPLA', this.heroPos(this.party.indexOf(t)));
      return;
    }
    // Golem Ancião: runas da fúria + pisão em área
    if (e.id === 'ancient' && !e.enraged && e.hp < e.maxHp * 0.5) {
      e.enraged = true;
      e.atk += 5;
      this.audio.sfx('crit');
      this.flashT = 0.3; this.flashColor = '255,200,60';
      this._shake(7, 0.4);
      this._banner(e.name, 'RUNAS ACENDEM! 🗿');
      this._log(`${e.name} acende as RUNAS ANCESTRAIS! (ATK ↑)`);
      this._renderAll();
      return;
    }
    if (e.id === 'ancient' && this.turnCount % 4 === 0) {
      this.audio.sfx('crit');
      this.anim = { who: 'enemy', idx: ei, t: 0.4, dur: 0.4 };
      this._shake(6, 0.35);
      const parts = [];
      for (const hh of alive) {
        const dmg0 = Math.max(1, Math.round(e.atk * 1.6 - hh.def * 0.8 + Math.random() * 4));
        const ti = this.party.indexOf(hh);
        let dmg = dmg0;
        if (hh.guard) dmg = Math.max(1, Math.ceil(dmg0 / 2));
        hh.hp -= dmg;
        hh.hitT = 0.35;
        parts.push(`${hh.name} sofre ${dmg}`);
        const hp = this.heroPos(ti);
        this._burstFx(hp, '#ffd75e');
        this._floatDmg(hp, hh.guard ? `🛡${dmg}` : dmg, hh.guard ? '#6bb8ff' : '#ffd75e', false);
      }
      this._log(`${e.name} esmaga o chão com o PISÃO ANCESTRAL! ${parts.join(' · ')}!`);
      this._renderAll();
      return;
    }
    // Cogumelo: esporos curativos quando ferido
    if (e.id === 'shroom' && e.hp < e.maxHp * 0.7 && Math.random() < 0.3) {
      const v = Math.min(Math.round(e.maxHp * 0.15), e.maxHp - Math.max(0, e.hp));
      e.hp = Math.min(e.maxHp, Math.max(0, e.hp) + v);
      this.audio.sfx('heal');
      this._healFx(this.enemyPos(ei), '#c9e88a');
      this._floatDmg(this.enemyPos(ei), `+${v}`, '#7dff9a', false);
      this._log(`${e.name} solta ESPOROS CURATIVOS! +${v} HP!`);
      this._renderAll();
      return;
    }
    const t = this._pickTarget(e);
    const dmg = physDmg(e.atk, t.def);
    this.audio.sfx('hit');
    this._hurtHero(t, dmg, e, ei, 'ataca', this.heroPos(this.party.indexOf(t)));
  }

  _checkEnd() {
    if (this.enemies.every((e) => e.hp <= 0)) { this._finish(true, false); return true; }
    if (partyWiped(this.party)) { this._finish(false, false); return true; }
    return false;
  }

  _finish(victory, fled) {
    this.phase = 'done';
    this.phaseT = victory ? 2.2 : 1.6;
    if (victory) {
      const xp = this.enemies.reduce((s, e) => s + e.xp, 0);
      const gold = this.enemies.reduce((s, e) => s + e.gold, 0);
      const lvMsgs = grantXp(this.party, xp);
      this.audio.sfx(this.isBoss ? 'victory' : 'victory');
      if (lvMsgs.length) setTimeout(() => this.audio.sfx('levelup'), 500);
      this.victoryT = 2.0;
      for (let i = 0; i < 60; i++) {
        this.particles.push({ x: 200 + Math.random() * 560, y: -10 - Math.random() * 60, vx: (Math.random() - 0.5) * 60, vy: 80 + Math.random() * 120, life: 1.6 + Math.random(), maxLife: 2, color: ['#ffd75e', '#ff8fb3', '#7dff9a', '#6bb8ff'][i % 4], size: 3 + Math.random() * 3, grav: 40 });
      }
      this._banner('✦ VITÓRIA! ✦', `+${xp} XP · +${gold} G`);
      this._log(`✦ Vitória! +${xp} XP · +${gold} G${lvMsgs.length ? '<br/>' + lvMsgs.join('<br/>') : ''}`);
      this.endResult = { victory: true, fled: false, xp, gold, boss: this.isBoss, kills: this.enemies.map((e) => e.id) };
    } else if (fled) {
      this.endResult = { victory: false, fled: true, xp: 0, gold: 0, boss: this.isBoss, kills: [] };
    } else {
      this.audio.sfx('die');
      this.flashT = 0.5; this.flashColor = '120,0,10';
      this._log('O grupo tombou...');
      this.endResult = { victory: false, fled: false, xp: 0, gold: 0, boss: this.isBoss, kills: [] };
    }
    this._renderAll();
  }

  // ---------- efeitos ----------
  _shake(mag, dur) { this.shakeM = Math.max(this.shakeM, mag); this.shakeT = Math.max(this.shakeT, dur); }

  _floatDmg(pos, text, color, crit = false) {
    this._floatText(pos, -6, text, color, crit);
    // legenda DOM (flutuação acessível)
    const d = document.createElement('div');
    d.className = 'dmg-float' + (crit ? ' crit' : '') + (String(text).startsWith('+') ? ' heal' : '');
    d.textContent = String(text);
    d.style.color = color;
    // converte coords do canvas de batalha (1280x453) para % do wrap
    d.style.left = `${(pos.x / 1280) * 100}%`;
    d.style.top = `${(pos.y / 453) * 63}%`;
    document.getElementById('game-wrap').appendChild(d);
    setTimeout(() => d.remove(), 1050);
  }

  _floatText(pos, dy, text, color, crit) {
    this.floats.push({ x: pos.x + (Math.random() - 0.5) * 10, y: pos.y + dy, text: String(text), color, t: 0, crit });
  }

  _strikeFx(pos, color, n = 10) {
    for (let i = 0; i < n; i++) {
      this.particles.push({ x: pos.x, y: pos.y, vx: (Math.random() - 0.5) * 320, vy: -Math.random() * 260, life: 0.5 + Math.random() * 0.3, maxLife: 0.8, color, size: 3 + Math.random() * 3, grav: 300 });
    }
  }

  _burstFx(pos, color, n = 26) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      this.particles.push({ x: pos.x, y: pos.y, vx: Math.cos(a) * (60 + Math.random() * 200), vy: Math.sin(a) * (60 + Math.random() * 200) - 60, life: 0.6 + Math.random() * 0.4, maxLife: 1, color, size: 2 + Math.random() * 4, grav: 160 });
    }
  }

  _slashFx(pos, crit) {
    this.shots.push({ kind: 'slash', x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y, t: 0, dur: 0.28, color: crit ? '#ffd75e' : '#ffffff' });
    this.rings.push({ x: pos.x, y: pos.y, t: 0, dur: 0.35, color: crit ? '#ffd75e' : '#ffffff', maxR: crit ? 46 : 30 });
  }

  _cometFx(from, to, color) {
    this.shots.push({ kind: 'comet', x0: from.x - 20, y0: from.y - 10, x1: to.x, y1: to.y, t: 0, dur: 0.3, color });
  }

  _boltFx(to, color) {
    this.shots.push({ kind: 'bolt', x0: to.x, y0: to.y - 130, x1: to.x, y1: to.y, t: 0, dur: 0.32, color });
    this.rings.push({ x: to.x, y: to.y, t: 0, dur: 0.4, color, maxR: 42 });
    this._burstFx(to, color, 20);
  }

  _ringFx(pos, color) {
    this.rings.push({ x: pos.x, y: pos.y, t: 0, dur: 0.5, color, maxR: 40 });
  }

  _healFx(pos, color = '#7dff9a') {
    this._ringFx(pos, color);
    for (let i = 0; i < 18; i++) {
      this.particles.push({ x: pos.x + (Math.random() - 0.5) * 44, y: pos.y + 10 + Math.random() * 10, vx: (Math.random() - 0.5) * 30, vy: -60 - Math.random() * 60, life: 0.8 + Math.random() * 0.4, maxLife: 1.2, color, size: 2 + Math.random() * 3, grav: -40 });
    }
  }

  _soulFx(pos) {
    for (let i = 0; i < 14; i++) {
      this.particles.push({ x: pos.x + (Math.random() - 0.5) * 30, y: pos.y, vx: (Math.random() - 0.5) * 50, vy: -70 - Math.random() * 60, life: 0.9 + Math.random() * 0.4, maxLife: 1.2, color: '#cfe8ff', size: 2 + Math.random() * 3, grav: -60 });
    }
  }

  // ---------- desenho ----------
  /**
   * Deslocamento do atacante: avanço até o alvo e volta (lunge) ou golpe curto.
   * @param {'hero'|'enemy'} who @param {number} idx
   * @returns {{x:number, y:number}}
   */
  _animOffset(who, idx) {
    const a = this.anim;
    if (!a || a.who !== who || a.idx !== idx) return { x: 0, y: 0 };
    const el = Math.min(1, Math.max(0, 1 - a.t / (a.dur || 0.35)));
    if (a.tx == null) return { x: (who === 'hero' ? -40 : 34) * Math.sin(el * Math.PI), y: 0 };
    const dx = a.tx - a.fx, dy = a.ty - a.fy;
    let k;
    if (el < 0.45) { const u = el / 0.45; k = (1 - Math.pow(1 - u, 3)) * 0.85; }
    else { const u = (el - 0.45) / 0.55; k = 0.85 * (1 - u); }
    return { x: dx * k, y: dy * k };
  }

  _scenery() {
    return SCENERY[this.region] || SCENERY.field;
  }

  _drawSky(g, sc) {
    // palco HD: céu até y=335, largura total 1280
    const grad = g.createLinearGradient(0, 0, 0, 335);
    grad.addColorStop(0, sc.sky[0]); grad.addColorStop(0.55, sc.sky[1]); grad.addColorStop(1, sc.sky[2]);
    g.fillStyle = grad;
    g.fillRect(0, 0, 1280, 335);
    // sol / lua
    const mx = 1060, my = 70;
    const pulse = 1 + Math.sin(this.time * 2) * 0.05;
    g.fillStyle = sc.sun + '33';
    g.beginPath(); g.arc(mx, my, 45 * pulse, 0, 7); g.fill();
    g.fillStyle = sc.sun;
    g.beginPath(); g.arc(mx, my, 27 * pulse, 0, 7); g.fill();
    if (sc.night) {
      // estrelas cintilantes
      for (let i = 0; i < 60; i++) {
        const x = (i * 173 + 40) % 1280, y = (i * 97 + 13) % 250;
        const a = 0.25 + 0.55 * Math.abs(Math.sin(this.time * 1.4 + i * 1.3));
        g.globalAlpha = a;
        g.fillStyle = '#fff';
        g.fillRect(x, y, i % 5 === 0 ? 3 : 2, 2);
      }
      g.globalAlpha = 1;
    } else {
      // nuvens à deriva
      g.fillStyle = 'rgba(255,255,255,.75)';
      for (let i = 0; i < 5; i++) {
        const cx = ((i * 400 + this.time * (12 + i * 4)) % 1620) - 170;
        const cy = 48 + i * 44;
        g.beginPath();
        g.ellipse(cx, cy, 70, 17, 0, 0, 7);
        g.ellipse(cx + 40, cy + 5, 48, 13, 0, 0, 7);
        g.ellipse(cx - 43, cy + 6, 40, 12, 0, 0, 7);
        g.fill();
      }
    }
    // montanhas / copas distantes em duas camadas
    g.fillStyle = sc.far;
    g.beginPath(); g.moveTo(0, 335);
    for (let x = 0; x <= 1280; x += 80) {
      const h = 80 + 44 * Math.abs(Math.sin(x * 0.011 + 2));
      g.lineTo(x, 335 - h);
    }
    g.lineTo(1280, 335); g.closePath(); g.fill();
    g.fillStyle = sc.near;
    g.beginPath(); g.moveTo(0, 335);
    for (let x = 0; x <= 1280; x += 58) {
      const h = 40 + 28 * Math.abs(Math.sin(x * 0.02 + 5)) + Math.sin(this.time * 0.7 + x * 0.01) * 3;
      g.lineTo(x, 335 - h);
    }
    g.lineTo(1280, 335); g.closePath(); g.fill();
  }

  _drawGround(g, sc) {
    // chão em camadas (palco HD, centro x=640)
    g.fillStyle = sc.groundD;
    g.beginPath(); g.ellipse(640, 408, 630, 84, 0, 0, 7); g.fill();
    g.fillStyle = sc.ground;
    g.beginPath(); g.ellipse(640, 398, 600, 70, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.10)';
    g.beginPath(); g.ellipse(640, 385, 530, 45, 0, 0, 7); g.fill();
    // textura do chão por região
    if (sc.deco === 'flowers') {
      for (let i = 0; i < 34; i++) {
        const x = (i * 211 + 30) % 1240 + 20, y = 356 + ((i * 67) % 74);
        const sway = Math.sin(this.time * 2 + i) * 1.5;
        g.fillStyle = '#3f9142';
        g.fillRect(x, y, 2, 7);
        g.fillStyle = ['#ff8fb3', '#ffd75e', '#fff'][i % 3];
        g.fillRect(x - 2 + sway, y - 3, 5, 4);
      }
    } else if (sc.deco === 'mushroom') {
      for (let i = 0; i < 16; i++) {
        const x = (i * 311 + 60) % 1220 + 30, y = 360 + ((i * 53) % 66);
        if (i % 3 === 0) {
          g.fillStyle = '#f2ead8'; g.fillRect(x, y, 3, 7);
          g.fillStyle = '#c22a3a'; g.fillRect(x - 3, y - 4, 9, 5);
        } else {
          g.fillStyle = '#1d4727';
          g.fillRect(x, y - 4 + Math.sin(this.time * 1.6 + i) * 1.5, 3, 10);
        }
      }
      // vagalumes
      for (let i = 0; i < 10; i++) {
        const x = (i * 197 + this.time * 22) % 1280, y = 266 + ((i * 89) % 120) + Math.sin(this.time * 2 + i * 2) * 6;
        g.fillStyle = `rgba(255,240,150,${0.35 + 0.35 * Math.sin(this.time * 3 + i * 2)})`;
        g.fillRect(x, y, 3, 3);
      }
    } else if (sc.deco === 'torch') {
      for (const tx of [90, 1190]) {
        const fl = Math.sin(this.time * 9 + tx) * 2;
        g.fillStyle = '#2a2a3a'; g.fillRect(tx - 2, 309, 5, 66);
        g.fillStyle = 'rgba(255,120,30,.25)';
        g.fillRect(tx - 10, 274, 22, 30);
        g.fillStyle = '#ff7b2e'; g.fillRect(tx - 5, 285 + fl, 11, 15 - fl);
        g.fillStyle = '#ffd75e'; g.fillRect(tx - 2, 289 + fl, 5, 9 - fl);
      }
    } else if (sc.deco === 'embers') {
      // rachaduras de lava
      g.strokeStyle = '#ff7b2e'; g.lineWidth = 4;
      g.globalAlpha = 0.7 + 0.3 * Math.sin(this.time * 3);
      g.beginPath();
      g.moveTo(160, 400); g.lineTo(347, 386); g.lineTo(453, 402); g.lineTo(640, 389);
      g.moveTo(747, 402); g.lineTo(933, 386); g.lineTo(1120, 400);
      g.stroke();
      g.globalAlpha = 1;
      for (let i = 0; i < 20; i++) {
        const x = (i * 251 + this.time * -30) % 1300 + 10;
        const y = 426 - ((this.time * (26 + i * 2) + i * 70) % 186);
        g.fillStyle = `rgba(255,${120 + (i % 3) * 40},40,${0.5 + 0.3 * Math.sin(this.time * 4 + i)})`;
        g.fillRect(x, y, 3, 3);
      }
    } else if (sc.deco === 'shells') {
      // conchas e estrelas-do-mar espalhadas na areia
      for (let i = 0; i < 13; i++) {
        const x = (i * 293 + 40) % 1220 + 30, y = 360 + ((i * 71) % 68);
        if (i % 3 === 0) {
          g.fillStyle = '#f2b8c6'; g.fillRect(x, y, 7, 4);
          g.fillStyle = '#fff'; g.fillRect(x + 1, y, 3, 1);
        } else if (i % 3 === 1) {
          g.fillStyle = '#fff'; g.fillRect(x, y, 2, 2);
          g.fillStyle = '#e8763a'; g.fillRect(x - 3, y - 1, 8, 2); g.fillRect(x - 1, y - 3, 2, 7);
        } else {
          g.fillStyle = '#b8945a'; g.fillRect(x, y, 4, 2);
        }
      }
      // reflexos d'água na beira
      g.fillStyle = `rgba(255,255,255,${0.25 + 0.2 * Math.sin(this.time * 2)})`;
      g.fillRect(53, 349, 1173, 2);
    } else if (sc.deco === 'snowfall') {
      // flocos caindo sobre a neve
      for (let i = 0; i < 52; i++) {
        const x = (i * 173 + this.time * (12 + (i % 5) * 4) * (i % 2 ? 1 : -1) * 0.4 + 1280) % 1280;
        const y = 240 + ((this.time * (24 + (i % 4) * 8) + i * 61) % 200);
        const s = i % 4 === 0 ? 3 : 2;
        g.fillStyle = `rgba(255,255,255,${0.5 + 0.4 * Math.sin(this.time * 3 + i)})`;
        g.fillRect(x, y, s, s);
      }
      // brilho do gelo no chão
      g.fillStyle = `rgba(180,220,255,${0.2 + 0.15 * Math.sin(this.time * 2)})`;
      g.beginPath(); g.ellipse(640, 395, 507, 40, 0, 0, 7); g.fill();
    } else if (sc.deco === 'cactus') {
      // silhuetas de cactos + poeira quente
      for (const [cx, s] of [[120, 1.3], [1133, 1.7], [933, 1.05]]) {
        g.fillStyle = 'rgba(46,90,50,.85)';
        g.fillRect(cx, 333 - 61 * s, 13 * s, 61 * s);
        g.fillRect(cx - 16 * s, 333 - 45 * s, 11 * s, 27 * s);
        g.fillRect(cx + 19 * s, 333 - 40 * s, 11 * s, 21 * s);
      }
      for (let i = 0; i < 16; i++) {
        const x = (i * 331 + this.time * 60) % 1300 - 10;
        const y = 349 + ((i * 47) % 80);
        g.fillStyle = `rgba(230,200,140,${0.3 + 0.25 * Math.sin(this.time * 3 + i)})`;
        g.fillRect(x, y, 8, 2);
      }
    } else if (sc.deco === 'fog') {
      // névoa à deriva + vagalumes verdes
      for (let i = 0; i < 6; i++) {
        const x = ((i * 347 + this.time * (19 + i * 5)) % 1460) - 90;
        const y = 280 + i * 29;
        g.fillStyle = `rgba(200,220,205,${0.1 + 0.05 * Math.sin(this.time + i)})`;
        g.beginPath(); g.ellipse(x, y, 120, 16, 0, 0, 7); g.fill();
      }
      for (let i = 0; i < 13; i++) {
        const x = (i * 211 + this.time * 18) % 1280, y = 266 + ((i * 83) % 134) + Math.sin(this.time * 2 + i) * 8;
        g.fillStyle = `rgba(160,255,150,${0.35 + 0.35 * Math.sin(this.time * 3 + i * 2)})`;
        g.fillRect(x, y, 3, 3);
      }
    }
  }

  draw() {
    const g = this.g;
    const sc = this._scenery();
    // palco nativo HD 1280x453 (sem escala — layout já em coordenadas finais)
    g.save();
    if (this.shakeT > 0) {
      const m = this.shakeM * Math.min(1, this.shakeT * 4);
      g.translate((Math.random() - 0.5) * 2 * m, (Math.random() - 0.5) * 2 * m);
    }
    g.clearRect(-20, -20, 1320, 500);
    this._drawSky(g, sc);
    this._drawGround(g, sc);

    // sombras
    g.fillStyle = 'rgba(0,0,0,.30)';
    for (const [x, y, rx] of [...this.enemies.map((e, i) => { const p = this.enemyPos(i); return [p.x, p.y + (this.isBoss ? 68 : 44), this.isBoss ? 80 : 34]; }),
      ...this.party.map((h, i) => { const p = this.heroPos(i); return [p.x, p.y + 34, 24]; })]) {
      g.beginPath(); g.ellipse(x, y, rx, rx * 0.28, 0, 0, 7); g.fill();
    }

    // alvo atual: anel pulsante + escurece os demais
    const targeting = this.phase === 'command' && (this.menu === 'targetE' || this.menu === 'targetA');

    // inimigos
    this.enemies.forEach((e, i) => {
      if (e.hp <= 0) return; // caídos somem (a alma já subiu)
      const p = this.enemyPos(i);
      const spawnK = e.spawnT > 0 ? 1 - e.spawnT / 0.9 : 1;
      const bob = Math.sin(this.time * 3 + i * 1.7) * 5;
      const lunge = this._animOffset('enemy', i);
      const ox = lunge.x, oy = lunge.y;
      const img = this.enemyArt[i];
      const baseW = this.isBoss ? 180 : e.sprite === 'king' ? 104 : e.sprite === 'golem' ? 90 : e.sprite === 'scorpion' ? 94 : e.sprite === 'crab' ? 88 : e.sprite === 'wisp' ? 80 : e.sprite === 'bat' ? 86 : 80;
      const w = baseW * Math.max(0.2, spawnK);
      const hgt = w * (img.height / img.width);
      const breathe = 1 + Math.sin(this.time * 3 + i) * 0.02;
      // idle próprio de cada espécie: gosmas esmagam, voadores flutuam, caranguejo anda de lado
      const idle = Math.sin(this.time * 3 + i * 1.3);
      let dw = w, dh = hgt * breathe, dy = bob;
      if (e.sprite === 'slime' || e.sprite === 'king') {
        dw = w * (1 - idle * 0.045); dh = hgt * breathe * (1 + idle * 0.06);
      } else if (e.sprite === 'bat' || e.sprite === 'wisp' || e.sprite === 'shroom') {
        dy = bob + idle * 3;
      } else if (e.sprite === 'crab') {
        ox += Math.sin(this.time * 5 + i) * 3;
      } else if (e.sprite === 'scorpion') {
        dy = bob + Math.max(0, idle) * 2;
      }
      const cursorFoe = targeting && this.menu === 'targetE' ? this._foeAtCursor() : -2;
      const dim = targeting && this.menu === 'targetE' && cursorFoe !== i ? 0.45 : 1;
      g.save();
      g.globalAlpha = dim * Math.min(1, spawnK + 0.2);
      if (e.hitT > 0) { try { g.filter = 'brightness(2.6) saturate(.4)'; } catch { /* sem filtro */ } }
      if (e.charge) {
        g.shadowColor = '#7fd4ff'; g.shadowBlur = 18 + 10 * Math.sin(this.time * 8);
      } else if (e.sprite === 'wisp') {
        g.shadowColor = '#4fc3ff'; g.shadowBlur = 6 + 4 * Math.sin(this.time * 5 + i);
      }
      if (e.burn > 0) {
        g.shadowColor = '#ff7b2e'; g.shadowBlur = 14;
      }
      g.drawImage(img, p.x - dw / 2 + ox, p.y - dh / 2 + dy + oy - (1 - spawnK) * 40, dw, dh);
      try { g.filter = 'none'; } catch { /* sem filtro */ }
      g.shadowBlur = 0;
      g.restore();
      // chamas da queimadura
      if (e.burn > 0 && Math.random() < 0.4) {
        this.particles.push({ x: p.x + (Math.random() - 0.5) * 30, y: p.y + 10, vx: 0, vy: -50, life: 0.4, maxLife: 0.4, color: '#ff7b2e', size: 3, grav: -20 });
      }
      // respiro ambiente: motas da fagulha, esporos do cogumelo, brasas do dragão
      if (e.sprite === 'wisp' && Math.random() < 0.12) {
        this.particles.push({ x: p.x + (Math.random() - 0.5) * 24, y: p.y + (Math.random() - 0.5) * 20, vx: (Math.random() - 0.5) * 20, vy: -30, life: 0.6, maxLife: 0.6, color: '#7fd4ff', size: 2, grav: -30 });
      } else if (e.sprite === 'shroom' && Math.random() < 0.1) {
        this.particles.push({ x: p.x + (Math.random() - 0.5) * 26, y: p.y - 14, vx: (Math.random() - 0.5) * 16, vy: -18, life: 0.9, maxLife: 0.9, color: '#e8f0d0', size: 2, grav: -20 });
      } else if (e.sprite === 'dragon' && Math.random() < 0.15) {
        this.particles.push({ x: p.x + (Math.random() - 0.5) * 50, y: p.y + 20, vx: (Math.random() - 0.5) * 20, vy: -40, life: 0.7, maxLife: 0.7, color: '#ff7b3c', size: 3, grav: -30 });
      }
      // barra de HP minimalista ACIMA do monstro (verde → vermelha) + fantasma de dano
      const bw = this.isBoss ? 0 : 60; // chefe usa a barra DOM no topo
      if (bw) {
        const frac = Math.max(0, e.hp / e.maxHp);
        const shown = Math.max(0, (e._showHp ?? e.hp) / e.maxHp);
        const by = p.y - hgt / 2 + bob - 12;
        g.fillStyle = 'rgba(0,0,0,.65)'; g.fillRect(p.x - 30, by, 60, 6);
        g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(p.x - 29, by + 1, 58 * shown, 4);
        g.fillStyle = frac < 0.3 ? '#ff6b6b' : '#37e08b';
        g.fillRect(p.x - 29, by + 1, 58 * frac, 4);
        g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1;
        g.strokeRect(p.x - 30 + 0.5, by + 0.5, 59, 5);
      }
      // marcadores de status (acima da barra)
      let my = p.y - hgt / 2 + bob - 22 + Math.sin(this.time * 4 + i) * 2;
      g.font = 'bold 15px monospace'; g.textAlign = 'center';
      if (e.burn > 0) { g.fillText('🔥', p.x - 10, my); }
      if (e.stun) { g.fillText('💫', p.x + 10, my); }
      if (e.charge) { g.fillStyle = '#7fd4ff'; g.fillText('⚡', p.x, my - 12); }
    });

    // heróis
    this.party.forEach((h, i) => {
      const p = this.heroPos(i);
      const victoryJump = this.victoryT > 0 && h.hp > 0 ? -Math.abs(Math.sin(this.time * 6 + i)) * 18 : 0;
      const bob = (h.hp > 0 ? Math.sin(this.time * 4 + i * 2) * 2 : 0) + victoryJump;
      const off = this._animOffset('hero', i);
      const ox = off.x, oy = off.y;
      const heroSet = this.heroArt[h.sprite]?.down || this.heroArt.hero.down;
      const fr = Array.isArray(heroSet) ? heroSet : [heroSet];
      // avançando: usa o frame de passo (investida)
      const img = (Math.hypot(ox, oy) > 6 && fr[1]) ? fr[1] : fr[0];
      const s = this.heroScale(i);
      const dim = targeting && this.menu === 'targetA' && this.sel !== i ? 0.45 : 1;
      g.save();
      if (h.hp <= 0) { g.globalAlpha = 0.4 * dim; }
      else g.globalAlpha = dim;
      if (h.hitT > 0) { try { g.filter = 'brightness(2.6) saturate(.4)'; } catch { /* sem filtro */ } }
      // anel de guarda
      if (h.guard && h.hp > 0) {
        g.strokeStyle = `rgba(107,184,255,${0.6 + 0.3 * Math.sin(this.time * 6)})`;
        g.lineWidth = 3;
        g.beginPath(); g.ellipse(p.x + ox, p.y + bob + oy + 10, 30 * s, 30 * s, 0, 0, 7); g.stroke();
      }
      // heróis olham para a esquerda (inimigos) — sprite HD 52x65
      g.translate(p.x + ox, p.y + bob + oy);
      g.scale(-s, s);
      g.drawImage(img, -26, -32, 52, 65);
      g.restore();
      try { g.filter = 'none'; } catch { /* sem filtro */ }
      // seta de turno sobre o herói atual
      if (this.phase === 'command' && i === this.heroIdx && h.hp > 0) {
        const by = p.y - 58 * s + Math.sin(this.time * 6) * 3;
        g.fillStyle = '#ffd75e';
        g.strokeStyle = '#000'; g.lineWidth = 3;
        g.beginPath();
        g.moveTo(p.x - 12, by); g.lineTo(p.x + 12, by); g.lineTo(p.x, by + 14);
        g.closePath(); g.fill(); g.stroke();
      }
    });

    // projéteis e cortes
    for (const s of this.shots) {
      const k = Math.min(1, s.t / s.dur);
      if (s.kind === 'comet') {
        const x = s.x0 + (s.x1 - s.x0) * k, y = s.y0 + (s.y1 - s.y0) * k;
        g.strokeStyle = s.color; g.lineWidth = 5; g.lineCap = 'round';
        g.beginPath(); g.moveTo(x - (s.x1 - s.x0) * 0.12, y - (s.y1 - s.y0) * 0.12); g.lineTo(x, y); g.stroke();
        g.fillStyle = '#fff';
        g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill();
        g.fillStyle = s.color;
        g.beginPath(); g.arc(x, y, 4.5, 0, 7); g.fill();
      } else if (s.kind === 'bolt') {
        g.strokeStyle = s.color; g.lineWidth = 4; g.lineCap = 'round';
        g.shadowColor = s.color; g.shadowBlur = 12;
        g.beginPath();
        let px = s.x0, py = s.y0;
        g.moveTo(px, py);
        for (let j = 1; j <= 6; j++) {
          const ny = s.y0 + (s.y1 - s.y0) * (j / 6);
          const nx = s.x0 + (Math.random() - 0.5) * 26 * (j < 6 ? 1 : 0);
          g.lineTo(nx, ny); px = nx; py = ny;
        }
        g.stroke();
        g.shadowBlur = 0;
        if (k > 0.85) { g.fillStyle = '#fff'; g.beginPath(); g.arc(s.x1, s.y1, 12 * (1 - k) + 4, 0, 7); g.fill(); }
      } else if (s.kind === 'slash') {
        g.strokeStyle = s.color; g.lineWidth = 6; g.lineCap = 'round';
        g.globalAlpha = 1 - k;
        g.beginPath(); g.arc(s.x0, s.y0, 12 + k * 30, -0.9, 0.9); g.stroke();
        g.globalAlpha = 1;
      }
    }
    // ondas de choque
    for (const r of this.rings) {
      const k = Math.min(1, r.t / r.dur);
      g.globalAlpha = 1 - k;
      g.strokeStyle = r.color; g.lineWidth = 3;
      g.beginPath(); g.ellipse(r.x, r.y, r.maxR * k, r.maxR * 0.45 * k, 0, 0, 7); g.stroke();
      g.globalAlpha = 1;
    }
    // partículas
    for (const p of this.particles) {
      g.globalAlpha = Math.min(1, (p.life / (p.maxLife || 0.8)) * 1.4);
      g.fillStyle = p.color;
      g.fillRect(p.x, p.y, p.size, p.size);
      g.globalAlpha = 1;
    }
    // texto flutuante no canvas (sombra + cor)
    g.textAlign = 'center';
    for (const f of this.floats) {
      const k = f.t / 1.1;
      g.globalAlpha = 1 - k * k;
      g.font = f.crit ? 'bold 32px monospace' : 'bold 24px monospace';
      g.strokeStyle = '#000'; g.lineWidth = 5;
      g.strokeText(f.text, f.x, f.y);
      g.fillStyle = f.color;
      g.fillText(f.text, f.x, f.y);
      g.globalAlpha = 1;
    }
    // cursor de alvo (▼ pulsante sobre o selecionado — só vivos)
    if (targeting) {
      const isE = this.menu === 'targetE';
      let p = null; let lift = 60; let ringY = 34; let ringR = 28;
      if (isE) {
        const realIdx = this._foeAtCursor();
        if (realIdx >= 0) {
          p = this.enemyPos(realIdx);
          lift = this.isBoss ? 100 : 66; ringY = 46; ringR = 38;
        }
      } else if (this.sel < this.party.length) {
        p = this.heroPos(this.sel);
      }
      if (p) {
        const by = p.y - lift + Math.sin(this.time * 6) * 4;
        g.fillStyle = '#ffd75e';
        g.strokeStyle = '#000'; g.lineWidth = 3;
        g.beginPath();
        g.moveTo(p.x - 13, by); g.lineTo(p.x + 13, by); g.lineTo(p.x, by + 15);
        g.closePath(); g.fill(); g.stroke();
        // anel no chão do alvo
        g.strokeStyle = '#ffd75e'; g.lineWidth = 2;
        g.beginPath(); g.ellipse(p.x, p.y + ringY, ringR, 11, 0, 0, 7); g.stroke();
      }
    }
    // banner central (início, fúria, vitória)
    if (this.banner) {
      const k = this.banner.t / this.banner.dur;
      const a = k < 0.12 ? k / 0.12 : k > 0.75 ? Math.max(0, (1 - k) / 0.25) : 1;
      g.globalAlpha = Math.min(1, a);
      g.textAlign = 'center';
      g.font = 'bold 56px monospace';
      g.strokeStyle = '#000'; g.lineWidth = 10;
      const yy = 170 + (1 - Math.min(1, k * 3)) * -20;
      g.strokeText(this.banner.text, 640, yy);
      g.fillStyle = '#ffd75e';
      g.fillText(this.banner.text, 640, yy);
      if (this.banner.sub) {
        g.font = 'bold 22px monospace';
        g.strokeText(this.banner.sub, 640, yy + 38);
        g.fillStyle = '#fff';
        g.fillText(this.banner.sub, 640, yy + 38);
      }
      g.globalAlpha = 1;
    }
    // flash de dano em área
    if (this.flashT > 0) {
      g.fillStyle = `rgba(${this.flashColor},${Math.min(0.55, this.flashT * 1.4)})`;
      g.fillRect(-20, -20, 1320, 500);
    }
    // vinheta de derrota
    if (this.phase === 'done' && this.endResult && !this.endResult.victory && !this.endResult.fled) {
      const grd = g.createRadialGradient(640, 226, 160, 640, 226, 690);
      grd.addColorStop(0, 'rgba(120,0,10,0)');
      grd.addColorStop(1, 'rgba(120,0,10,.55)');
      g.fillStyle = grd;
      g.fillRect(-20, -20, 1320, 500);
    }
    g.restore();
  }
}

const spellColor = (s) => (s === 'fire' ? '#ff9b3c' : s === 'thunder' ? '#ffe94f' : s === 'ice' ? '#7fd4ff' : '#7dff9a');
const spellSfx = (s) => (s === 'cure' ? 'heal' : 'fire');
