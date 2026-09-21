/**
 * SpriteFactory — pixel-art procedural (sem arquivos externos).
 * Gera sprites de heróis/NPCs (4 direções) e monstros em offscreen canvas.
 * @module core/SpriteFactory
 */

const S = 2; // escala do pixel interno (16x20 -> 32x40)

/**
 * @typedef {{skin:string,hair:string,tunic:string,pants:string,cape?:string}} Palette
 */

/** Desenha um humanoide 16x20 em 2 frames de andar por direção.
 * @param {Palette} pal
 * @param {{kind?:string}} [opts] kind diferencia heróis e NPCs (hero/mage/cleric/elder/merchant/innkeep/kid/guard/hermit)
 * @returns {Record<string, HTMLCanvasElement[]>} [frame parado, frame passo]
 */
export function makeHumanoid(pal, opts = {}) {
  const W = 16, H = 20;
  const kind = opts.kind || pal.role || '';
  /** @type {Record<string, HTMLCanvasElement[]>} */
  const out = {};
  for (const dir of ['down', 'up', 'left', 'right']) {
    out[dir] = [];
    for (const f of [0, 1]) {
    const c = document.createElement('canvas');
    c.width = W * S; c.height = H * S;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const px = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x * S, y * S, w * S, h * S); };
    const step = f === 1; // frame de passo: perna esq. levantada + braços balançando

    // sombra
    g.fillStyle = 'rgba(0,0,0,.3)';
    g.beginPath(); g.ellipse(8 * S, 18.6 * S, 5 * S, 1.2 * S, 0, 0, 7); g.fill();

    const isRobe = kind === 'mage' || kind === 'cleric' || kind === 'elder' || kind === 'hermit';
    const isKid = kind === 'kid';

    // capa por trás (herói guerreiro) — visível em todas as direções
    if (pal.cape) {
      px(3, 9, 1, 8, shade(pal.cape, -30));
      px(12, 9, 1, 8, shade(pal.cape, -30));
      if (dir === 'up') { px(4, 9, 8, 7, pal.cape); px(4, 9, 8, 1, shade(pal.cape, 30)); }
      else { px(4, 14, 8, 2, shade(pal.cape, -20)); }
    }

    // botas + pernas (túnica longa vira manto até o chão)
    if (isRobe) {
      px(5, 15, 2, 3, shade(pal.tunic, -35)); px(9, 15, 2, 3, shade(pal.tunic, -35));
      if (step) { px(5, 17, 2, 1, '#2a1f16'); px(9, 18, 2, 1, '#2a1f16'); }
      else { px(5, 18, 2, 1, '#2a1f16'); px(9, 18, 2, 1, '#2a1f16'); }
      px(4, 9, 8, 7, pal.tunic);
      px(4, 9, 8, 1, shade(pal.tunic, 28));
      // bainha do manto + fenda frontal (balança no passo)
      px(4, 15, 8, 1, shade(pal.tunic, -25));
      if (step) px(4, 16, 8, 1, shade(pal.tunic, -12));
      if (dir !== 'up') px(7, 13, 2, 3, shade(pal.tunic, -30));
    } else if (!step) {
      px(5, 15, 2, 3, pal.pants); px(9, 15, 2, 3, pal.pants);
      px(5, 18, 2, 1, '#2e2118'); px(9, 18, 2, 1, '#2e2118');
      px(6, 18, 1, 1, '#57432e'); px(10, 18, 1, 1, '#57432e'); // bico da bota
      px(4, 9, 8, 6, pal.tunic);
      px(4, 9, 8, 1, shade(pal.tunic, 28));
      px(4, 14, 8, 1, shade(pal.tunic, -18)); // sombra da cintura
    } else {
      // passo: perna esq. levantada, dir. plantada
      px(5, 15, 2, 2, pal.pants); px(9, 15, 2, 3, pal.pants);
      px(5, 17, 2, 1, '#2e2118'); px(9, 18, 2, 1, '#2e2118');
      px(10, 18, 1, 1, '#57432e');
      px(4, 9, 8, 6, pal.tunic);
      px(4, 9, 8, 1, shade(pal.tunic, 28));
      px(4, 14, 8, 1, shade(pal.tunic, -18));
    }
    // cinto com fivela (não para mantos longos de mago/clérigo)
    if (!isRobe || kind === 'hero') { px(4, 12, 8, 1, '#3a2a1a'); px(7, 12, 2, 1, '#ffd75e'); }

    // braços + mãos (balançam opostos no passo)
    const sleeveL = kind === 'guard' ? '#9aa0ad' : pal.tunic;
    const sleeveR = sleeveL;
    if (!step) {
      px(2, 10, 2, 4, sleeveL); px(12, 10, 2, 4, sleeveR);
      px(2, 10, 2, 1, shade(sleeveL, 22)); px(12, 10, 2, 1, shade(sleeveR, 22));
      px(2, 14, 2, 1, pal.skin); px(12, 14, 2, 1, pal.skin);
    } else {
      px(2, 9, 2, 4, sleeveL); px(12, 10, 2, 4, sleeveR);
      px(2, 9, 2, 1, shade(sleeveL, 22)); px(12, 10, 2, 1, shade(sleeveR, 22));
      px(2, 13, 2, 1, pal.skin); px(12, 14, 2, 1, pal.skin);
    }

    // ombreiras do guerreiro / guarda
    if (kind === 'hero') { px(2, 9, 3, 1, '#c9c9d4'); px(11, 9, 3, 1, '#c9c9d4'); }
    if (kind === 'guard') { px(2, 9, 2, 2, '#7d8494'); px(12, 9, 2, 2, '#7d8494'); px(4, 10, 8, 2, '#7d8494'); px(7, 10, 2, 2, '#c22a3a'); }

    // cabeça base + orelhas
    px(5, 3, 6, 6, pal.skin);
    px(4, 5, 1, 2, pal.skin); px(11, 5, 1, 2, pal.skin);
    px(4, 5, 1, 1, shade(pal.skin, -22)); px(11, 5, 1, 1, shade(pal.skin, -22));

    // cabelo base por direção (com franja e brilho)
    const hairH = shade(pal.hair, 26);
    if (dir === 'down') {
      px(4, 1, 8, 3, pal.hair); px(4, 3, 1, 4, pal.hair); px(11, 3, 1, 4, pal.hair);
      px(5, 3, 6, 1, hairH); // franja iluminada
      px(5, 2, 2, 1, hairH);
    } else if (dir === 'up') {
      px(4, 1, 8, 6, pal.hair); px(5, 1, 3, 2, hairH);
    } else if (dir === 'left') {
      px(4, 1, 8, 3, pal.hair); px(4, 3, 2, 4, pal.hair); px(10, 4, 1, 2, pal.hair);
      px(5, 2, 3, 1, hairH);
    } else {
      px(4, 1, 8, 3, pal.hair); px(10, 3, 2, 4, pal.hair); px(5, 4, 1, 2, pal.hair);
      px(8, 2, 3, 1, hairH);
    }

    // rosto: olhos com branco + pupila, boca, blush — só onde o rosto aparece
    const eye = (x, y) => { px(x, y, 1, 2, '#fff'); px(x, y + 1, 1, 1, '#1c1c2a'); };
    if (dir === 'down') {
      eye(6, 5); eye(9, 5);
      px(7, 7, 2, 1, '#8c3b3b'); // boca
      px(5, 6, 1, 1, 'rgba(255,130,130,.7)'); px(10, 6, 1, 1, 'rgba(255,130,130,.7)');
      if (kind === 'kid') { px(6, 6, 1, 1, '#8a5a2b'); px(9, 6, 1, 1, '#8a5a2b'); } // sardas
    } else if (dir === 'left') { eye(5, 5); px(6, 7, 1, 1, '#8c3b3b'); }
    else if (dir === 'right') { eye(10, 5); px(9, 7, 1, 1, '#8c3b3b'); }

    // ---- identidade por papel ----
    // MAGA: chapéu pontudo de bruxa com aba + estrela (todo dentro do canvas 16x20)
    if (kind === 'mage') {
      px(2, 2, 12, 2, '#4a2a8c'); // aba
      px(2, 2, 12, 1, '#7a5cff');
      if (dir === 'up') { px(5, 0, 6, 3, '#6a3ec2'); px(6, 0, 2, 3, '#8a6cff'); px(7, 0, 1, 1, '#ffd75e'); }
      else { px(5, 0, 6, 3, '#6a3ec2'); px(6, 0, 2, 3, '#8a6cff'); px(7, 1, 1, 1, '#ffd75e'); }
      px(4, 11, 8, 1, '#4a2a8c'); // faixa do manto
      px(7, 11, 2, 2, '#ffd75e'); // broche
    }
    // CLÉRIGO: capuz + cruz dourada
    if (kind === 'cleric') {
      px(4, 1, 8, 2, '#f2ead8'); px(4, 2, 1, 5, '#f2ead8'); px(11, 2, 1, 5, '#f2ead8');
      px(4, 1, 8, 1, '#ffffff');
      if (dir !== 'up') { px(7, 10, 2, 1, '#ffd75e'); px(7, 10, 2, 3, '#ffd75e'); px(6, 11, 4, 1, '#ffd75e'); }
    }
    // ANCIÃO: barba longa branca + cajado
    if (kind === 'elder') {
      if (dir !== 'up') {
        px(5, 7, 6, 3, '#e8e8e8'); px(6, 10, 4, 2, '#d5d5d5');
        px(6, 7, 1, 2, '#ffffff');
        px(4, 1, 8, 1, '#dddddd'); // calva com laterais brancas
      } else { px(4, 3, 1, 4, '#ddd'); px(11, 3, 1, 4, '#ddd'); }
      px(13, 6, 1, 12, '#6e451f'); px(13, 4, 3, 2, '#4fc3ff'); // cajado + cristal
    }
    // EREMITA: capuz sombrio + barba + lanterna
    if (kind === 'hermit') {
      px(3, 1, 10, 3, '#3a3350'); px(3, 3, 1, 4, '#3a3350'); px(12, 3, 1, 4, '#3a3350');
      if (dir !== 'up') { px(6, 7, 4, 3, '#bdbdc9'); px(7, 10, 2, 1, '#9a9aa8'); }
      px(1, 11, 2, 3, '#2a2a3a'); px(1, 12, 2, 2, '#ffd75e'); // lamparina na mão
    }
    // MERCADORA: coque + avental com bolsinho de moedas
    if (kind === 'merchant') {
      px(6, 0, 4, 2, pal.hair); px(5, 0, 6, 1, hairH); // coque alto
      px(11, 6, 1, 1, '#ffd75e'); // brinco
      if (dir !== 'up') { px(6, 10, 4, 4, '#f2ead8'); px(7, 12, 2, 1, '#8a5a2b'); px(9, 11, 1, 1, '#ffd75e'); }
    }
    // ESTALADEIRO: barba castanha + barriga + toalha no ombro
    if (kind === 'innkeep') {
      if (dir !== 'up') { px(5, 7, 6, 2, '#5e3a17'); px(6, 9, 4, 1, '#4a2f14'); }
      px(4, 9, 8, 1, '#e8e4da'); // toalha
      px(2, 9, 2, 3, '#f2f2f2');
    }
    // PIRRALHO: boné azul + mochila
    if (kind === 'kid') {
      px(4, 1, 8, 2, '#2b6fd6'); px(4, 2, 8, 1, '#1b4a9e');
      if (dir === 'up') px(3, 3, 2, 1, '#2b6fd6');
      if (dir !== 'up') { px(6, 10, 4, 3, '#e8a23c'); } // mochilinha
    }
    // GUARDA: elmo de aço com penacho + lança
    if (kind === 'guard') {
      px(4, 1, 8, 3, '#b5b5c2'); px(4, 1, 8, 1, '#e8ecff');
      px(7, 0, 2, 2, '#c22a3a'); // penacho
      if (dir !== 'up') px(7, 5, 2, 2, '#7d8494'); // guarda-nariz
      px(0, 5, 1, 13, '#6e451f'); px(0, 3, 3, 2, '#c9c9d4'); // lança
    }
    // HERÓI guerreiro: faixa + bainha da espada nas costas
    if (kind === 'hero') {
      px(4, 3, 8, 1, '#c22a3a'); // faixa vermelha
      if (dir === 'up' || dir === 'left') { px(10, 6, 2, 6, '#5e3a17'); px(9, 5, 4, 2, '#c9c9d4'); }
    }
    // PESCADOR: chapéu de palha + colete + mangas arregaçadas + vara na mão
    if (kind === 'fisher') {
      px(5, 0, 6, 2, '#c2a05e'); px(2, 2, 12, 2, '#d9b878'); // copa + aba
      px(2, 2, 12, 1, '#e8cf92'); px(5, 1, 6, 1, '#c23b3b'); // luz da aba + fita
      px(4, 9, 2, 6, shade(pal.tunic, -22)); px(10, 9, 2, 6, shade(pal.tunic, -22)); // colete
      px(7, 10, 2, 1, '#ffd75e'); // botão do colete
      px(2, 12, 2, 2, pal.skin); px(12, 12, 2, 2, pal.skin); // antebraços
      px(4, 14, 8, 1, '#3a2a1a'); // botas de borracha (cano alto)
      px(13, 4, 1, 12, '#8a5a2b'); // vara
      px(13, 3, 1, 1, '#e8b878'); px(13, 7, 1, 1, '#5e3a17'); // ponteira + enrolamento
      px(12, 9, 2, 2, '#c0c6d0'); px(12, 9, 1, 1, '#ffffff'); // molinete
    }
    // NÔMADE: turbante com joia + cachecol + roupa com vivos dourados + sacola
    if (kind === 'nomad') {
      px(4, 1, 8, 2, '#e8e4da'); px(4, 2, 8, 1, '#c9b896'); // turbante
      px(7, 1, 2, 1, '#4fc3ff'); px(7, 1, 1, 1, '#ffffff'); // joia com brilho
      if (dir !== 'left') px(11, 3, 1, 3, '#e8e4da'); else px(4, 3, 1, 3, '#e8e4da'); // cauda
      if (dir !== 'up') { px(5, 7, 6, 2, '#a03a4c'); px(9, 7, 2, 2, '#7a1f2b'); } // cachecol
      px(4, 14, 8, 1, '#ffd75e'); // vivo dourado
      px(4, 9, 8, 1, '#3a2a1a'); px(11, 11, 3, 3, '#5e3a17'); // tiracolo + sacola
      px(12, 12, 1, 1, '#ffd75e'); // fecho
    }
    // CAÇADORA: murça de pele + trança + arco e aljava
    if (kind === 'hunter') {
      px(2, 9, 12, 2, '#e8e8e8'); px(2, 10, 12, 1, '#ffffff'); // murça + pelo
      if (dir === 'down') px(11, 4, 1, 4, '#e8e8e8'); // trança lateral
      if (dir === 'up') { px(3, 1, 10, 2, '#d5d5d5'); px(3, 1, 10, 1, '#ffffff'); } // capuz arriado
      if (dir === 'left') { px(2, 6, 1, 9, '#6e451f'); px(3, 7, 1, 7, '#e8ecff'); }
      else if (dir === 'right') { px(13, 6, 1, 9, '#6e451f'); px(12, 7, 1, 7, '#e8ecff'); }
      else if (dir === 'up') { px(3, 6, 1, 9, '#6e451f'); px(11, 8, 2, 5, '#8a5a2b'); px(11, 6, 2, 2, '#e8ecff'); }
      else { px(11, 9, 2, 5, '#8a5a2b'); px(11, 7, 2, 2, '#e8ecff'); } // aljava + flechas
      px(5, 17, 2, 1, '#e8e8e8'); px(9, 17, 2, 1, '#e8e8e8'); // pelo nas botas
    }
    // ---- luz e profundidade globais: rim à esquerda, oclusão à direita ----
    px(4, 9, 1, 6, 'rgba(255,255,255,.20)');
    px(5, 3, 1, 5, 'rgba(255,255,255,.13)');
    px(11, 9, 1, 6, 'rgba(0,0,10,.20)');
    px(10, 4, 1, 4, 'rgba(0,0,10,.15)');
    px(5, 18, 1, 1, 'rgba(255,255,255,.28)'); px(9, 18, 1, 1, 'rgba(255,255,255,.28)');
    out[dir].push(c);
    }
  }
  return out;
}

/** Clareia/escurece hex. */
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, v + amt));
  const r = c((n >> 16) & 255), g = c((n >> 8) & 255), b = c(n & 255);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

/** Slime / Gosma — geleia verde-água com olhos grandes e boca. */
export function makeSlime(color = '#4fe07a') {
  const c = document.createElement('canvas');
  c.width = 32 * S; c.height = 24 * S;
  const g = c.getContext('2d');
  const dark = shade(color, -55), lite = shade(color, 55);
  // sombra + poça de gosma
  g.fillStyle = 'rgba(0,0,0,.3)';
  g.beginPath(); g.ellipse(16 * S, 22 * S, 11 * S, 2 * S, 0, 0, 7); g.fill();
  g.fillStyle = color;
  g.beginPath(); g.ellipse(16 * S, 21.4 * S, 10 * S, 1.6 * S, 0, 0, 7); g.fill();
  // corpo: contorno escuro + massa translúcida
  g.fillStyle = dark;
  g.beginPath(); g.ellipse(16 * S, 15 * S, 12.4 * S, 8.4 * S, 0, 0, 7); g.fill();
  g.fillStyle = color;
  g.beginPath(); g.ellipse(16 * S, 15.4 * S, 11.4 * S, 7.4 * S, 0, 0, 7); g.fill();
  // brilho de gelatina (alto-esquerda) + reflexo inferior
  g.fillStyle = lite;
  g.beginPath(); g.ellipse(10.5 * S, 10.5 * S, 5 * S, 3 * S, -0.45, 0, 7); g.fill();
  g.fillStyle = 'rgba(255,255,255,.9)';
  g.beginPath(); g.ellipse(9 * S, 9.6 * S, 2 * S, 1.3 * S, -0.45, 0, 7); g.fill();
  g.fillStyle = 'rgba(255,255,255,.35)';
  g.fillRect(19 * S, 17 * S, 5 * S, 1.4 * S);
  // pingos na base
  g.fillStyle = color;
  g.beginPath(); g.arc(6.5 * S, 20 * S, 1.6 * S, 0, 7); g.fill();
  g.beginPath(); g.arc(25.5 * S, 20.4 * S, 1.3 * S, 0, 7); g.fill();
  // olhos grandes de anime: branco + íris + brilho
  const eye = (cx) => {
    g.fillStyle = '#fff';
    g.beginPath(); g.ellipse(cx * S, 14.5 * S, 2.6 * S, 3.2 * S, 0, 0, 7); g.fill();
    g.fillStyle = '#101018';
    g.beginPath(); g.ellipse(cx * S, 15.2 * S, 1.5 * S, 2 * S, 0, 0, 7); g.fill();
    g.fillStyle = '#fff';
    g.fillRect((cx - 0.9) * S, 13.4 * S, 1.1 * S, 1.1 * S);
  };
  eye(11.5); eye(20.5);
  // boca ondulada + blush = "fofo mas monstro"
  g.strokeStyle = '#1d3a24'; g.lineWidth = 1.1 * S; g.lineCap = 'round';
  g.beginPath(); g.moveTo(13.6 * S, 18.6 * S); g.quadraticCurveTo(15 * S, 19.6 * S, 16 * S, 18.6 * S); g.quadraticCurveTo(17 * S, 17.6 * S, 18.4 * S, 18.6 * S); g.stroke();
  g.fillStyle = 'rgba(255,130,150,.55)';
  g.beginPath(); g.ellipse(8.6 * S, 17 * S, 1.4 * S, 1 * S, 0, 0, 7); g.fill();
  g.beginPath(); g.ellipse(23.4 * S, 17 * S, 1.4 * S, 1 * S, 0, 0, 7); g.fill();
  return c;
}

/** Fagulha — espírito de chama azul flutuante (NÃO é slime). */
export function makeWisp() {
  const c = document.createElement('canvas');
  c.width = 32 * S; c.height = 30 * S;
  const g = c.getContext('2d');
  // sombra fraca (flutua)
  g.fillStyle = 'rgba(0,0,0,.25)';
  g.beginPath(); g.ellipse(16 * S, 28 * S, 7 * S, 1.5 * S, 0, 0, 7); g.fill();
  // cauda ondulada de fogo
  g.fillStyle = '#2a7fd6';
  g.beginPath();
  g.moveTo(11 * S, 22 * S);
  g.quadraticCurveTo(13 * S, 26 * S, 11.5 * S, 28 * S);
  g.quadraticCurveTo(15 * S, 26.5 * S, 16 * S, 28.5 * S);
  g.quadraticCurveTo(17 * S, 26.5 * S, 20.5 * S, 28 * S);
  g.quadraticCurveTo(19 * S, 26 * S, 21 * S, 22 * S);
  g.closePath(); g.fill();
  // corpo-chama externo (azul)
  const grad = g.createLinearGradient(0, 4 * S, 0, 26 * S);
  grad.addColorStop(0, '#bff3ff'); grad.addColorStop(0.35, '#4fc3ff'); grad.addColorStop(1, '#1b2f9e');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(16 * S, 1 * S);
  g.quadraticCurveTo(24 * S, 8 * S, 23 * S, 16 * S);
  g.quadraticCurveTo(22.4 * S, 22 * S, 16 * S, 23.5 * S);
  g.quadraticCurveTo(9.6 * S, 22 * S, 9 * S, 16 * S);
  g.quadraticCurveTo(8 * S, 8 * S, 16 * S, 1 * S);
  g.fill();
  // contorno flamejante
  g.strokeStyle = '#7fd4ff'; g.lineWidth = 1 * S;
  g.beginPath();
  g.moveTo(16 * S, 2.5 * S);
  g.quadraticCurveTo(22 * S, 9 * S, 21 * S, 16 * S);
  g.stroke();
  // núcleo branco-amarelado
  g.fillStyle = '#fff8d8';
  g.beginPath(); g.ellipse(16 * S, 15.5 * S, 5.5 * S, 6 * S, 0, 0, 7); g.fill();
  g.fillStyle = '#ffd75e';
  g.beginPath(); g.ellipse(16 * S, 16.5 * S, 3.4 * S, 4 * S, 0, 0, 7); g.fill();
  // olhos bravos + boca de energia
  g.fillStyle = '#0a1030';
  g.beginPath(); g.moveTo(11.8 * S, 13.5 * S); g.lineTo(14.8 * S, 14.5 * S); g.lineTo(11.8 * S, 15.6 * S); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(20.2 * S, 13.5 * S); g.lineTo(17.2 * S, 14.5 * S); g.lineTo(20.2 * S, 15.6 * S); g.closePath(); g.fill();
  g.fillStyle = '#fff';
  g.fillRect(12.4 * S, 14 * S, 0.9 * S, 0.9 * S); g.fillRect(19 * S, 14 * S, 0.9 * S, 0.9 * S);
  g.strokeStyle = '#0a1030'; g.lineWidth = 1 * S;
  g.beginPath(); g.moveTo(14 * S, 18.6 * S); g.lineTo(15.2 * S, 19.6 * S); g.lineTo(16.4 * S, 18.6 * S); g.lineTo(17.6 * S, 19.6 * S); g.lineTo(18.6 * S, 18.4 * S); g.stroke();
  // faíscas orbitais
  g.fillStyle = '#bff3ff';
  g.fillRect(6 * S, 8 * S, 1.2 * S, 1.2 * S); g.fillRect(24.5 * S, 11 * S, 1.4 * S, 1.4 * S); g.fillRect(22 * S, 4 * S, 1 * S, 1 * S);
  return c;
}

/** Slime Rei: gosma dourada REAL — maior, coroa com joias e bigode real. */
export function makeKing() {
  const c = document.createElement('canvas');
  c.width = 40 * S; c.height = 30 * S;
  const g = c.getContext('2d');
  const color = '#ffd75e', dark = '#b8862e', lite = '#fff3c4';
  g.fillStyle = 'rgba(0,0,0,.3)';
  g.beginPath(); g.ellipse(20 * S, 28 * S, 14 * S, 2 * S, 0, 0, 7); g.fill();
  // manto real atrás
  g.fillStyle = '#8e2b3c';
  g.beginPath(); g.moveTo(6 * S, 26 * S); g.lineTo(4 * S, 12 * S); g.lineTo(10 * S, 14 * S); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(34 * S, 26 * S); g.lineTo(36 * S, 12 * S); g.lineTo(30 * S, 14 * S); g.closePath(); g.fill();
  // corpo dourado com contorno
  g.fillStyle = dark;
  g.beginPath(); g.ellipse(20 * S, 19 * S, 15 * S, 9.5 * S, 0, 0, 7); g.fill();
  g.fillStyle = color;
  g.beginPath(); g.ellipse(20 * S, 19.4 * S, 14 * S, 8.5 * S, 0, 0, 7); g.fill();
  g.fillStyle = lite;
  g.beginPath(); g.ellipse(13.5 * S, 14 * S, 6 * S, 3.4 * S, -0.4, 0, 7); g.fill();
  g.fillStyle = '#fff';
  g.beginPath(); g.ellipse(12 * S, 13.2 * S, 2.2 * S, 1.4 * S, -0.4, 0, 7); g.fill();
  // olhos semicerrados de rei arrogante + sobrancelhas
  g.fillStyle = '#fff';
  g.beginPath(); g.ellipse(15 * S, 18.5 * S, 2.6 * S, 3 * S, 0, 0, 7); g.fill();
  g.beginPath(); g.ellipse(25 * S, 18.5 * S, 2.6 * S, 3 * S, 0, 0, 7); g.fill();
  g.fillStyle = '#101018';
  g.fillRect(14 * S, 19 * S, 2 * S, 2.4 * S); g.fillRect(24 * S, 19 * S, 2 * S, 2.4 * S);
  g.fillStyle = '#fff'; g.fillRect(14 * S, 19 * S, 0.9 * S, 0.9 * S); g.fillRect(24 * S, 19 * S, 0.9 * S, 0.9 * S);
  g.fillStyle = dark;
  g.fillRect(12 * S, 15 * S, 6 * S, 1.2 * S); g.fillRect(22 * S, 15 * S, 6 * S, 1.2 * S);
  // bigode real + boca
  g.fillStyle = '#fff3c4';
  g.fillRect(15 * S, 22.4 * S, 4 * S, 1.2 * S); g.fillRect(21 * S, 22.4 * S, 4 * S, 1.2 * S);
  g.strokeStyle = '#7a4a21'; g.lineWidth = 1 * S;
  g.beginPath(); g.arc(20 * S, 22.6 * S, 2.4 * S, 0.2, Math.PI - 0.2); g.stroke();
  // COROA: base + 3 pontas + joias (tudo dentro do canvas)
  g.fillStyle = '#e8a23c';
  g.fillRect(12 * S, 7 * S, 16 * S, 4.5 * S);
  g.fillStyle = '#c47a1e';
  g.fillRect(12 * S, 10 * S, 16 * S, 1.5 * S);
  const spike = (x) => { g.fillStyle = '#ffe9a8'; g.beginPath(); g.moveTo(x * S, 7 * S); g.lineTo((x + 2.6) * S, 1.2 * S); g.lineTo((x + 5.2) * S, 7 * S); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc((x + 2.6) * S, 1.4 * S, 1.1 * S, 0, 7); g.fill(); };
  spike(12); spike(17.4); spike(22.8);
  g.fillStyle = '#c22a3a';
  g.beginPath(); g.arc(20 * S, 8.2 * S, 1.7 * S, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.fillRect(19.4 * S, 7.4 * S, 0.8 * S, 0.8 * S);
  g.fillStyle = '#4fc3ff'; g.fillRect(14 * S, 7.4 * S, 1.4 * S, 1.4 * S); g.fillRect(24.6 * S, 7.4 * S, 1.4 * S, 1.4 * S);
  return c;
}

/** Morcego Sombrio — corpo peludo, orelhas pontudas, presas e asas com dedos. */
export function makeBat(color = '#6a5cff') {
  const c = document.createElement('canvas');
  c.width = 36 * S; c.height = 22 * S;
  const g = c.getContext('2d');
  const dark = shade(color, -45), lite = shade(color, 35);
  // sombra
  g.fillStyle = 'rgba(0,0,0,.25)';
  g.beginPath(); g.ellipse(18 * S, 20 * S, 9 * S, 1.5 * S, 0, 0, 7); g.fill();
  // asas recortadas com membrana + ossos
  const wing = (flip) => {
    const s = flip ? 1 : -1;
    const bx = 18 * S;
    g.fillStyle = dark;
    g.beginPath();
    g.moveTo(bx, 11 * S);
    g.quadraticCurveTo(bx + s * 8 * S, 3 * S, bx + s * 15 * S, 4 * S);
    g.quadraticCurveTo(bx + s * 13.5 * S, 7 * S, bx + s * 14.5 * S, 9.5 * S);
    g.quadraticCurveTo(bx + s * 12 * S, 10 * S, bx + s * 12.5 * S, 13 * S);
    g.quadraticCurveTo(bx + s * 9 * S, 12.5 * S, bx + s * 7 * S, 15 * S);
    g.quadraticCurveTo(bx + s * 4 * S, 14 * S, bx, 11 * S);
    g.fill();
    // membrana interna + dedos
    g.fillStyle = shade(color, -18);
    g.beginPath();
    g.moveTo(bx, 11 * S);
    g.quadraticCurveTo(bx + s * 7 * S, 5 * S, bx + s * 12.5 * S, 5.5 * S);
    g.quadraticCurveTo(bx + s * 11 * S, 8 * S, bx + s * 11.5 * S, 11 * S);
    g.quadraticCurveTo(bx + s * 7 * S, 11 * S, bx, 11 * S);
    g.fill();
    g.strokeStyle = lite; g.lineWidth = 0.9 * S;
    for (const t of [0.35, 0.62, 0.86]) {
      g.beginPath(); g.moveTo(bx, 11 * S); g.lineTo(bx + s * 13 * S * t, (11 - 6.4 * t) * S); g.stroke();
    }
  };
  wing(false); wing(true);
  // corpo peludo oval + barriga
  g.fillStyle = dark;
  g.beginPath(); g.ellipse(18 * S, 12 * S, 5.4 * S, 6.4 * S, 0, 0, 7); g.fill();
  g.fillStyle = color;
  g.beginPath(); g.ellipse(18 * S, 12.4 * S, 4.4 * S, 5.4 * S, 0, 0, 7); g.fill();
  g.fillStyle = lite;
  g.beginPath(); g.ellipse(18 * S, 14.5 * S, 2.4 * S, 3 * S, 0, 0, 7); g.fill();
  // tufos de pelo
  g.fillStyle = dark;
  g.fillRect(14.6 * S, 7 * S, 1 * S, 1.6 * S); g.fillRect(20.4 * S, 7 * S, 1 * S, 1.6 * S);
  // orelhas pontudas de morcego
  g.fillStyle = color;
  g.beginPath(); g.moveTo(14 * S, 8 * S); g.lineTo(13 * S, 3.5 * S); g.lineTo(16 * S, 6.8 * S); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(22 * S, 8 * S); g.lineTo(23 * S, 3.5 * S); g.lineTo(20 * S, 6.8 * S); g.closePath(); g.fill();
  g.fillStyle = '#ff9db3';
  g.beginPath(); g.moveTo(14.2 * S, 7.2 * S); g.lineTo(13.7 * S, 4.8 * S); g.lineTo(15.2 * S, 6.4 * S); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(21.8 * S, 7.2 * S); g.lineTo(22.3 * S, 4.8 * S); g.lineTo(20.8 * S, 6.4 * S); g.closePath(); g.fill();
  // olhos vermelhos bravos + brilho
  g.fillStyle = '#ff3b3b';
  g.beginPath(); g.ellipse(15.8 * S, 10.5 * S, 1.7 * S, 1.9 * S, 0, 0, 7); g.fill();
  g.beginPath(); g.ellipse(20.2 * S, 10.5 * S, 1.7 * S, 1.9 * S, 0, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.fillRect(15.2 * S, 9.8 * S, 0.9 * S, 0.9 * S); g.fillRect(19.6 * S, 9.8 * S, 0.9 * S, 0.9 * S);
  g.fillStyle = '#400';
  g.fillRect(15.9 * S, 10.6 * S, 0.9 * S, 1.4 * S); g.fillRect(20 * S, 10.6 * S, 0.9 * S, 1.4 * S);
  // focinho + presas brancas + pezinhos
  g.fillStyle = shade(color, -25);
  g.beginPath(); g.ellipse(18 * S, 13.4 * S, 2.2 * S, 1.6 * S, 0, 0, 7); g.fill();
  g.fillStyle = '#fff';
  g.beginPath(); g.moveTo(16.4 * S, 14 * S); g.lineTo(17.2 * S, 16 * S); g.lineTo(18 * S, 14 * S); g.fill();
  g.beginPath(); g.moveTo(19.6 * S, 14 * S); g.lineTo(18.8 * S, 16 * S); g.lineTo(18 * S, 14 * S); g.fill();
  g.fillStyle = '#2a1f3a';
  g.fillRect(15.6 * S, 17.4 * S, 1.4 * S, 1.2 * S); g.fillRect(19 * S, 17.4 * S, 1.4 * S, 1.2 * S);
  return c;
}

/** Golem Jr. — montanha de pedra com núcleo brilhante, punhos e musgo. */
export function makeGolem() {
  const c = document.createElement('canvas');
  c.width = 36 * S; c.height = 34 * S;
  const g = c.getContext('2d');
  const rock = '#7d8494', dark = '#4a4f5e', lite = '#b9bfcf', moss = '#4da64d';
  g.fillStyle = 'rgba(0,0,0,.35)';
  g.beginPath(); g.ellipse(18 * S, 32 * S, 12 * S, 2 * S, 0, 0, 7); g.fill();
  // pernas curtas de pedra
  g.fillStyle = dark;
  g.fillRect(11 * S, 28 * S, 6 * S, 4 * S); g.fillRect(19 * S, 28 * S, 6 * S, 4 * S);
  g.fillStyle = rock;
  g.fillRect(11 * S, 28 * S, 6 * S, 2.5 * S); g.fillRect(19 * S, 28 * S, 6 * S, 2.5 * S);
  // braços gigantes + punhos
  g.fillStyle = dark;
  g.fillRect(3 * S, 14 * S, 7 * S, 12 * S); g.fillRect(26 * S, 14 * S, 7 * S, 12 * S);
  g.fillStyle = rock;
  g.fillRect(3 * S, 14 * S, 7 * S, 10 * S); g.fillRect(26 * S, 14 * S, 7 * S, 10 * S);
  g.fillStyle = lite;
  g.fillRect(3 * S, 14 * S, 7 * S, 1.6 * S); g.fillRect(26 * S, 14 * S, 7 * S, 1.6 * S);
  g.fillStyle = dark;
  g.fillRect(2 * S, 24 * S, 9 * S, 6 * S); g.fillRect(25 * S, 24 * S, 9 * S, 6 * S); // punhos
  g.fillStyle = rock;
  g.fillRect(2 * S, 24 * S, 9 * S, 4 * S); g.fillRect(25 * S, 24 * S, 9 * S, 4 * S);
  g.fillStyle = dark;
  for (let i = 0; i < 3; i++) { g.fillRect((3 + i * 3) * S, 27 * S, 1 * S, 3 * S); g.fillRect((26 + i * 3) * S, 27 * S, 1 * S, 3 * S); }
  // torso blindado de placas
  g.fillStyle = dark;
  g.fillRect(9 * S, 15 * S, 18 * S, 14 * S);
  g.fillStyle = rock;
  g.fillRect(10 * S, 16 * S, 16 * S, 12 * S);
  g.fillStyle = lite;
  g.fillRect(10 * S, 16 * S, 16 * S, 1.8 * S);
  g.fillStyle = dark;
  g.fillRect(10 * S, 21 * S, 16 * S, 1.2 * S); // junta das placas
  g.fillRect(17 * S, 16 * S, 1.2 * S, 12 * S);
  // rachaduras + musgo = pedra antiga
  g.strokeStyle = dark; g.lineWidth = 0.9 * S;
  g.beginPath(); g.moveTo(12 * S, 18 * S); g.lineTo(14 * S, 20 * S); g.lineTo(13 * S, 23 * S); g.stroke();
  g.fillStyle = moss;
  g.fillRect(22 * S, 17 * S, 3 * S, 2 * S); g.fillRect(11 * S, 25 * S, 3 * S, 2 * S);
  // núcleo de cristal no peito (moldura + brilho)
  g.fillStyle = dark;
  g.fillRect(15 * S, 22 * S, 6 * S, 6 * S);
  g.fillStyle = '#1b2f9e';
  g.fillRect(16 * S, 23 * S, 4 * S, 4 * S);
  g.fillStyle = '#4fc3ff';
  g.fillRect(16.6 * S, 23.6 * S, 2.8 * S, 2.8 * S);
  g.fillStyle = '#fff'; g.fillRect(17 * S, 24 * S, 1 * S, 1 * S);
  // cabeça baixa e brava, sem pescoço
  g.fillStyle = dark;
  g.fillRect(11 * S, 5 * S, 14 * S, 11 * S);
  g.fillStyle = rock;
  g.fillRect(12 * S, 6 * S, 12 * S, 9 * S);
  g.fillStyle = lite;
  g.fillRect(12 * S, 6 * S, 12 * S, 2 * S);
  // sobrancelha pesada + olhos amarelos
  g.fillStyle = dark;
  g.fillRect(12 * S, 10 * S, 12 * S, 2.4 * S);
  g.fillStyle = '#ffd75e';
  g.fillRect(13.6 * S, 11 * S, 3 * S, 2 * S); g.fillRect(19.4 * S, 11 * S, 3 * S, 2 * S);
  g.fillStyle = '#4a2f14';
  g.fillRect(14.6 * S, 11 * S, 1 * S, 2 * S); g.fillRect(20.4 * S, 11 * S, 1 * S, 2 * S);
  // boca de pedra + dentes
  g.fillStyle = dark; g.fillRect(15 * S, 13.6 * S, 6 * S, 1.4 * S);
  g.fillStyle = lite; g.fillRect(16 * S, 13.6 * S, 1 * S, 1 * S); g.fillRect(19 * S, 13.6 * S, 1 * S, 1 * S);
  // capacete de pedra
  g.fillStyle = dark;
  g.fillRect(14 * S, 3 * S, 8 * S, 3 * S);
  g.fillStyle = moss; g.fillRect(14 * S, 3 * S, 8 * S, 1 * S);
  return c;
}

/** Caranguejo — casca vermelha, pinças grandes e olhos em hastes. */
export function makeCrab() {
  const c = document.createElement('canvas');
  c.width = 36 * S; c.height = 24 * S;
  const g = c.getContext('2d');
  const shell = '#c22a3a', dark = '#8e1f2b', lite = '#e8606e';
  g.fillStyle = 'rgba(0,0,0,.3)';
  g.beginPath(); g.ellipse(18 * S, 22 * S, 12 * S, 2 * S, 0, 0, 7); g.fill();
  // pernas laterais
  g.fillStyle = dark;
  for (let i = 0; i < 3; i++) {
    g.fillRect((4 + i * 2) * S, (15 + i * 2) * S, 3 * S, 1.2 * S);
    g.fillRect((29 - i * 2) * S, (15 + i * 2) * S, 3 * S, 1.2 * S);
  }
  // braços + pinças
  g.fillStyle = dark;
  g.fillRect(6 * S, 10 * S, 4 * S, 3 * S); g.fillRect(26 * S, 10 * S, 4 * S, 3 * S);
  g.fillStyle = shell;
  g.beginPath(); g.ellipse(6 * S, 8 * S, 3.4 * S, 3 * S, -0.3, 0, 7); g.fill();
  g.beginPath(); g.ellipse(30 * S, 8 * S, 3.4 * S, 3 * S, 0.3, 0, 7); g.fill();
  g.fillStyle = dark;
  g.beginPath(); g.moveTo(4 * S, 6 * S); g.lineTo(8 * S, 6 * S); g.lineTo(6 * S, 9.5 * S); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(28 * S, 6 * S); g.lineTo(32 * S, 6 * S); g.lineTo(30 * S, 9.5 * S); g.closePath(); g.fill();
  g.fillStyle = lite;
  g.fillRect(4.6 * S, 6.6 * S, 1.2 * S, 1.6 * S); g.fillRect(30.2 * S, 6.6 * S, 1.2 * S, 1.6 * S);
  // carapaça oval com brilho
  g.fillStyle = dark;
  g.beginPath(); g.ellipse(18 * S, 16 * S, 10.4 * S, 6.4 * S, 0, 0, 7); g.fill();
  g.fillStyle = shell;
  g.beginPath(); g.ellipse(18 * S, 15.4 * S, 9.4 * S, 5.6 * S, 0, 0, 7); g.fill();
  g.fillStyle = lite;
  g.beginPath(); g.ellipse(14.5 * S, 12.5 * S, 4 * S, 2.2 * S, -0.35, 0, 7); g.fill();
  // olhos em hastes + boca
  g.fillStyle = dark;
  g.fillRect(14.6 * S, 8.4 * S, 1.2 * S, 2.4 * S); g.fillRect(20.2 * S, 8.4 * S, 1.2 * S, 2.4 * S);
  g.fillStyle = '#fff';
  g.beginPath(); g.arc(15.2 * S, 7.8 * S, 1.4 * S, 0, 7); g.fill();
  g.beginPath(); g.arc(20.8 * S, 7.8 * S, 1.4 * S, 0, 7); g.fill();
  g.fillStyle = '#101018';
  g.beginPath(); g.arc(15.2 * S, 7.8 * S, 0.7 * S, 0, 7); g.fill();
  g.beginPath(); g.arc(20.8 * S, 7.8 * S, 0.7 * S, 0, 7); g.fill();
  g.strokeStyle = dark; g.lineWidth = 1 * S;
  g.beginPath(); g.moveTo(16 * S, 17.5 * S); g.quadraticCurveTo(18 * S, 18.5 * S, 20 * S, 17.5 * S); g.stroke();
  return c;
}

/** Escorpião — corpo âmbar, cauda com ferrão e pinças. */
export function makeScorpion() {
  const c = document.createElement('canvas');
  c.width = 38 * S; c.height = 28 * S;
  const g = c.getContext('2d');
  const body = '#c98a3a', dark = '#7a4a21', lite = '#e8b34a';
  g.fillStyle = 'rgba(0,0,0,.3)';
  g.beginPath(); g.ellipse(17 * S, 26 * S, 12 * S, 2 * S, 0, 0, 7); g.fill();
  // cauda segmentada curvada para cima + ferrão
  g.fillStyle = dark;
  g.beginPath(); g.ellipse(28 * S, 20 * S, 4 * S, 3 * S, 0.5, 0, 7); g.fill();
  g.beginPath(); g.ellipse(31 * S, 15 * S, 3.4 * S, 2.6 * S, 0.8, 0, 7); g.fill();
  g.beginPath(); g.ellipse(32.4 * S, 10.4 * S, 2.8 * S, 2.2 * S, 1, 0, 7); g.fill();
  g.fillStyle = body;
  g.beginPath(); g.ellipse(28 * S, 19.6 * S, 3.2 * S, 2.2 * S, 0.5, 0, 7); g.fill();
  g.beginPath(); g.ellipse(31 * S, 14.6 * S, 2.6 * S, 1.8 * S, 0.8, 0, 7); g.fill();
  g.fillStyle = '#3a2410';
  g.beginPath(); g.moveTo(31 * S, 8.6 * S); g.lineTo(35.5 * S, 5 * S); g.lineTo(33.4 * S, 10 * S); g.closePath(); g.fill();
  g.fillStyle = '#8e2bff';
  g.beginPath(); g.arc(34.6 * S, 6.2 * S, 1 * S, 0, 7); g.fill();
  // 6 patas
  g.fillStyle = dark;
  for (let i = 0; i < 3; i++) {
    g.fillRect((9 + i * 4) * S, (21 + (i % 2)) * S, 1.4 * S, 4 * S);
  }
  // pinças dianteiras
  g.fillStyle = dark;
  g.fillRect(3 * S, 15 * S, 4 * S, 2.6 * S); g.fillRect(7 * S, 12 * S, 3 * S, 5 * S);
  g.fillStyle = body;
  g.beginPath(); g.ellipse(4.6 * S, 13 * S, 2.8 * S, 2.6 * S, -0.4, 0, 7); g.fill();
  g.fillStyle = dark;
  g.beginPath(); g.moveTo(2.6 * S, 11 * S); g.lineTo(6 * S, 11 * S); g.lineTo(4.4 * S, 14 * S); g.closePath(); g.fill();
  // corpo oval + placas + olhos
  g.fillStyle = dark;
  g.beginPath(); g.ellipse(17 * S, 18 * S, 9 * S, 6 * S, 0, 0, 7); g.fill();
  g.fillStyle = body;
  g.beginPath(); g.ellipse(17 * S, 17.4 * S, 8 * S, 5.2 * S, 0, 0, 7); g.fill();
  g.fillStyle = dark;
  for (let i = 0; i < 3; i++) g.fillRect((12 + i * 4.4) * S, 14.6 * S, 1 * S, 5.4 * S);
  g.fillStyle = lite;
  g.beginPath(); g.ellipse(14 * S, 14.6 * S, 3 * S, 1.6 * S, -0.3, 0, 7); g.fill();
  g.fillStyle = '#a00';
  g.beginPath(); g.arc(10.4 * S, 15.6 * S, 1.2 * S, 0, 7); g.fill();
  g.beginPath(); g.arc(13.4 * S, 15.6 * S, 1.2 * S, 0, 7); g.fill();
  g.fillStyle = '#fff';
  g.fillRect(10 * S, 15.2 * S, 0.7 * S, 0.7 * S); g.fillRect(13 * S, 15.2 * S, 0.7 * S, 0.7 * S);
  return c;
}

/** Cogumelo — chapéu vermelho de bolinhas, corpo rechonchudo e esporos. */
export function makeShroom() {
  const c = document.createElement('canvas');
  c.width = 32 * S; c.height = 30 * S;
  const g = c.getContext('2d');
  const cap = '#c22a3a', stem = '#f2ead8', dark = '#7a1f2b';
  g.fillStyle = 'rgba(0,0,0,.3)';
  g.beginPath(); g.ellipse(16 * S, 28 * S, 10 * S, 1.8 * S, 0, 0, 7); g.fill();
  // bracinhos
  g.fillStyle = stem;
  g.fillRect(6 * S, 19 * S, 3 * S, 5 * S); g.fillRect(23 * S, 19 * S, 3 * S, 5 * S);
  g.fillStyle = dark;
  g.fillRect(6 * S, 23 * S, 3 * S, 1 * S); g.fillRect(23 * S, 23 * S, 3 * S, 1 * S);
  // corpo
  g.fillStyle = dark;
  g.beginPath(); g.ellipse(16 * S, 22 * S, 8.4 * S, 6.4 * S, 0, 0, 7); g.fill();
  g.fillStyle = stem;
  g.beginPath(); g.ellipse(16 * S, 21.6 * S, 7.4 * S, 5.6 * S, 0, 0, 7); g.fill();
  g.fillStyle = '#d9c9a8';
  g.beginPath(); g.ellipse(16 * S, 24.4 * S, 5 * S, 2.6 * S, 0, 0, 7); g.fill();
  // olhos bravos + boca
  g.fillStyle = '#101018';
  g.beginPath(); g.moveTo(11.4 * S, 19.4 * S); g.lineTo(14.6 * S, 20.4 * S); g.lineTo(11.4 * S, 21.4 * S); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(20.6 * S, 19.4 * S); g.lineTo(17.4 * S, 20.4 * S); g.lineTo(20.6 * S, 21.4 * S); g.closePath(); g.fill();
  g.strokeStyle = dark; g.lineWidth = 1 * S;
  g.beginPath(); g.moveTo(14.4 * S, 23.4 * S); g.quadraticCurveTo(16 * S, 24.2 * S, 17.6 * S, 23.4 * S); g.stroke();
  // chapéu com bolinhas
  g.fillStyle = dark;
  g.beginPath(); g.ellipse(16 * S, 12.6 * S, 12.4 * S, 7.4 * S, 0, 0, 7); g.fill();
  g.fillStyle = cap;
  g.beginPath(); g.ellipse(16 * S, 11.8 * S, 11.4 * S, 6.6 * S, 0, 0, 7); g.fill();
  g.fillStyle = '#e8606e';
  g.beginPath(); g.ellipse(12 * S, 9 * S, 4.4 * S, 2.4 * S, -0.3, 0, 7); g.fill();
  g.fillStyle = '#fff';
  const dot = (x, y, r) => { g.beginPath(); g.arc(x * S, y * S, r * S, 0, 7); g.fill(); };
  dot(10, 11.5, 1.5); dot(16.5, 8.6, 1.8); dot(22.5, 11.8, 1.4); dot(19, 13.8, 1.1); dot(13.4, 14, 1);
  // esporos flutuando
  g.fillStyle = 'rgba(255,255,255,.7)';
  g.fillRect(5 * S, 6 * S, 1.2 * S, 1.2 * S); g.fillRect(26 * S, 8 * S, 1.4 * S, 1.4 * S);
  return c;
}

/** Dragão do Caos (boss) — réptil alado com focinho, asas com garras e cauda com ponta. */
export function makeDragon() {
  const c = document.createElement('canvas');
  c.width = 68 * S; c.height = 50 * S;
  const g = c.getContext('2d');
  const body = '#8e2b3c', dark = '#5e1a28', belly = '#e8b34a', bellyD = '#b8862e';
  g.fillStyle = 'rgba(0,0,0,.35)';
  g.beginPath(); g.ellipse(34 * S, 47 * S, 25 * S, 3 * S, 0, 0, 7); g.fill();
  // asas com membrana + ossatura + garra
  const wing = (flip) => {
    const s = flip ? 1 : -1;
    const bx = 34 * S;
    g.fillStyle = dark;
    g.beginPath();
    g.moveTo(bx, 22 * S);
    g.lineTo(bx + s * 26 * S, 4 * S);
    g.lineTo(bx + s * 22 * S, 16 * S);
    g.lineTo(bx + s * 28 * S, 20 * S);
    g.lineTo(bx + s * 20 * S, 24 * S);
    g.lineTo(bx + s * 22 * S, 30 * S);
    g.lineTo(bx + s * 10 * S, 26 * S);
    g.closePath(); g.fill();
    g.fillStyle = '#a03a4c';
    g.beginPath();
    g.moveTo(bx, 22 * S);
    g.lineTo(bx + s * 22 * S, 8 * S);
    g.lineTo(bx + s * 19 * S, 17 * S);
    g.lineTo(bx + s * 23 * S, 21 * S);
    g.lineTo(bx + s * 17 * S, 24 * S);
    g.lineTo(bx + s * 9 * S, 25 * S);
    g.closePath(); g.fill();
    g.strokeStyle = '#f2ead8'; g.lineWidth = 1.2 * S;
    g.beginPath(); g.moveTo(bx, 22 * S); g.lineTo(bx + s * 26 * S, 4 * S); g.stroke();
    g.fillStyle = '#f2ead8';
    g.beginPath(); g.arc(bx + s * 26 * S, 4 * S, 1.2 * S, 0, 7); g.fill();
  };
  wing(false); wing(true);
  // cauda longa com ponta de flecha
  g.strokeStyle = body; g.lineWidth = 4.6 * S; g.lineCap = 'round';
  g.beginPath(); g.moveTo(34 * S, 38 * S); g.quadraticCurveTo(50 * S, 42 * S, 58 * S, 34 * S); g.stroke();
  g.strokeStyle = dark; g.lineWidth = 1.4 * S;
  g.beginPath(); g.moveTo(34 * S, 38 * S); g.quadraticCurveTo(50 * S, 42 * S, 58 * S, 34 * S); g.stroke();
  g.fillStyle = dark;
  g.beginPath(); g.moveTo(58 * S, 34 * S); g.lineTo(63 * S, 30 * S); g.lineTo(61 * S, 36 * S); g.lineTo(64 * S, 39 * S); g.lineTo(57 * S, 37 * S); g.closePath(); g.fill();
  // patas traseiras com garras
  g.fillStyle = dark;
  g.fillRect(24 * S, 36 * S, 6 * S, 8 * S); g.fillRect(38 * S, 36 * S, 6 * S, 8 * S);
  g.fillStyle = body;
  g.fillRect(24 * S, 36 * S, 6 * S, 6 * S); g.fillRect(38 * S, 36 * S, 6 * S, 6 * S);
  g.fillStyle = '#f2ead8';
  for (const fx of [24, 26.5, 28.4, 38, 40.5, 42.4]) g.fillRect(fx * S, 43 * S, 1.4 * S, 1.8 * S);
  // corpo + barriga com escamas
  g.fillStyle = dark;
  g.beginPath(); g.ellipse(34 * S, 31 * S, 13.6 * S, 12.4 * S, 0, 0, 7); g.fill();
  g.fillStyle = body;
  g.beginPath(); g.ellipse(34 * S, 31 * S, 12.4 * S, 11.4 * S, 0, 0, 7); g.fill();
  g.fillStyle = belly;
  g.beginPath(); g.ellipse(34 * S, 34 * S, 7.4 * S, 8.4 * S, 0, 0, 7); g.fill();
  g.fillStyle = bellyD;
  for (let i = 0; i < 5; i++) g.fillRect((30.6) * S, (28.5 + i * 2.6) * S, 6.8 * S, 0.9 * S);
  // espinhos dorsais
  g.fillStyle = '#f2ead8';
  for (let i = 0; i < 4; i++) {
    const y = (20 + i * 5) * S;
    g.beginPath(); g.moveTo(34 * S, y); g.lineTo(31.4 * S, y - 3.4 * S); g.lineTo(36.6 * S, y - 3.4 * S); g.closePath(); g.fill();
  }
  // braços pequenos com garras
  g.fillStyle = body;
  g.fillRect(22 * S, 28 * S, 4 * S, 7 * S); g.fillRect(42 * S, 28 * S, 4 * S, 7 * S);
  g.fillStyle = '#f2ead8';
  g.fillRect(22 * S, 34 * S, 1.2 * S, 1.6 * S); g.fillRect(24.6 * S, 34 * S, 1.2 * S, 1.6 * S);
  g.fillRect(42 * S, 34 * S, 1.2 * S, 1.6 * S); g.fillRect(44.6 * S, 34 * S, 1.2 * S, 1.6 * S);
  // pescoço grosso + cabeça de dragão com focinho
  g.fillStyle = dark;
  g.fillRect(28 * S, 8 * S, 12 * S, 16 * S);
  g.fillStyle = body;
  g.fillRect(29 * S, 8 * S, 10 * S, 16 * S);
  // focinho alongado + narinas + dentes
  g.fillStyle = body;
  g.fillRect(26 * S, 12 * S, 16 * S, 8 * S);
  g.fillStyle = shade(body, 22);
  g.fillRect(26 * S, 12 * S, 16 * S, 2 * S);
  g.fillStyle = '#3a0a12';
  g.fillRect(28 * S, 14 * S, 2 * S, 1.6 * S); g.fillRect(38 * S, 14 * S, 2 * S, 1.6 * S);
  g.fillStyle = '#fff';
  for (const tx of [28, 30.5, 33, 35.5, 38]) { g.beginPath(); g.moveTo(tx * S, 20 * S); g.lineTo((tx + 1) * S, 22.4 * S); g.lineTo((tx + 2) * S, 20 * S); g.fill(); }
  g.fillStyle = '#5e1a28'; g.fillRect(28 * S, 20 * S, 12 * S, 1.2 * S);
  // crânio + chifres longos curvados + orelhas
  g.fillStyle = body;
  g.beginPath(); g.moveTo(26 * S, 13 * S); g.lineTo(42 * S, 13 * S); g.lineTo(34 * S, 2 * S); g.closePath(); g.fill();
  g.fillStyle = '#f2ead8';
  g.beginPath(); g.moveTo(28 * S, 8 * S); g.lineTo(22.5 * S, 0.5 * S); g.lineTo(30 * S, 5.5 * S); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(40 * S, 8 * S); g.lineTo(45.5 * S, 0.5 * S); g.lineTo(38 * S, 5.5 * S); g.closePath(); g.fill();
  g.fillStyle = '#c9b896';
  g.beginPath(); g.moveTo(28.5 * S, 7 * S); g.lineTo(25 * S, 2.5 * S); g.lineTo(29.4 * S, 5.6 * S); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(39.5 * S, 7 * S); g.lineTo(43 * S, 2.5 * S); g.lineTo(38.6 * S, 5.6 * S); g.closePath(); g.fill();
  // olhos amarelos incandescentes com pupila vertical
  g.fillStyle = '#ffe94f';
  g.fillRect(28.5 * S, 9.5 * S, 4.4 * S, 3.4 * S); g.fillRect(35.4 * S, 9.5 * S, 4.4 * S, 3.4 * S);
  g.fillStyle = '#a00';
  g.fillRect(30 * S, 9.5 * S, 1.6 * S, 3.4 * S); g.fillRect(36.8 * S, 9.5 * S, 1.6 * S, 3.4 * S);
  g.fillStyle = '#fff'; g.fillRect(29 * S, 9.8 * S, 1 * S, 1 * S); g.fillRect(35.8 * S, 9.8 * S, 1 * S, 1 * S);
  return c;
}

/** Cristal (objetivo / decoração do altar) — gema facetada sobre pedestal. */
export function makeCrystal() {
  const c = document.createElement('canvas');
  c.width = 24 * S; c.height = 32 * S;
  const g = c.getContext('2d');
  // brilho de fundo
  g.fillStyle = 'rgba(79,195,255,.25)';
  g.beginPath(); g.ellipse(12 * S, 14 * S, 10 * S, 12 * S, 0, 0, 7); g.fill();
  const grad = g.createLinearGradient(0, 0, 24 * S, 0);
  grad.addColorStop(0, '#d8f8ff'); grad.addColorStop(0.45, '#4fc3ff'); grad.addColorStop(0.8, '#1b2f9e'); grad.addColorStop(1, '#0a1a5e');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(12 * S, 1 * S); g.lineTo(21 * S, 14 * S); g.lineTo(17 * S, 27 * S);
  g.lineTo(7 * S, 27 * S); g.lineTo(3 * S, 14 * S); g.closePath(); g.fill();
  // facetas
  g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 0.8 * S;
  g.beginPath(); g.moveTo(12 * S, 1 * S); g.lineTo(12 * S, 27 * S); g.stroke();
  g.beginPath(); g.moveTo(3 * S, 14 * S); g.lineTo(21 * S, 14 * S); g.stroke();
  g.beginPath(); g.moveTo(7 * S, 6 * S); g.lineTo(10 * S, 14 * S); g.stroke();
  g.beginPath(); g.moveTo(17 * S, 6 * S); g.lineTo(14 * S, 14 * S); g.stroke();
  g.fillStyle = '#ffffffee'; g.fillRect(8.4 * S, 5 * S, 2.2 * S, 10 * S);
  g.fillStyle = '#ffffff88'; g.fillRect(14 * S, 16 * S, 2 * S, 8 * S);
  // pedestal de pedra com runa
  g.fillStyle = '#565b68'; g.fillRect(4 * S, 27 * S, 16 * S, 2 * S);
  g.fillStyle = '#34343f'; g.fillRect(5 * S, 29 * S, 14 * S, 3 * S);
  g.fillStyle = '#8d8d99'; g.fillRect(4 * S, 27 * S, 16 * S, 0.8 * S);
  g.fillStyle = '#4fc3ff'; g.fillRect(11 * S, 29.6 * S, 2 * S, 1.4 * S);
  return c;
}

/* ---------- retratos (close-up p/ diálogo e HUD) ---------- */
const FACE = 52;

/**
 * Recorta (sx,sy,sw,sh) de um sprite e encaixa num retrato 52x52.
 * @param {HTMLCanvasElement} src
 */
export function makePortrait(src, sx, sy, sw, sh) {
  const c = document.createElement('canvas');
  c.width = FACE; c.height = FACE;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  const grad = g.createLinearGradient(0, 0, 0, FACE);
  grad.addColorStop(0, '#1b2f9e'); grad.addColorStop(1, '#0a1030');
  g.fillStyle = grad; g.fillRect(0, 0, FACE, FACE);
  const k = Math.min(FACE / sw, FACE / sh);
  const dw = sw * k, dh = sh * k;
  g.drawImage(src, sx, sy, sw, sh, (FACE - dw) / 2, (FACE - dh) / 2, dw, dh);
  return c;
}

/** Rosto de um humanoide 32x40 (vista de frente). @param {{down:HTMLCanvasElement}} art */
/** Rosto de um humanoide (sempre o frame parado). @param {{down:HTMLCanvasElement|HTMLCanvasElement[]}} art */
export const humanoidFace = (art) => {
  const down = Array.isArray(art.down) ? art.down[0] : (art.down || art);
  const src = (down && down.width ? down : art);
  return makePortrait(src, 5, 0, 22, 21);
};
/** Focinho do dragão 136x100. @param {HTMLCanvasElement} art */
export const dragonFace = (art) => makePortrait(art, 44, 0, 48, 38);
