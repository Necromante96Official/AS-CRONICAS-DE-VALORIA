/**
 * ItemIcons — ícones procedurais do jogo com iluminação e profundidade.
 * Cada ícone é renderizado num medalhão com luz de cima-esquerda:
 * brilho especular, sombra projetada, rim light e borda por raridade.
 * Uso: `ic('potion')` → `<img ...>` | `iconURL('fire')` → dataURL.
 * @module ui/ItemIcons
 */

const ICS = 48;
const cache = {};

/** Caminho de retângulo arredondado. */
function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Gradiente vertical prático. @param {[number,string][]} stops */
function vg(g, y0, y1, stops) {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  return gr;
}

/** Contorno escuro de leitura. */
function ln(g, w = 2) {
  g.strokeStyle = 'rgba(8,8,20,.85)';
  g.lineWidth = w;
  g.lineJoin = 'round';
  g.stroke();
}

/** Brilho especular (luz de cima-esquerda). */
function gloss(g, x, y, rx, ry, rot = -0.5, a = 0.55) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.fillStyle = `rgba(255,255,255,${a})`;
  g.beginPath();
  g.ellipse(0, 0, rx, ry, 0, 0, 7);
  g.fill();
  g.restore();
}

/** Sombra projetada suave sob o objeto. */
function drop(g, cx, cy, rx, ry = 0, a = 0.35) {
  g.fillStyle = `rgba(0,0,8,${a})`;
  g.beginPath();
  g.ellipse(cx, cy, rx, ry || rx * 0.32, 0, 0, 7);
  g.fill();
}

/**
 * Medalhão base: tile azul-profundo com luz interna no topo,
 * borda por raridade e halo para itens raros.
 * @param {string} [accent] cor da borda/halo
 * @param {boolean} [glow] halo externo
 */
function medal(g, accent = '#e8ecff', glow = false) {
  g.clearRect(0, 0, ICS, ICS);
  if (glow) {
    g.save();
    g.shadowColor = accent;
    g.shadowBlur = 12;
    rr(g, 3, 3, ICS - 6, ICS - 6, 10);
    g.fillStyle = '#101c5c';
    g.fill();
    g.restore();
  }
  rr(g, 3, 3, ICS - 6, ICS - 6, 10);
  g.fillStyle = vg(g, 3, ICS - 3, [[0, '#2c3f8c'], [0.45, '#1a2a78'], [1, '#0b123e']]);
  g.fill();
  // luz interna no topo do tile
  rr(g, 6, 6, ICS - 12, (ICS - 12) * 0.44, 7);
  g.fillStyle = 'rgba(255,255,255,.13)';
  g.fill();
  // sombra interna na base
  rr(g, 6, ICS - 6 - (ICS - 12) * 0.3, ICS - 12, (ICS - 12) * 0.3, 7);
  g.fillStyle = 'rgba(0,0,10,.28)';
  g.fill();
  rr(g, 3, 3, ICS - 6, ICS - 6, 10);
  g.strokeStyle = accent;
  g.lineWidth = 2.4;
  g.stroke();
  // filete de luz no canto superior da borda
  g.strokeStyle = 'rgba(255,255,255,.65)';
  g.lineWidth = 1.4;
  g.beginPath();
  g.arc(ICS / 2, ICS / 2, ICS / 2 - 3.4, Math.PI * 1.08, Math.PI * 1.42);
  g.stroke();
}

/* ================= ITENS ================= */

function p_potion(g) {
  drop(g, 24, 39, 11);
  // gargalo + rolha
  g.fillStyle = vg(g, 8, 16, [[0, '#e8b878'], [1, '#8a5a2b']]);
  g.fillRect(20, 8, 8, 9);
  ln(g, 1.6); g.strokeRect(20, 8, 8, 9);
  g.fillStyle = '#5e3a17';
  rr(g, 19, 4.5, 10, 5, 2); g.fill(); ln(g, 1.4);
  // corpo redondo
  const bg = g.createRadialGradient(19, 24, 2, 24, 28, 14);
  bg.addColorStop(0, '#ff9b9b'); bg.addColorStop(0.45, '#e0304e'); bg.addColorStop(1, '#8c1030');
  g.fillStyle = bg;
  g.beginPath(); g.arc(24, 27, 12, 0, 7); g.fill(); ln(g, 2);
  // líquido + bolhas
  g.fillStyle = 'rgba(255,120,140,.5)';
  g.beginPath(); g.arc(24, 29, 8, 0, 7); g.fill();
  g.fillStyle = 'rgba(255,255,255,.75)';
  g.beginPath(); g.arc(21, 29, 1.8, 0, 7); g.fill();
  g.beginPath(); g.arc(27, 32, 1.3, 0, 7); g.fill();
  gloss(g, 19.5, 21.5, 4.4, 2.6);
}

function p_hipotion(g) {
  drop(g, 24, 39.5, 11);
  // frasco alto
  g.fillStyle = vg(g, 6, 16, [[0, '#ffe9a8'], [1, '#c98d2e']]);
  g.fillRect(21, 6, 6, 9);
  ln(g, 1.6); g.strokeRect(21, 6, 6, 9);
  g.fillStyle = '#5e3a17';
  rr(g, 20, 3, 8, 4.6, 2); g.fill(); ln(g, 1.4);
  const bg = g.createRadialGradient(19, 22, 2, 24, 27, 14);
  bg.addColorStop(0, '#ffd75e'); bg.addColorStop(0.5, '#e8763a'); bg.addColorStop(1, '#8c2f10');
  g.fillStyle = bg;
  rr(g, 13, 15, 22, 24, 8); g.fill(); ln(g, 2);
  // cruz dourada de "hi"
  g.fillStyle = '#fff3c4';
  g.fillRect(21.4, 20, 5.2, 13);
  g.fillRect(17, 24.4, 14, 5.2);
  g.strokeStyle = '#8c5a10'; g.lineWidth = 1.2;
  g.strokeRect(21.4, 20, 5.2, 13); g.strokeRect(17, 24.4, 14, 5.2);
  gloss(g, 18.5, 20, 3.6, 5);
}

function p_ether(g) {
  drop(g, 24, 39, 9);
  // vial esguio
  g.fillStyle = vg(g, 8, 15, [[0, '#e8ecff'], [1, '#8d8d99']]);
  rr(g, 19, 8, 10, 7, 2); g.fill(); ln(g, 1.6);
  const bg = g.createLinearGradient(17, 0, 31, 0);
  bg.addColorStop(0, '#2456e0'); bg.addColorStop(0.4, '#7fd4ff'); bg.addColorStop(0.6, '#4fa8e0'); bg.addColorStop(1, '#1b2f9e');
  g.fillStyle = bg;
  rr(g, 17, 15, 14, 24, 6); g.fill(); ln(g, 2);
  // mana brilhante
  g.fillStyle = 'rgba(190,235,255,.8)';
  rr(g, 20, 26, 8, 10, 4); g.fill();
  g.fillStyle = '#fff';
  g.beginPath(); g.arc(22.5, 30, 1.5, 0, 7); g.fill();
  g.beginPath(); g.arc(26, 33, 1.1, 0, 7); g.fill();
  gloss(g, 21, 19.5, 2.6, 4.5);
  // faíscas
  g.fillStyle = 'rgba(160,220,255,.9)';
  g.fillRect(33, 22, 2, 2); g.fillRect(13, 30, 2, 2);
}

function p_antidote(g) {
  drop(g, 24, 39, 11);
  // fumaça ao fundo
  g.fillStyle = 'rgba(200,205,220,.4)';
  g.beginPath(); g.arc(16, 14, 5, 0, 7); g.fill();
  g.beginPath(); g.arc(32, 12, 6, 0, 7); g.fill();
  g.beginPath(); g.arc(24, 9, 5, 0, 7); g.fill();
  // bomba esférica
  const bg = g.createRadialGradient(19, 21, 2, 24, 27, 13);
  bg.addColorStop(0, '#8d8d99'); bg.addColorStop(0.5, '#4a4a58'); bg.addColorStop(1, '#1c1c26');
  g.fillStyle = bg;
  g.beginPath(); g.arc(24, 26, 11.5, 0, 7); g.fill(); ln(g, 2);
  // tampa + pavio + faísca
  g.fillStyle = '#8a5a2b';
  g.fillRect(21, 11, 6, 5);
  ln(g, 1.4); g.strokeRect(21, 11, 6, 5);
  g.strokeStyle = '#d9b878'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(24, 11); g.quadraticCurveTo(27, 7, 31, 8); g.stroke();
  g.fillStyle = '#ffd75e';
  g.beginPath(); g.arc(31.5, 8, 2.6, 0, 7); g.fill();
  g.fillStyle = '#fff';
  g.beginPath(); g.arc(31, 7.4, 1.1, 0, 7); g.fill();
  gloss(g, 19.5, 20.5, 4, 2.4);
  // caveira mínima
  g.fillStyle = '#e8ecff';
  g.beginPath(); g.arc(24, 27, 4, 0, 7); g.fill();
  g.fillStyle = '#101018';
  g.fillRect(21.6, 25.6, 2, 2.4); g.fillRect(24.4, 25.6, 2, 2.4);
  g.fillRect(23.2, 29, 1.6, 1.8);
}

/** Peixe genérico com a cor da espécie. */
function fishBody(g, c1, c2, belly, crown) {
  drop(g, 24, 37, 12);
  // cauda
  g.fillStyle = c1;
  g.beginPath();
  g.moveTo(13, 24); g.lineTo(5, 17); g.lineTo(5, 31);
  g.closePath(); g.fill(); ln(g, 1.8);
  // corpo
  const bg = g.createLinearGradient(0, 14, 0, 34);
  bg.addColorStop(0, c1); bg.addColorStop(0.55, c2); bg.addColorStop(1, belly);
  g.fillStyle = bg;
  g.beginPath(); g.ellipse(25, 24, 13, 8, 0, 0, 7); g.fill(); ln(g, 2);
  // barriga clara
  g.fillStyle = belly;
  g.globalAlpha = 0.75;
  g.beginPath(); g.ellipse(26, 27.5, 9, 3.6, 0, 0, 7); g.fill();
  g.globalAlpha = 1;
  // escamas
  g.fillStyle = 'rgba(255,255,255,.55)';
  for (const [ex, ey] of [[20, 22], [24, 21], [28, 22], [22, 25], [26, 26], [30, 25]]) {
    g.beginPath(); g.arc(ex, ey, 1.2, 0, 7); g.fill();
  }
  // dorsal
  g.fillStyle = c1;
  g.beginPath(); g.moveTo(21, 16.5); g.lineTo(25, 11); g.lineTo(29, 16.5); g.closePath(); g.fill(); ln(g, 1.4);
  // guelra + olho com brilho
  g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1.2;
  g.beginPath(); g.arc(29, 24, 3.6, -1.1, 1.1); g.stroke();
  g.fillStyle = '#fff';
  g.beginPath(); g.arc(32, 22, 2.6, 0, 7); g.fill();
  g.fillStyle = '#101018';
  g.beginPath(); g.arc(32.7, 22, 1.3, 0, 7); g.fill();
  g.fillStyle = '#fff';
  g.beginPath(); g.arc(33.1, 21.6, 0.5, 0, 7); g.fill();
  gloss(g, 21, 18.5, 5, 2.2, -0.4, 0.4);
  if (crown) {
    g.fillStyle = '#ffd75e';
    for (let i = -1; i <= 1; i++) {
      g.beginPath();
      g.moveTo(22 + i * 3.4 - 1.6, 12); g.lineTo(22 + i * 3.4, 8.4); g.lineTo(22 + i * 3.4 + 1.6, 12);
      g.closePath(); g.fill();
    }
    ln(g, 1);
  }
}

function p_fish(g) { fishBody(g, '#2e7dc9', '#4fa8e0', '#cfeaff', false); }
function p_lambari(g) { fishBody(g, '#8d99b5', '#b9c8de', '#eef2fa', false); }
function p_royal(g) { fishBody(g, '#2b44c4', '#3b5fe0', '#9fb2ff', true); }
function p_goldfish(g) {
  fishBody(g, '#c97a10', '#e8a91e', '#ffe9a8', true);
  g.fillStyle = 'rgba(255,233,150,.9)';
  g.fillRect(7, 10, 2.2, 2.2); g.fillRect(39, 13, 2.2, 2.2); g.fillRect(38, 33, 2, 2);
}

function p_phoenix(g) {
  drop(g, 24, 38, 10);
  // brasas
  g.fillStyle = 'rgba(255,150,60,.55)';
  g.fillRect(14, 34, 2.4, 2.4); g.fillRect(32, 35, 2, 2); g.fillRect(24, 37, 2, 2);
  // haste
  g.strokeStyle = '#ffe9c4'; g.lineWidth = 2.2;
  g.beginPath(); g.moveTo(24, 40); g.quadraticCurveTo(23, 26, 25, 10); g.stroke();
  // barbas da pena (camadas fogo)
  const layer = (dx, c) => {
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(25, 9);
    g.quadraticCurveTo(25 + dx, 18, 24.5 + dx * 0.3, 30);
    g.quadraticCurveTo(24, 34, 23.5, 30);
    g.quadraticCurveTo(23 - dx * 0.5, 20, 25, 9);
    g.fill();
  };
  layer(11, '#c22a1e');
  layer(7.5, '#e8763a');
  layer(4, '#ffd75e');
  ln(g, 1.6);
  gloss(g, 24, 15, 1.8, 4, 0.15, 0.7);
}

/* ================= MAGIAS ================= */

function p_fire(g) {
  drop(g, 24, 39, 10);
  const flame = (s, c) => {
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(24, 40 - s);
    g.quadraticCurveTo(24 + s * 0.62, 40 - s * 0.55, 24 + s * 0.34, 40 - s * 0.28 + 6);
    g.quadraticCurveTo(24 + s * 0.5, 40, 24, 40);
    g.quadraticCurveTo(24 - s * 0.5, 40, 24 - s * 0.34, 40 - s * 0.28 + 6);
    g.quadraticCurveTo(24 - s * 0.62, 40 - s * 0.55, 24, 40 - s);
    g.fill();
  };
  flame(31, '#c22a1e');
  flame(23, '#e8763a');
  flame(15, '#ffd75e');
  flame(8, '#fff8dc');
  ln(g, 1.6);
  gloss(g, 19, 28, 2.4, 4, 0.3, 0.6);
}

function p_thunder(g) {
  drop(g, 24, 39, 10);
  // halo
  g.fillStyle = 'rgba(255,220,90,.25)';
  g.beginPath(); g.arc(24, 24, 14, 0, 7); g.fill();
  g.fillStyle = vg(g, 6, 42, [[0, '#fff8dc'], [0.5, '#ffe95e'], [1, '#c98d2e']]);
  g.beginPath();
  g.moveTo(29, 6); g.lineTo(17, 26); g.lineTo(23, 26); g.lineTo(19, 42);
  g.lineTo(31, 21); g.lineTo(25, 21);
  g.closePath(); g.fill(); ln(g, 2);
  gloss(g, 24, 14, 2, 5, 0.2, 0.7);
}

function p_cure(g) {
  drop(g, 24, 39, 11);
  // orbe verde
  const bg = g.createRadialGradient(20, 20, 2, 24, 25, 14);
  bg.addColorStop(0, '#9dffc4'); bg.addColorStop(0.5, '#37e08b'); bg.addColorStop(1, '#0f7a44');
  g.fillStyle = bg;
  g.beginPath(); g.arc(24, 25, 12.5, 0, 7); g.fill(); ln(g, 2);
  // cruz branca com sombra interna
  g.fillStyle = 'rgba(0,0,10,.25)';
  g.fillRect(21.5, 17.5, 6, 17); g.fillRect(16.5, 22.5, 16, 6);
  g.fillStyle = '#f2fff6';
  g.fillRect(21, 16.5, 6, 17); g.fillRect(16, 21.5, 16, 6);
  g.strokeStyle = '#0f7a44'; g.lineWidth = 1.2;
  g.strokeRect(21, 16.5, 6, 17); g.strokeRect(16, 21.5, 16, 6);
  gloss(g, 19.5, 18.5, 4, 2.4);
  // cintilações
  g.fillStyle = 'rgba(160,255,190,.9)';
  g.fillRect(35, 14, 2, 2); g.fillRect(11, 33, 2, 2);
}

/* ================= COMANDOS / UI ================= */

function p_attack(g) {
  drop(g, 24, 39, 10);
  g.save();
  g.translate(24, 24); g.rotate(-0.7);
  // lâmina
  const bg = g.createLinearGradient(-3, 0, 3, 0);
  bg.addColorStop(0, '#8d8d99'); bg.addColorStop(0.5, '#f2f4ff'); bg.addColorStop(1, '#9aa0ad');
  g.fillStyle = bg;
  g.beginPath();
  g.moveTo(0, -19); g.lineTo(3.4, -14); g.lineTo(3.4, 6); g.lineTo(-3.4, 6); g.lineTo(-3.4, -14);
  g.closePath(); g.fill(); ln(g, 1.8);
  g.fillStyle = 'rgba(255,255,255,.8)';
  g.fillRect(-2, -13, 1.6, 17);
  // guarda + punho + pomo
  g.fillStyle = vg(g, 6, 10, [[0, '#ffe9a8'], [1, '#c98d2e']]);
  g.fillRect(-8, 6, 16, 4); ln(g, 1.6);
  g.fillStyle = '#5e3a17';
  g.fillRect(-2.4, 10, 4.8, 8); ln(g, 1.4);
  g.fillStyle = '#ffd75e';
  g.beginPath(); g.arc(0, 20, 3, 0, 7); g.fill(); ln(g, 1.4);
  g.restore();
  // brilho de corte
  g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(30, 12); g.lineTo(36, 6); g.stroke();
}

function p_magic(g) {
  drop(g, 24, 39, 9);
  // varinha
  g.save();
  g.translate(24, 26); g.rotate(-0.6);
  g.strokeStyle = '#8a5a2b'; g.lineWidth = 4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, 12); g.lineTo(0, -8); g.stroke();
  g.strokeStyle = '#3a2412'; g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(0, 12); g.lineTo(0, -8); g.stroke();
  g.restore();
  // explosão de estrelas
  const star = (x, y, r, c) => {
    g.fillStyle = c;
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const rad = i % 2 === 0 ? r : r * 0.42;
      g[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    }
    g.closePath(); g.fill();
  };
  star(28, 13, 9, '#c9a8ff');
  star(28, 13, 5.5, '#efe6ff');
  star(28, 13, 2.4, '#fff');
  star(15, 30, 4, '#8a6fd6');
  star(35, 29, 3, '#6a3ec2');
  ln(g, 1.2);
}

function p_item(g) {
  drop(g, 24, 39, 10);
  // mochila
  g.fillStyle = vg(g, 14, 38, [[0, '#c98d4e'], [1, '#7a4e22']]);
  rr(g, 14, 14, 20, 24, 7); g.fill(); ln(g, 2);
  // aba + fivela
  g.fillStyle = vg(g, 14, 24, [[0, '#8a5a2b'], [1, '#5e3a17']]);
  rr(g, 14, 14, 20, 11, 6); g.fill(); ln(g, 1.6);
  g.fillStyle = vg(g, 24, 30, [[0, '#ffe9a8'], [1, '#c98d2e']]);
  rr(g, 21, 24, 6, 7, 2); g.fill(); ln(g, 1.4);
  // alças
  g.strokeStyle = '#5e3a17'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(18, 14); g.quadraticCurveTo(18, 8, 24, 8); g.stroke();
  g.beginPath(); g.moveTo(30, 14); g.quadraticCurveTo(30, 8, 24, 8); g.stroke();
  gloss(g, 20, 20, 3, 5, 0.2, 0.4);
  // poção espiando no bolso lateral
  g.fillStyle = '#e0304e';
  g.beginPath(); g.arc(32, 32, 4, 0, 7); g.fill(); ln(g, 1.4);
  gloss(g, 30.8, 30.5, 1.4, 1);
}

function p_scan(g) {
  drop(g, 26, 39, 10);
  // lente
  const bg = g.createRadialGradient(19, 19, 2, 22, 22, 13);
  bg.addColorStop(0, '#e8fbff'); bg.addColorStop(0.55, '#7fd4ff'); bg.addColorStop(1, '#2456e0');
  g.fillStyle = bg;
  g.beginPath(); g.arc(21, 21, 11, 0, 7); g.fill();
  g.strokeStyle = '#8a5a2b'; g.lineWidth = 4; g.stroke();
  g.strokeStyle = 'rgba(8,8,20,.85)'; g.lineWidth = 1.6; g.stroke();
  // cabo
  g.strokeStyle = '#5e3a17'; g.lineWidth = 5; g.lineCap = 'round';
  g.beginPath(); g.moveTo(29, 29); g.lineTo(37, 37); g.stroke();
  g.strokeStyle = '#c98d4e'; g.lineWidth = 2.4;
  g.beginPath(); g.moveTo(29, 29); g.lineTo(37, 37); g.stroke();
  // reflexo + "?"
  gloss(g, 17, 16.5, 4, 2.4);
  g.fillStyle = '#101c5c';
  g.font = 'bold 11px monospace'; g.textAlign = 'center';
  g.fillText('?', 21, 26);
}

function p_flee(g) {
  drop(g, 24, 39, 10);
  // asa em 3 penas
  const feather = (x, w, c1, c2) => {
    const bg = g.createLinearGradient(0, 12, 0, 36);
    bg.addColorStop(0, c1); bg.addColorStop(1, c2);
    g.fillStyle = bg;
    g.beginPath();
    g.ellipse(x, 24, w, 12, -0.5, 0, 7);
    g.fill(); ln(g, 1.8);
  };
  feather(17, 6.5, '#e8fbff', '#7fa3c9');
  feather(24, 7.5, '#f2f6ff', '#5a8cc9');
  feather(31, 6.5, '#ffffff', '#8fb8e8');
  gloss(g, 20, 17, 5, 2, -0.4, 0.5);
  // linhas de vento
  g.strokeStyle = 'rgba(200,230,255,.8)'; g.lineWidth = 2; g.lineCap = 'round';
  for (const [y, l] of [[33, 10], [36.5, 14], [40, 9]]) {
    g.beginPath(); g.moveTo(10, y); g.lineTo(10 + l, y); g.stroke();
  }
}

function p_guard(g) {
  drop(g, 24, 39, 10);
  // escudo
  const bg = g.createLinearGradient(0, 8, 0, 40);
  bg.addColorStop(0, '#4f7de0'); bg.addColorStop(0.55, '#2b56c9'); bg.addColorStop(1, '#16247c');
  g.fillStyle = bg;
  g.beginPath();
  g.moveTo(24, 7);
  g.quadraticCurveTo(35, 10, 35, 12);
  g.quadraticCurveTo(35, 28, 24, 41);
  g.quadraticCurveTo(13, 28, 13, 12);
  g.quadraticCurveTo(13, 10, 24, 7);
  g.closePath(); g.fill(); ln(g, 2);
  // borda dourada interna
  g.strokeStyle = '#ffd75e'; g.lineWidth = 1.8;
  g.beginPath();
  g.moveTo(24, 10.5);
  g.quadraticCurveTo(31.5, 12.5, 31.5, 13.5);
  g.quadraticCurveTo(31.5, 25.5, 24, 36.5);
  g.quadraticCurveTo(16.5, 25.5, 16.5, 13.5);
  g.quadraticCurveTo(16.5, 12.5, 24, 10.5);
  g.stroke();
  // emblema + brilho
  const eg = g.createRadialGradient(22, 20, 1, 24, 23, 7);
  eg.addColorStop(0, '#fff3c4'); eg.addColorStop(1, '#c98d2e');
  g.fillStyle = eg;
  g.beginPath(); g.arc(24, 23, 5.4, 0, 7); g.fill(); ln(g, 1.4);
  gloss(g, 19.5, 14.5, 3.4, 2);
}

function p_gold(g) {
  drop(g, 24, 39, 10);
  // pilha: 2 moedas na base + 1 no topo
  const coin = (x, y, rx, ry) => {
    const bg = g.createRadialGradient(x - 3, y - 3, 1, x, y, rx + 2);
    bg.addColorStop(0, '#fff3c4'); bg.addColorStop(0.5, '#ffd75e'); bg.addColorStop(1, '#a86e14');
    g.fillStyle = bg;
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill(); ln(g, 1.8);
    g.strokeStyle = '#a86e14'; g.lineWidth = 1.4;
    g.beginPath(); g.ellipse(x, y, rx - 3.4, ry - 2.4, 0, 0, 7); g.stroke();
  };
  coin(17, 31, 8, 5.4);
  coin(31, 31, 8, 5.4);
  coin(24, 24, 9.5, 6.4);
  // "G" em relevo + brilho
  g.fillStyle = '#a86e14';
  g.font = 'bold 10px monospace'; g.textAlign = 'center';
  g.fillText('G', 24, 27.5);
  g.fillStyle = 'rgba(255,255,255,.85)';
  g.fillText('G', 23.4, 26.9);
  gloss(g, 20.5, 20.5, 3.6, 1.8);
}

function p_bed(g) {
  drop(g, 24, 39, 12);
  // estrutura
  g.fillStyle = vg(g, 26, 36, [[0, '#8a5a2b'], [1, '#5e3a17']]);
  g.fillRect(9, 28, 30, 4); ln(g, 1.6);
  g.fillStyle = '#5e3a17';
  g.fillRect(9, 20, 3, 14); g.fillRect(36, 20, 3, 14);
  // cabeceira
  g.fillStyle = vg(g, 12, 30, [[0, '#a8763e'], [1, '#6e451f']]);
  rr(g, 8, 12, 5, 20, 2); g.fill(); ln(g, 1.4);
  // colchão + coberta + travesseiro
  g.fillStyle = '#e8e4da';
  rr(g, 12, 24, 25, 6, 3); g.fill(); ln(g, 1.4);
  g.fillStyle = vg(g, 22, 30, [[0, '#4f7de0'], [1, '#1b2f9e']]);
  rr(g, 19, 22, 18, 8, 3); g.fill(); ln(g, 1.4);
  g.fillStyle = '#fff';
  rr(g, 12.5, 20.5, 8, 5, 2); g.fill(); ln(g, 1.2);
  // "Z" do sono
  g.fillStyle = '#9fb2ff';
  g.font = 'bold 10px monospace'; g.textAlign = 'center';
  g.fillText('Z', 38, 14);
  g.font = 'bold 7px monospace';
  g.fillText('Z', 42, 9);
  gloss(g, 24, 23.5, 6, 1.4, 0, 0.3);
}

function p_save(g) {
  drop(g, 24, 39, 10);
  g.fillStyle = vg(g, 10, 38, [[0, '#4f7de0'], [1, '#1b2f9e']]);
  rr(g, 12, 10, 24, 28, 3); g.fill(); ln(g, 2);
  // etiqueta + obturador
  g.fillStyle = '#e8e4da';
  g.fillRect(16, 26, 16, 9);
  ln(g, 1.2); g.strokeRect(16, 26, 16, 9);
  g.fillStyle = '#8d8d99';
  g.fillRect(19, 10, 10, 9);
  ln(g, 1.2); g.strokeRect(19, 10, 10, 9);
  g.fillStyle = '#2456e0';
  g.fillRect(22.5, 12, 3, 5);
  gloss(g, 18, 15, 4, 6, 0.2, 0.35);
}

function p_quest(g) {
  drop(g, 24, 39, 10);
  // pergaminho
  g.fillStyle = vg(g, 12, 36, [[0, '#f2e6c4'], [1, '#c9a86a']]);
  rr(g, 12, 12, 24, 24, 3); g.fill(); ln(g, 2);
  g.fillStyle = '#8a5a2b';
  g.fillRect(12, 12, 4, 24); g.fillRect(32, 12, 4, 24);
  // linhas de escrita
  g.fillStyle = 'rgba(90,60,20,.7)';
  for (const y of [19, 23, 27]) g.fillRect(18, y, 12, 1.6);
  // selo vermelho
  const sg = g.createRadialGradient(22, 29, 1, 24, 30, 5);
  sg.addColorStop(0, '#ff8a8a'); sg.addColorStop(1, '#a01830');
  g.fillStyle = sg;
  g.beginPath(); g.arc(24, 30, 4.4, 0, 7); g.fill(); ln(g, 1.4);
  gloss(g, 22.5, 28.5, 1.4, 1);
  gloss(g, 20, 15, 5, 2, 0, 0.3);
}

function p_status(g) {
  drop(g, 24, 39, 10);
  // medalha de herói
  const bg = g.createRadialGradient(21, 21, 2, 24, 25, 13);
  bg.addColorStop(0, '#9dffc4'); bg.addColorStop(0.55, '#37e08b'); bg.addColorStop(1, '#0f7a44');
  g.fillStyle = bg;
  g.beginPath(); g.arc(24, 24, 12, 0, 7); g.fill(); ln(g, 2);
  g.strokeStyle = '#ffd75e'; g.lineWidth = 1.6;
  g.beginPath(); g.arc(24, 24, 9, 0, 7); g.stroke();
  // estrela
  g.fillStyle = '#fff8dc';
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    const rad = i % 2 === 0 ? 7 : 3;
    g[i ? 'lineTo' : 'moveTo'](24 + Math.cos(a) * rad, 24 + Math.sin(a) * rad);
  }
  g.closePath(); g.fill(); ln(g, 1.2);
  gloss(g, 19.5, 18, 4, 2.2);
}

function p_config(g) {
  drop(g, 24, 39, 10);
  // engrenagem
  g.fillStyle = vg(g, 10, 38, [[0, '#c0c6d0'], [1, '#5a6270']]);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.save();
    g.translate(24 + Math.cos(a) * 10.5, 24 + Math.sin(a) * 10.5);
    g.rotate(a);
    g.fillRect(-2.4, -2.4, 4.8, 4.8);
    g.restore();
  }
  g.beginPath(); g.arc(24, 24, 9.5, 0, 7); g.fill(); ln(g, 2);
  g.fillStyle = '#101c5c';
  g.beginPath(); g.arc(24, 24, 4, 0, 7); g.fill();
  gloss(g, 20, 18, 4.5, 2.4);
}

function p_sound(g) {
  drop(g, 24, 38, 10);
  // alto-falante
  g.fillStyle = vg(g, 14, 30, [[0, '#8d8d99'], [1, '#4a4a58']]);
  g.beginPath();
  g.moveTo(12, 20); g.lineTo(19, 20); g.lineTo(26, 13); g.lineTo(26, 35); g.lineTo(19, 28); g.lineTo(12, 28);
  g.closePath(); g.fill(); ln(g, 1.8);
  // ondas
  g.strokeStyle = '#7fd4ff'; g.lineWidth = 2.4; g.lineCap = 'round';
  for (const [r, a] of [[6, 1], [10, 0.7]]) {
    g.globalAlpha = a;
    g.beginPath(); g.arc(27, 24, r, -0.9, 0.9); g.stroke();
  }
  g.globalAlpha = 1;
  gloss(g, 18, 17, 3, 1.8);
}

function p_mute(g) {
  p_sound(g);
  // X vermelho por cima
  g.strokeStyle = '#ff6b6b'; g.lineWidth = 4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(30, 15); g.lineTo(41, 27); g.stroke();
  g.beginPath(); g.moveTo(41, 15); g.lineTo(30, 27); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(30, 15); g.lineTo(41, 27); g.stroke();
}

function p_slot(g) {
  drop(g, 24, 39, 10);
  // cristal de save
  const bg = g.createLinearGradient(0, 8, 0, 40);
  bg.addColorStop(0, '#e8fbff'); bg.addColorStop(0.45, '#4fc3ff'); bg.addColorStop(1, '#1b2f9e');
  g.fillStyle = bg;
  g.beginPath();
  g.moveTo(24, 8); g.lineTo(34, 22); g.lineTo(24, 40); g.lineTo(14, 22);
  g.closePath(); g.fill(); ln(g, 2);
  g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(24, 12); g.lineTo(30, 22); g.lineTo(24, 35); g.stroke();
  gloss(g, 21, 15, 2.4, 3.4, 0.25, 0.8);
}

function p_qdone(g) {
  drop(g, 24, 39, 10);
  const bg = g.createRadialGradient(21, 21, 2, 24, 25, 13);
  bg.addColorStop(0, '#9dffc4'); bg.addColorStop(0.55, '#37e08b'); bg.addColorStop(1, '#0f7a44');
  g.fillStyle = bg;
  g.beginPath(); g.arc(24, 24, 12, 0, 7); g.fill(); ln(g, 2);
  g.strokeStyle = '#fff'; g.lineWidth = 4.4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(17.5, 24.5); g.lineTo(22.5, 29.5); g.lineTo(31, 18.5); g.stroke();
  g.strokeStyle = '#0f7a44'; g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(17.5, 24.5); g.lineTo(22.5, 29.5); g.lineTo(31, 18.5); g.stroke();
  gloss(g, 19.5, 18, 4, 2.2);
}

function p_qtodo(g) {
  drop(g, 24, 39, 10);
  // ampulheta
  g.fillStyle = vg(g, 10, 38, [[0, '#8a5a2b'], [1, '#5e3a17']]);
  g.fillRect(15, 10, 18, 3.4); g.fillRect(15, 34.6, 18, 3.4);
  ln(g, 1.4);
  g.fillStyle = vg(g, 13, 35, [[0, '#cfe8ff'], [1, '#7fa3c9']]);
  g.beginPath();
  g.moveTo(17, 13.4); g.lineTo(31, 13.4); g.lineTo(26, 24); g.lineTo(31, 34.6);
  g.lineTo(17, 34.6); g.lineTo(22, 24);
  g.closePath(); g.fill(); ln(g, 1.8);
  // areia dourada
  g.fillStyle = '#ffd75e';
  g.beginPath();
  g.moveTo(20.5, 32); g.lineTo(27.5, 32); g.lineTo(25, 26.5); g.lineTo(23, 26.5);
  g.closePath(); g.fill();
  g.fillRect(23.4, 18, 1.2, 8);
  gloss(g, 20, 16, 2.6, 2);
}

function p_spark(g) {
  drop(g, 24, 39, 9);
  g.fillStyle = '#c9a8ff';
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rad = i % 2 === 0 ? 13 : 5.4;
    g[i ? 'lineTo' : 'moveTo'](24 + Math.cos(a) * rad, 24 + Math.sin(a) * rad);
  }
  g.closePath(); g.fill(); ln(g, 1.8);
  g.fillStyle = '#fff';
  g.beginPath(); g.arc(24, 24, 3.4, 0, 7); g.fill();
}

/* ================= REGISTRO ================= */

const PAINT = {
  potion: p_potion, hipotion: p_hipotion, ether: p_ether, antidote: p_antidote,
  fish: p_fish, lambari: p_lambari, royal: p_royal, goldfish: p_goldfish, phoenix: p_phoenix,
  fire: p_fire, thunder: p_thunder, cure: p_cure,
  attack: p_attack, magic: p_magic, item: p_item, scan: p_scan, flee: p_flee, guard: p_guard,
  gold: p_gold, bed: p_bed, save: p_save, quest: p_quest, status: p_status, config: p_config,
  sound: p_sound, mute: p_mute, slot: p_slot, qdone: p_qdone, qtodo: p_qtodo,
};

/** Borda/halo por id (raridade). @returns {[string, boolean]} */
function accentFor(id) {
  switch (id) {
    case 'goldfish': return ['#ffd75e', true];
    case 'royal': return ['#6b8cff', true];
    case 'phoenix': return ['#ff9b5b', true];
    case 'hipotion': return ['#ffd75e', false];
    case 'thunder': return ['#ffe95e', true];
    case 'fire': return ['#ff8a6b', false];
    case 'cure': return ['#37e08b', false];
    case 'gold': return ['#ffd75e', true];
    default: return ['#e8ecff', false];
  }
}

/** dataURL (memoizado) do ícone. @param {string} id */
export function iconURL(id) {
  if (cache[id]) return cache[id];
  const cv = document.createElement('canvas');
  cv.width = ICS; cv.height = ICS;
  const g = cv.getContext('2d');
  const [accent, glow] = accentFor(id);
  medal(g, accent, glow);
  (PAINT[id] || p_spark)(g);
  const url = cv.toDataURL();
  cache[id] = url;
  return url;
}

/** Tag `<img>` pronta p/ linhas de menu/batalha. @param {string} id @param {number} [px] */
export function ic(id, px = 22) {
  return `<img class="ic" width="${px}" height="${px}" src="${iconURL(id)}" alt="" draggable="false" />`;
}

/** Pré-aquece o cache (chamar na abertura do jogo). */
export function preloadIcons() {
  for (const id of Object.keys(PAINT)) iconURL(id);
}
