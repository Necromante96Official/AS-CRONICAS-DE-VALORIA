/**
 * Skills — árvore de skills por herói (nós que se ligam, estilo constelação).
 * Setas navegam no espaço · E investe 1✦ · Q fecha. Mouse: passa seleciona,
 * clica investe (2º clique no já selecionado).
 * @module ui/Skills
 */
import { treeFor, nodeById, getRank, reqMet, canInvest, invest, effectText } from '../systems/SkillTree.js';
import { ic } from './ItemIcons.js';

const REASONS = {
  'maxed': 'Nível máximo já alcançado.',
  'locked': 'Bloqueada: invista nos nós ligados antes.',
  'no-sp': 'Sem pontos ✦. Suba de nível para ganhar mais.',
  'no-node': 'Nó inválido.',
};

export class Skills {
  /** @param {import('../core/Audio.js').AudioMan} audio */
  constructor(audio) {
    this.audio = audio;
    this.el = document.getElementById('skills');
    this.headEl = document.getElementById('skills-head');
    this.linksEl = document.getElementById('skills-links');
    this.nodesEl = document.getElementById('skills-nodes');
    this.detailEl = document.getElementById('skills-detail');
    this.footEl = document.getElementById('skills-foot');
    this.open = false;
    /** @type {any} */
    this.hero = null;
    this.sel = 0;
    /** @type {(msg:string)=>void} */
    this.notify = () => {};
    /** @type {(()=>void)|null} */
    this.onClose = null;
    // mouse: passar por cima seleciona
    this.nodesEl.addEventListener('mouseover', (e) => {
      if (!this.open) return;
      const o = e.target.closest?.('.sk-node');
      if (!o) return;
      const i = [...this.nodesEl.querySelectorAll('.sk-node')].indexOf(o);
      if (i >= 0 && i !== this.sel) { this.sel = i; this.audio.sfx('cursor'); this._render(); }
    });
    // mouse: 1º clique seleciona, 2º no mesmo investe
    this.nodesEl.addEventListener('click', (e) => {
      if (!this.open) return;
      this.audio.unlock();
      const o = e.target.closest?.('.sk-node');
      if (!o) return;
      const i = [...this.nodesEl.querySelectorAll('.sk-node')].indexOf(o);
      if (i < 0) return;
      if (i === this.sel) this._invest();
      else { this.sel = i; this.audio.sfx('cursor'); this._render(); }
    });
  }

  get active() { return this.open; }

  /** @param {any} hero @param {(msg:string)=>void} [notify] @param {(()=>void)|null} [onClose] */
  show(hero, notify = () => {}, onClose = null) {
    this.hero = hero;
    this.notify = notify;
    this.onClose = onClose;
    this.open = true;
    this.sel = 0;
    this.el.classList.remove('hidden');
    this._render();
  }

  close() {
    this.open = false;
    this.hero = null;
    this.el.classList.add('hidden');
    const cb = this.onClose; this.onClose = null;
    cb?.();
  }

  /** @param {import('../core/Input.js').Input} input */
  handle(input) {
    if (!this.open || !this.hero) return false;
    const nodes = treeFor(this.hero.cls);
    if (input.pressed.cancel || input.pressed.menu) {
      this.audio.sfx('cancel');
      this.close();
      return true;
    }
    const dx = (input.pressed.right ? 1 : 0) - (input.pressed.left ? 1 : 0);
    const dy = (input.pressed.down ? 1 : 0) - (input.pressed.up ? 1 : 0);
    if (dx !== 0 || dy !== 0) {
      const nx = this._nearest(nodes, this.sel, dx, dy);
      if (nx >= 0 && nx !== this.sel) { this.sel = nx; this.audio.sfx('cursor'); this._render(); }
      return true;
    }
    if (input.pressed.confirm) { this._invest(); return true; }
    return true;
  }

  /** Vizinho mais próximo na direção (dx,dy) no espaço x/y dos nós. */
  _nearest(nodes, from, dx, dy) {
    const o = nodes[from];
    if (!o) return from;
    let best = from, bestScore = Infinity;
    nodes.forEach((n, i) => {
      if (i === from) return;
      const vx = n.x - o.x, vy = (n.y - o.y) * (100 / 64);
      const len = Math.hypot(vx, vy) || 1;
      const dot = (vx * dx + vy * dy) / len;
      if (dot < 0.45) return; // fora do cone da direção
      const perp = Math.abs(vx * dy - vy * dx) / len;
      const score = (len / dot) + perp * 2.2;
      if (score < bestScore) { bestScore = score; best = i; }
    });
    return best;
  }

  _invest() {
    const h = this.hero;
    if (!h) return;
    const nodes = treeFor(h.cls);
    const node = nodes[this.sel];
    const r = invest(h, node);
    if (r.ok) {
      this.audio.sfx('levelup');
      const rank = getRank(h, node.id);
      this.notify(`${h.name}: ${node.name} ${rank}/${node.max}!`);
    } else {
      this.audio.sfx('flee-fail');
      this.notify(r.reason === 'level' ? `Requer Nv ${node.reqLevel}+ para desbloquear.` : (REASONS[r.reason] || 'Não foi possível investir.'));
    }
    this._render();
  }

  _nodeClass(h, node) {
    if (getRank(h, node.id) > 0) return 'taken';
    return canInvest(h, node).ok ? 'avail' : 'locked';
  }

  _render() {
    const h = this.hero;
    if (!h) return;
    const nodes = treeFor(h.cls);
    if (this.sel >= nodes.length) this.sel = 0;
    this.headEl.innerHTML =
      `<h2>✦ ÁRVORE DE SKILLS ✦</h2>` +
      `<div class="skills-hero">${h.name} <span class="row-sub">${h.cls} · Nv ${h.level}</span></div>` +
      `<div class="skills-sp">✦ ${h.sp || 0} ponto(s)</div>`;
    // ligações (SVG): dourada se o destino já tem nível, azul se destravada, apagada se bloqueada
    this.linksEl.innerHTML = nodes.map((n) =>
      n.req.map((rid) => {
        const a = nodes.find((m) => m.id === rid);
        if (!a) return '';
        const cls = getRank(h, n.id) > 0 ? 'taken' : (reqMet(h, n) ? 'avail' : 'locked');
        return `<line x1="${a.x}" y1="${a.y}" x2="${n.x}" y2="${n.y}" class="${cls}" />`;
      }).join('')).join('');
    // nós
    this.nodesEl.innerHTML = nodes.map((n, i) => {
      const rank = getRank(h, n.id);
      const pips = Array.from({ length: n.max }, (_, k) => k < rank ? '●' : '○').join('');
      return `<div class="sk-node ${this._nodeClass(h, n)} ${i === this.sel ? 'sel' : ''}" ` +
        `style="left:${n.x}%;top:${(n.y / 64) * 100}%" data-i="${i}" title="${n.name}">` +
        `<span class="sk-ic">${ic(n.icon, 26)}</span>` +
        `<span class="sk-nm">${n.name}</span>` +
        `<span class="sk-pips">${pips}</span></div>`;
    }).join('');
    // detalhe do selecionado
    const n = nodes[this.sel];
    if (n) {
      const rank = getRank(h, n.id);
      const reqNames = n.req.length
        ? n.req.map((rid) => {
            const rn = nodeById(rid);
            const ok = rn && getRank(h, rid) > 0;
            return `<span class="${ok ? 'req-ok' : 'req-no'}">${ok ? '✓' : '✗'} ${rn ? rn.name : rid}</span>`;
          }).join(' · ')
        : '<span class="req-ok">✓ inicial</span>';
      const st = this._nodeClass(h, n);
      const hint = st === 'taken' && rank >= n.max ? 'Nível máximo.' :
        st === 'taken' ? 'E investe mais 1✦.' :
        st === 'avail' ? `E investe 1✦ (você tem ${h.sp || 0}).` : 'Bloqueada.';
      this.detailEl.innerHTML =
        `<h3>${ic(n.icon, 40)} ${n.name} <span class="row-sub">${rank}/${n.max}</span></h3>` +
        `<div>${n.desc}</div>` +
        `<div class="sk-fx">${effectText(n)}</div>` +
        `<div class="row-sub">Requer: ${reqNames}${(n.reqLevel || 1) > 1 ? ` · <span class="${(h.level || 1) >= n.reqLevel ? 'req-ok' : 'req-no'}">Nv ${n.reqLevel}+</span>` : ''}</div>` +
        `<div class="sk-hint">${hint}</div>`;
    } else {
      this.detailEl.innerHTML = '';
    }
    this.footEl.innerHTML = `<span class="gold">${ic('gold', 20)} ✦ ${h.sp || 0}</span><span>Setas navegar · E investir · Q fechar</span>`;
  }
}
