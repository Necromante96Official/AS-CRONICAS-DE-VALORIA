/**
 * TitleScreen — título, Novo Jogo / Continuar / Como Jogar.
 * @module ui/TitleScreen
 */
import { SaveSystem } from '../systems/SaveSystem.js';

export class TitleScreen {
  /** @param {import('../core/Audio.js').AudioMan} audio */
  constructor(audio) {
    this.audio = audio;
    this.el = document.getElementById('title');
    this.listEl = document.getElementById('title-list');
    this.opts = [];
    this.sel = 0;
    this.visible = true;
    /** @type {(action:string, slot?:number)=>void} */
    this.onPick = () => {};
    // mouse: passar por cima seleciona; clicar confirma
    this.listEl.addEventListener('mouseover', (e) => {
      const o = e.target.closest('.opt');
      if (!o || !this.visible) return;
      const i = [...this.listEl.querySelectorAll('.opt')].indexOf(o);
      if (i >= 0 && i !== this.sel) { this.sel = i; this._render(); }
    });
    // mouse: clicar numa opção = confirmar direto
    this.listEl.addEventListener('click', (e) => {
      const o = e.target.closest('.opt');
      if (!o || !this.visible) return;
      const i = [...this.listEl.querySelectorAll('.opt')].indexOf(o);
      if (i < 0) return;
      this.audio.unlock();
      this.sel = i;
      this._render();
      this._confirm();
    });
  }

  show() {
    this.visible = true;
    this.el.classList.remove('hidden');
    this._menu('main');
  }

  hide() { this.visible = false; this.el.classList.add('hidden'); }

  /** @param {'main'|'slots'|'how'} mode */
  _menu(mode) {
    this.mode = mode;
    if (mode === 'main') {
      this.opts = [
        { label: '✦ Novo Jogo', value: 'new' },
        ...(SaveSystem.hasAny() ? [{ label: '▶ Continuar', value: 'continue' }] : []),
        { label: '? Como Jogar', value: 'how' },
      ];
    } else if (mode === 'slots') {
      this.opts = SaveSystem.slots.map((s) => {
        const info = SaveSystem.info(s);
        return { label: `Slot ${s} — ${info || '(vazio)'}`, value: s };
      }).concat([{ label: '« Voltar', value: 'back' }]);
    } else {
      this.opts = [{ label: '« Voltar', value: 'back' }];
      this.listEl.innerHTML = `<div style="text-align:left;font-size:13px;line-height:1.8;padding:4px 6px">
        <b>Mover:</b> Setas / WASD<br/>
        <b>Falar / confirmar:</b> E ou Enter<br/>
        <b>Menu:</b> Q ou Esc<br/>
        Encontros acontecem na <b>grama alta</b>.<br/>
        Na batalha escolha <b>Atacar, Magia, Item ou Fugir</b>.<br/>
        Fale com todos, compre poções e desafie o <b>Dragão do Caos</b> nas Ruínas ao nordeste!</div>
        <div class="opt sel">« Voltar</div>`;
      this.sel = 0;
      return;
    }
    this.sel = 0;
    this._render();
  }

  _render() {
    if (this.mode === 'how') return;
    this.listEl.innerHTML = this.opts.map((o, i) =>
      `<div class="opt ${i === this.sel ? 'sel' : ''}">${o.label}</div>`).join('');
  }

  /** @param {import('../core/Input.js').Input} input @returns {boolean} consumiu input */
  handle(input) {
    if (!this.visible) return false;
    if (input.pressed.up) { this.sel = (this.sel + this.opts.length - 1) % this.opts.length; this.audio.sfx('cursor'); this._render(); }
    else if (input.pressed.down) { this.sel = (this.sel + 1) % this.opts.length; this.audio.sfx('cursor'); this._render(); }
    else if (input.pressed.confirm) this._confirm();
    else if (input.pressed.cancel && this.mode !== 'main') { this._menu('main'); }
    return true;
  }

  _confirm() {
    if (!this.visible) return;
    const v = this.mode === 'how' ? 'back' : this.opts[this.sel].value;
    this.audio.sfx('confirm');
    if (this.mode === 'main') {
      if (v === 'new') this.onPick('new');
      else if (v === 'continue') this._menu('slots');
      else this._menu('how');
    } else if (this.mode === 'slots') {
      if (v === 'back') this._menu('main');
      else this.onPick('load', v);
    } else if (v === 'back') this._menu('main');
  }
}
