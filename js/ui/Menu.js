/**
 * Menu — pausa estilo FF com abas: Itens · Magia · Status · Config · Salvar.
 * ←→ troca de aba · ↑↓ navega · E confirma · Q fecha.
 * @module ui/Menu
 */
import { ITEMS } from '../systems/Inventory.js';
import { SPELLS, aliveHeroes } from '../entities/Party.js';
import { xpForLevel } from '../core/Config.js';
import { SPEED_ORDER } from '../systems/Settings.js';
import { SaveSystem } from '../systems/SaveSystem.js';

const TABS = [
  { id: 'items', label: '🎒 Itens' },
  { id: 'magic', label: '✨ Magia' },
  { id: 'status', label: '📊 Status' },
  { id: 'config', label: '⚙ Config' },
  { id: 'save', label: '💾 Salvar' },
];

export class Menu {
  /** @param {import('../core/Audio.js').AudioMan} audio */
  constructor(audio) {
    this.audio = audio;
    this.el = document.getElementById('menu');
    this.tabsEl = document.getElementById('menu-tabs');
    this.listEl = document.getElementById('menu-list');
    this.detailEl = document.getElementById('menu-detail');
    this.footEl = document.getElementById('menu-foot');
    this.bodyEl = document.getElementById('menu-body');
    this.open = false;
    this.tab = 0;
    this.sel = 0;
    this.rows = [];
    this.spellHero = null; // índice do herói ao navegar magias
    this.sub = null;       // {kind:'item',id} | {kind:'spell',hero,spell} ao escolher alvo
    /** @type {any} */
    this.ctx = null;
    /** @type {any} */
    this._actions = null;
    /** @type {(msg:string)=>void} */
    this.notify = () => {};
    // mouse: passar por cima das linhas seleciona
    this.el.addEventListener('mouseover', (e) => {
      const o = e.target.closest('#menu-list .opt');
      if (!o || !this.open) return;
      const i = [...this.listEl.querySelectorAll('.opt')].indexOf(o);
      if (i >= 0 && i !== this.sel) { this.sel = i; this._render(); }
    });
    // mouse: clicar alterna aba ou confirma linha
    this.el.addEventListener('click', (e) => {
      if (!this.open) return;
      this.audio.unlock();
      const tab = e.target.closest('#menu-tabs .tab');
      if (tab) {
        const i = [...this.tabsEl.querySelectorAll('.tab')].indexOf(tab);
        if (i >= 0) { this._switchTab(i); }
        return;
      }
      const o = e.target.closest('#menu-list .opt');
      if (!o) return;
      const i = [...this.listEl.querySelectorAll('.opt')].indexOf(o);
      if (i < 0) return;
      this.sel = i;
      this._render();
      this._confirm();
    });
  }

  get active() { return this.open; }

  /** @param {any} ctx {party, inv, gold, time} @param {(msg:string)=>void} notify @param {any} actions */
  show(ctx, notify, actions) {
    this.open = true;
    this.ctx = ctx;
    this.notify = notify;
    this._actions = actions || this._actions;
    this.tab = 0; this.sel = 0;
    this.spellHero = null; this.sub = null;
    this.el.classList.remove('hidden');
    this._render();
  }

  close() {
    this.open = false;
    this.spellHero = null; this.sub = null;
    this.el.classList.add('hidden');
  }

  _switchTab(i) {
    this.tab = (i + TABS.length) % TABS.length;
    this.sel = 0;
    this.spellHero = null; this.sub = null; this._armSave = null;
    this.audio.sfx('cursor');
    this._render();
    // re-dispara a animação de entrada do corpo
    if (this.bodyEl) {
      this.bodyEl.classList.remove('tab-enter');
      void this.bodyEl.offsetWidth;
      this.bodyEl.classList.add('tab-enter');
    }
  }

  _heroLine(h) {
    return `${h.hp <= 0 ? '✝ ' : ''}${h.name} <span class="row-sub">${h.cls} Nv${h.level} · ${Math.ceil(h.hp)}/${h.maxHp} HP · ${Math.ceil(h.mp)}/${h.maxMp} MP</span>`;
  }

  _render() {
    const { party, inv, gold, time } = this.ctx;
    this.tabsEl.innerHTML = TABS.map((t, i) =>
      `<div class="tab ${i === this.tab ? 'sel' : ''}">${t.label}</div>`).join('');
    const tabId = TABS[this.tab].id;

    if (this.sub) {
      const what = this.sub.kind === 'item' ? ITEMS[this.sub.id].name : SPELLS[this.sub.spell].name;
      this.rows = party.map((_, i) => i);
      this.listEl.innerHTML = `<div class="list-head">Usar ${what} em quem?</div>` +
        party.map((h, i) => `<div class="opt ${i === this.sel ? 'sel' : ''}">${this._heroLine(h)}${h.hp <= 0 ? ' <span class="row-sub">(CAÍDO)</span>' : ''}</div>`).join('');
      this.detailEl.innerHTML = `<h3>${what}</h3>Q cancela a escolha.`;
      this._foot(gold, time);
      return;
    }

    if (tabId === 'items') {
      const ids = Object.keys(ITEMS);
      this.rows = ids;
      this.listEl.innerHTML = ids.map((id, i) =>
        `<div class="opt ${i === this.sel ? 'sel' : ''}">${ITEMS[id].name}<span class="count">×${inv[id] || 0}</span></div>`).join('');
      const it = ITEMS[ids[this.sel]];
      this.detailEl.innerHTML = `<h3>${it.name}</h3>${it.desc}<br/><span class="row-sub">Preço na loja: ${it.price}G</span>`;
    } else if (tabId === 'magic') {
      if (this.spellHero == null) {
        this.rows = party.map((_, i) => i);
        this.listEl.innerHTML = party.map((h, i) =>
          `<div class="opt ${i === this.sel ? 'sel' : ''}">${h.name}<span class="row-cost">${Math.ceil(h.mp)}/${h.maxMp} MP</span></div>`).join('');
        const h = party[this.sel];
        this.detailEl.innerHTML = `<h3>Magias de ${h.name}</h3>` +
          (h.spells.length ? h.spells.map((s) => `${SPELLS[s].name} <span class="row-cost">${SPELLS[s].mp}MP</span>`).join('<br/>') : '<span class="row-sub">Nenhuma magia ainda.</span>');
      } else {
        const h = party[this.spellHero];
        this.rows = h.spells;
        this.listEl.innerHTML = `<div class="list-head">◀ ${h.name}</div>` +
          h.spells.map((s, i) =>
            `<div class="opt ${i === this.sel ? 'sel' : ''}">${SPELLS[s].name}<span class="row-cost">${SPELLS[s].mp}MP</span></div>`).join('');
        const s = h.spells[this.sel];
        this.detailEl.innerHTML = s ? `<h3>${SPELLS[s].name}</h3>${SPELLS[s].desc}<br/><span class="row-sub">Custo: ${SPELLS[s].mp} MP</span>` : '';
      }
    } else if (tabId === 'status') {
      this.rows = party.map((_, i) => i);
      this.listEl.innerHTML = party.map((h, i) =>
        `<div class="opt ${i === this.sel ? 'sel' : ''}">${this._heroLine(h)}</div>`).join('');
      const h = party[this.sel];
      this.detailEl.innerHTML = `<h3>${h.name} <span class="row-sub">${h.cls} · Nv ${h.level}</span></h3>
        <div class="stat-grid">
          <b>HP</b><span>${Math.ceil(h.hp)} / ${h.maxHp}</span>
          <b>MP</b><span>${Math.ceil(h.mp)} / ${h.maxMp}</span>
          <b>ATK</b><span>${h.atk}</span><b>DEF</b><span>${h.def}</span>
          <b>MAG</b><span>${h.mag}</span><b>VEL</b><span>${h.spd}</span>
          <b>XP</b><span>${h.xp} / ${xpForLevel(h.level)}</span>
          <b>Magias</b><span>${h.spells.map((s) => SPELLS[s].name).join(', ') || '—'}</span>
        </div>`;
    } else if (tabId === 'config') {
      const cfg = this._actions?.getConfig() || { sound: 'Ligado', speed: 'normal' };
      this.rows = ['sound', 'speed'];
      const labels = { sound: '🔊 Som', speed: '📝 Texto' };
      this.listEl.innerHTML = this.rows.map((id, i) =>
        `<div class="opt ${i === this.sel ? 'sel' : ''}">${labels[id]}<span class="count">${id === 'sound' ? cfg.sound : cfg.speed}</span></div>`).join('');
      this.detailEl.innerHTML = `<h3>Configurações</h3>E ou ←→ alterna o valor.<br/><span class="row-sub">Texto controla a velocidade do typewriter.</span>`;
    } else if (tabId === 'save') {
      this.rows = [1, 2, 3];
      this.listEl.innerHTML = this.rows.map((s, i) => {
        const info = SaveSystem.info(s);
        const armed = this._armSave === s ? ' <span class="count">confirma?</span>' : '';
        return `<div class="opt ${i === this.sel ? 'sel' : ''}">Slot ${s}${armed}<br/><span class="row-sub">${info || '(vazio)'}</span></div>`;
      }).join('');
      this.detailEl.innerHTML = `<h3>Salvar progresso</h3>Grava posição, grupo, itens e ouro.<br/><span class="row-sub">Slot ocupado pede confirmação. Q volta sem salvar.</span>`;
    }
    this._foot(gold, time);
  }

  _foot(gold, time) {
    this.footEl.innerHTML = `<span class="gold">💰 ${gold} G · ⏱ ${time || ''}</span><span>←→ abas · ↑↓ navegar · E confirmar · Q fechar</span>`;
  }

  /** @param {import('../core/Input.js').Input} input @param {any} actions */
  handle(input, actions) {
    if (!this.open) return false;
    this._actions = actions;
    const max = this.rows.length || 1;
    if ((input.pressed.left || input.pressed.right) && !this.sub && this.spellHero == null) {
      // na aba Config, ←→ também troca de aba (Enter alterna o valor)
      this._switchTab(this.tab + (input.pressed.right ? 1 : -1));
      return true;
    }
    if (input.pressed.up) { this.sel = (this.sel + max - 1) % max; this.audio.sfx('cursor'); this._render(); return true; }
    if (input.pressed.down) { this.sel = (this.sel + 1) % max; this.audio.sfx('cursor'); this._render(); return true; }
    if (input.pressed.cancel || input.pressed.menu) {
      this.audio.sfx('cancel');
      if (this.sub) { this.sub = null; this.sel = 0; }
      else if (this.spellHero != null) { this.spellHero = null; this.sel = 0; }
      else { this.close(); return true; }
      this._render();
      return true;
    }
    if (input.pressed.confirm) { this._confirm(); return true; }
    return true;
  }

  _confirm() {
    if (!this.open || !this._actions) return;
    const actions = this._actions;
    const { party, inv } = this.ctx;
    const tabId = TABS[this.tab].id;
    this.audio.sfx('confirm');

    if (this.sub) {
      const h = party[this.sel];
      if (this.sub.kind === 'item') {
        if (ITEMS[this.sub.id].heal && h.hp <= 0) { this.notify(`${h.name} está caído!`); this.audio.sfx('flee-fail'); return; }
        actions.useItem(this.sub.id, this.sel);
      } else {
        if (h.hp <= 0) { this.notify(`${h.name} está caído!`); this.audio.sfx('flee-fail'); return; }
        actions.useSpell(this.sub.hero, this.sub.spell, this.sel);
      }
      this.sub = null; this.sel = 0;
      this._render();
      return;
    }

    if (tabId === 'items') {
      const id = this.rows[this.sel];
      if ((inv[id] || 0) <= 0) { this.notify(`Você não tem ${ITEMS[id].name}!`); this.audio.sfx('flee-fail'); return; }
      if (ITEMS[id].flee) { this.notify(`${ITEMS[id].name} só funciona em batalha!`); this.audio.sfx('flee-fail'); return; }
      this.sub = { kind: 'item', id }; this.sel = 0;
    } else if (tabId === 'magic') {
      if (this.spellHero == null) {
        if (!party[this.sel]) return;
        this.spellHero = this.sel; this.sel = 0;
      } else {
        const h = party[this.spellHero];
        const sid = h.spells[this.sel];
        if (!sid) { this.spellHero = null; this.sel = 0; }
        else if (h.mp < SPELLS[sid].mp) { this.notify(`${h.name} não tem MP!`); this.audio.sfx('flee-fail'); return; }
        else if (sid !== 'cure') { this.notify(`${SPELLS[sid].name} só funciona em batalha.`); this.audio.sfx('flee-fail'); return; }
        else { this.sub = { kind: 'spell', hero: this.spellHero, spell: sid }; this.sel = 0; }
      }
    } else if (tabId === 'status') {
      this.notify(`${party[this.sel].name}: pronto para a aventura!`);
    } else if (tabId === 'config') {
      actions.cycleConfig(this.rows[this.sel]);
    } else if (tabId === 'save') {
      const slot = this.rows[this.sel];
      if (SaveSystem.info(slot) && this._armSave !== slot) {
        this._armSave = slot;
        this.notify(`Slot ${slot} ocupado! Enter de novo para substituir.`);
        this.audio.sfx('flee-fail');
        this._render();
        return;
      }
      this._armSave = null;
      actions.save(slot);
      this.close();
      return;
    }
    this._render();
  }
}
