/**
 * Input — teclado + touch com detecção de borda (justPressed).
 * Ações: up, down, left, right, confirm, cancel, menu.
 * @module core/Input
 */
export class Input {
  constructor() {
    /** @type {Record<string, boolean>} */
    this.held = { up: false, down: false, left: false, right: false, confirm: false, cancel: false, menu: false, mute: false, run: false };
    /** @type {Record<string, boolean>} */
    this.pressed = {};
    /** @type {Record<string, boolean>} */
    this._prev = { ...this.held };

    /** @type {Record<string, string>} */
    this.keymap = {
      ArrowUp: 'up', KeyW: 'up',
      ArrowDown: 'down', KeyS: 'down',
      ArrowLeft: 'left', KeyA: 'left',
      ArrowRight: 'right', KeyD: 'right',
      Enter: 'confirm', KeyE: 'confirm', Space: 'confirm',
      Escape: 'cancel', KeyQ: 'menu', KeyM: 'mute',
      ShiftLeft: 'run', ShiftRight: 'run',
    };

    window.addEventListener('keydown', (e) => {
      const a = this.keymap[e.code];
      if (!a) return;
      e.preventDefault();
      this.held[a] = true;
    });
    window.addEventListener('keyup', (e) => {
      const a = this.keymap[e.code];
      if (!a) return;
      this.held[a] = false;
    });

    // Botões touch (data-k)
    document.querySelectorAll('#touch [data-k]').forEach((btn) => {
      const map = { up: 'up', down: 'down', left: 'left', right: 'right', confirm: 'confirm', cancel: 'cancel', menu: 'menu' };
      const act = map[btn.getAttribute('data-k')] || 'confirm';
      const on = (e) => { e.preventDefault(); this.held[act] = true; };
      const off = (e) => { e.preventDefault(); this.held[act] = false; };
      btn.addEventListener('pointerdown', on);
      btn.addEventListener('pointerup', off);
      btn.addEventListener('pointerleave', off);
      btn.addEventListener('pointercancel', off);
    });

    if ('ontouchstart' in window) document.getElementById('touch')?.classList.remove('hidden');
  }

  /** Deve ser chamado no fim de cada frame. */
  postUpdate() {
    for (const k of Object.keys(this.held)) {
      this.pressed[k] = this.held[k] && !this._prev[k];
      this._prev[k] = this.held[k];
    }
  }

  /** @param  {...string} acts */
  any(...acts) { return acts.some((a) => this.held[a]); }
  /** @param  {...string} acts */
  anyPressed(...acts) { return acts.some((a) => this.pressed[a]); }

  get axis() {
    return {
      x: (this.held.right ? 1 : 0) - (this.held.left ? 1 : 0),
      y: (this.held.down ? 1 : 0) - (this.held.up ? 1 : 0),
    };
  }
}
