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

    // Botões touch (data-k). "run" é alternador (liga/desliga correr).
    document.querySelectorAll('#touch [data-k]').forEach((btn) => {
      const k = btn.getAttribute('data-k');
      if (k === 'run') {
        btn.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          this.held.run = !this.held.run;
          btn.classList.toggle('on', this.held.run);
        });
        return;
      }
      const map = { up: 'up', down: 'down', left: 'left', right: 'right', confirm: 'confirm', cancel: 'cancel', menu: 'menu' };
      const act = map[k] || 'confirm';
      const on = (e) => { e.preventDefault(); this.held[act] = true; };
      const off = (e) => { e.preventDefault(); this.held[act] = false; };
      btn.addEventListener('pointerdown', on);
      btn.addEventListener('pointerup', off);
      btn.addEventListener('pointerleave', off);
      btn.addEventListener('pointercancel', off);
    });
    this._initTouchDrag();

    if ('ontouchstart' in window) document.getElementById('touch')?.classList.remove('hidden');
  }

  /** Posição personalizada do bloco touch (segurar p/ arrastar, 2 toques p/ resetar). */
  _loadTouchLayout() {
    try {
      const raw = localStorage.getItem('valoria_touch');
      if (raw) return { tbtns: { x: 0, y: 0 }, ...JSON.parse(raw) };
    } catch { /* armazenamento indisponível */ }
    return { tbtns: { x: 0, y: 0 } };
  }

  _initTouchDrag() {
    this._touchPos = this._loadTouchLayout();
    const save = () => {
      try { localStorage.setItem('valoria_touch', JSON.stringify(this._touchPos)); } catch { /* ignora */ }
    };
    const apply = (el, p) => {
      el.style.transform = (p && (p.x || p.y)) ? `translate(${p.x}px,${p.y}px)` : '';
    };
    // solta qualquer tecla touch (evita tecla "presa" ao começar/terminar o arrasto)
    const releaseTouch = () => {
      for (const k of ['up', 'down', 'left', 'right', 'confirm', 'cancel', 'menu']) this.held[k] = false;
    };
    for (const id of ['tbtns']) {
      const el = document.getElementById(id);
      if (!el) continue;
      apply(el, this._touchPos[id]);
      let st = null;
      el.addEventListener('pointerdown', (e) => {
        const now = performance.now();
        // toque duplo rápido no bloco: volta à posição padrão
        if (st && now - st.t0 < 320 && !st.drag) {
          this._touchPos[id] = { x: 0, y: 0 };
          apply(el, this._touchPos[id]);
          save();
          clearTimeout(st.timer);
          st = null;
          return;
        }
        const base = { ...(this._touchPos[id] || { x: 0, y: 0 }) };
        st = {
          t0: now, x: e.clientX, y: e.clientY, base, drag: false, moved: false,
          timer: setTimeout(() => {
            if (st && !st.moved) {
              st.drag = true;
              releaseTouch();
              el.classList.add('moving');
            }
          }, 450),
        };
      });
      el.addEventListener('pointermove', (e) => {
        if (!st) return;
        const dx = e.clientX - st.x, dy = e.clientY - st.y;
        if (Math.hypot(dx, dy) > 10) st.moved = true;
        if (st.drag) {
          this._touchPos[id] = { x: Math.round(st.base.x + dx), y: Math.round(st.base.y + dy) };
          apply(el, this._touchPos[id]);
        }
      });
      const end = () => {
        if (!st) return;
        if (st.drag) { save(); releaseTouch(); }
        clearTimeout(st.timer);
        el.classList.remove('moving');
        st = null;
      };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
    }
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
