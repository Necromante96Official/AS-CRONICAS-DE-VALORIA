/**
 * Dialog — caixa de diálogo com efeito typewriter + escolhas + retrato.
 * @module ui/Dialog
 */
import { SPEEDS } from '../systems/Settings.js';

export class Dialog {
  /** @param {import('../core/Audio.js').AudioMan} audio */
  constructor(audio) {
    this.audio = audio;
    this.el = document.getElementById('dialog');
    this.nameEl = document.getElementById('dialog-name');
    this.textEl = document.getElementById('dialog-text');
    this.faceEl = document.getElementById('dialog-face');
    /** @type {(name:string)=>HTMLCanvasElement|null} */
    this.portraitProvider = null;
    this.speed = 'normal';
    /** @type {{name:string,text:string,options?:{label:string,value:any}[]}[]} */
    this.queue = [];
    this.charsShown = 0;
    this.fullText = '';
    this.currentOptions = null;
    this.optSel = 0;
    this.onDone = null;
    this.choiceCb = null;
    this.open = false;
    this.tick = 0;
    // mouse: passar por cima de uma opção seleciona
    this.el.addEventListener('mouseover', (e) => {
      if (!this.open || !this._complete() || !this.currentOptions) return;
      const o = e.target.closest?.('#dlg-opts .opt');
      if (!o) return;
      const i = [...this.textEl.querySelectorAll('#dlg-opts .opt')].indexOf(o);
      if (i >= 0 && i !== this.optSel) { this.optSel = i; this._render(); }
    });
    // mouse: clicar avança; clicar numa opção escolhe direto
    this.el.addEventListener('click', (e) => {
      if (!this.open) return;
      this.audio.unlock();
      const o = e.target.closest?.('#dlg-opts .opt');
      if (o && this._complete() && this.currentOptions) {
        const i = [...this.textEl.querySelectorAll('#dlg-opts .opt')].indexOf(o);
        this._press(i >= 0 ? i : null);
      } else {
        this._press(null);
      }
    });
  }

  get active() { return this.open; }

  /**
   * Enfileira falas.
   * @param {{name:string,text:string,options?:{label:string,value:any}[]}[]} lines
   * @param {(() => void)|null} [onDone]
   * @param {(v:any)=>void|null} [choiceCb] chamado quando uma opção é escolhida
   */
  say(lines, onDone = null, choiceCb = null) {
    this.queue.push(...lines);
    if (onDone) this.onDone = onDone;
    if (choiceCb) this.choiceCb = choiceCb;
    if (!this.open) this._next();
  }

  _next() {
    const line = this.queue.shift();
    if (!line) {
      this.close();
      const cb = this.onDone; this.onDone = null;
      cb?.();
      return;
    }
    this.open = true;
    this.el.classList.remove('hidden');
    this.nameEl.textContent = line.name;
    this.nameEl.style.display = line.name ? '' : 'none';
    this.fullText = line.text;
    this.charsShown = 0;
    this.currentOptions = line.options || null;
    this.optSel = 0;
    // retrato do falante (medalhão 72px preenche o canvas)
    const face = this.portraitProvider?.(line.name) || null;
    if (face && this.faceEl) {
      const g = this.faceEl.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.clearRect(0, 0, this.faceEl.width, this.faceEl.height);
      g.drawImage(face, 0, 0, this.faceEl.width, this.faceEl.height);
      this.faceEl.style.display = 'block';
    } else if (this.faceEl) {
      this.faceEl.style.display = 'none';
    }
    this._render();
  }

  _render() {
    let html = this.fullText.slice(0, Math.floor(this.charsShown)).replace(/</g, '&lt;');
    // retrato "fala" (pulso) enquanto o typewriter corre
    if (this.faceEl) this.faceEl.classList.toggle('talking', this.open && !this._complete());
    if (this._complete() && this.currentOptions) {
      html += '<div id="dlg-opts">' + this.currentOptions.map((o, i) =>
        `<div class="opt ${i === this.optSel ? 'sel' : ''}">${o.label}</div>`).join('') + '</div>';
    }
    this.textEl.innerHTML = html;
  }

  _complete() { return this.charsShown >= this.fullText.length; }

  /** @param {number} dt */
  update(dt) {
    if (!this.open) return;
    if (!this._complete()) {
      this.tick += dt;
      const prev = Math.floor(this.charsShown);
      const rate = 55 * (SPEEDS[this.speed] || 1);
      this.charsShown = Math.min(this.fullText.length, this.charsShown + dt * rate);
      if (Math.floor(this.charsShown) !== prev && Math.floor(this.charsShown) % 3 === 0) this.audio.sfx('talk');
      if (Math.floor(this.charsShown) !== prev) this._render();
    }
  }

  /**
   * Entrada: retorna true se consumiu o input.
   * @param {import('../core/Input.js').Input} input
   */
  handle(input) {
    if (!this.open) return false;
    if (this._complete() && this.currentOptions) {
      if (input.pressed.up) { this.optSel = (this.optSel + this.currentOptions.length - 1) % this.currentOptions.length; this.audio.sfx('cursor'); this._render(); return true; }
      if (input.pressed.down) { this.optSel = (this.optSel + 1) % this.currentOptions.length; this.audio.sfx('cursor'); this._render(); return true; }
      if (input.pressed.confirm) { this._press(null); return true; }
      if (input.pressed.cancel) { this._press(null, true); return true; }
      return true;
    }
    if (input.pressed.confirm || input.pressed.cancel) {
      if (input.pressed.cancel && !(this._complete() && this.currentOptions)) {
        // cancelar no meio do texto só completa a linha
        if (!this._complete()) { this.charsShown = this.fullText.length; this._render(); }
        return true;
      }
      this._press(null, input.pressed.cancel);
      return true;
    }
    return !!this.open;
  }

  /** Avança o diálogo / escolhe opção. @param {number|null} selIdx @param {boolean} [isCancel] */
  _press(selIdx = null, isCancel = false) {
    if (!this.open) return;
    if (this._complete() && this.currentOptions) {
      if (isCancel) {
        this.audio.sfx('cancel');
        const cb = this.choiceCb; this.choiceCb = null;
        this.queue.length = 0; this._next();
        cb?.(null);
        return;
      }
      if (selIdx != null) this.optSel = selIdx;
      const v = this.currentOptions[this.optSel].value;
      this.audio.sfx('confirm');
      this.currentOptions = null;
      const cb = this.choiceCb; this.choiceCb = null;
      this._next();
      cb?.(v);
      return;
    }
    if (!this._complete()) { this.charsShown = this.fullText.length; this._render(); }
    else { this.audio.sfx('confirm'); this._next(); }
  }

  close() {
    this.open = false;
    this.el.classList.add('hidden');
    this.queue.length = 0;
    this.currentOptions = null;
    if (this.faceEl) this.faceEl.classList.remove('talking');
  }
}
