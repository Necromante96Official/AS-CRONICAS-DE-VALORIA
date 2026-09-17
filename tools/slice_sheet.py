#!/usr/bin/env python3
"""Recorta todos os elementos da folha de referência em arquivos separados.

Estratégias por seção (a folha é irregular — gerada por IA):
  - guillotine: grades coladas (terreno, rios) — divide em linhas/colunas
    escuras recursivamente.
  - components: elementos espaçados — componentes conexos com remoção de
    fundo (flood fill a partir das bordas + furos internos grandes).

Uso:
    python tools/slice_sheet.py [--qa]
    # sai em assets/tiles/<secao>/NNN.png (+ montagens de QA em TEMP)
"""
from __future__ import annotations

import argparse
import os
import sys
import tempfile

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "assets", "tile-reference.png")
OUT = os.path.join(ROOT, "assets", "tiles")

BG_TOL = 12
MIN_AREA = 350
HOLE_MIN = 600
MIN_CELL = 45


def load():
    img = Image.open(SRC).convert("RGB")
    return img, np.array(img).astype(np.int16)


def border_bg(arr: np.ndarray) -> np.ndarray:
    b = np.concatenate([arr[0, :], arr[-1, :], arr[:, 0], arr[:, -1]])
    return np.median(b.reshape(-1, 3), axis=0)


def bg_mask(arr: np.ndarray, bg: np.ndarray) -> np.ndarray:
    return np.sqrt(((arr - bg) ** 2).sum(axis=2)) < BG_TOL


def trim_transparent(cell: np.ndarray) -> np.ndarray | None:
    """Corta bordas 100% transparentes. Retorna None se vazio."""
    alpha = cell[:, :, 3]
    ys, xs = np.where(alpha > 0)
    if len(xs) == 0:
        return None
    return cell[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def extract_components(arr: np.ndarray) -> list[np.ndarray]:
    """Componentes conexos (fundo removido) dentro de um recorte."""
    h, w, _ = arr.shape
    bg = border_bg(arr)
    is_bg = bg_mask(arr, bg)
    # flood fill do fundo a partir das bordas
    exterior = np.zeros((h, w), dtype=bool)
    exterior[0, :] = is_bg[0, :]
    exterior[-1, :] = is_bg[-1, :]
    exterior[:, 0] = is_bg[:, 0]
    exterior[:, -1] = is_bg[:, -1]
    exterior = ndimage.binary_propagation(exterior, mask=is_bg)
    # furos internos grandes de fundo também viram transparência (arcos)
    interior_bg = is_bg & ~exterior
    lab, n = ndimage.label(interior_bg)
    for i in range(1, n + 1):
        if (lab == i).sum() >= HOLE_MIN:
            exterior[lab == i] = True
    fg = ~exterior
    lab, n = ndimage.label(fg, structure=np.ones((3, 3), int))
    out = []
    for i in range(1, n + 1):
        ys, xs = np.where(lab == i)
        if len(xs) < MIN_AREA:
            continue
        pad = 3
        x0, x1 = max(0, xs.min() - pad), min(w, xs.max() + pad + 1)
        y0, y1 = max(0, ys.min() - pad), min(h, ys.max() + pad + 1)
        rgba = np.zeros((y1 - y0, x1 - x0, 4), dtype=np.uint8)
        rgba[:, :, :3] = arr[y0:y1, x0:x1].astype(np.uint8)
        # opaco SÓ neste componente; resto (fundo/outros) transparente
        rgba[:, :, 3] = np.where(lab[y0:y1, x0:x1] == i, 255, 0).astype(np.uint8)
        t = trim_transparent(rgba)
        if t is not None:
            out.append(t)
    return out


def split_guillotine(mask: np.ndarray, x0: int, y0: int, x1: int, y1: int,
                     out: list, thr: float = 0.88) -> None:
    """Divide recursivamente em linhas/colunas escuras de ponta a ponta."""
    w, h = x1 - x0, y1 - y0
    if w < MIN_CELL or h < MIN_CELL:
        out.append((x0, y0, x1, y1))
        return
    sub = mask[y0:y1, x0:x1]
    # linhas e colunas candidatas (fração escura)
    rows = np.where(sub.mean(axis=1) > thr)[0]
    cols = np.where(sub.mean(axis=0) > thr)[0]

    def groups(v):
        gs = []
        for p in v:
            if gs and p - gs[-1][-1] <= 2:
                gs[-1].append(p)
            else:
                gs.append([p])
        return [(g[0], g[-1]) for g in gs if g[-1] - g[0] >= 0]

    best = None  # (score, axis, pos)
    for a, b in groups(rows):
        if a - 0 >= MIN_CELL and h - (b + 1) >= MIN_CELL:
            score = abs((a + b) / 2 - h / 2)
            if best is None or score < best[0]:
                best = (score, 'h', (a + b) // 2)
    for a, b in groups(cols):
        if a - 0 >= MIN_CELL and w - (b + 1) >= MIN_CELL:
            score = abs((a + b) / 2 - w / 2)
            if best is None or score < best[0]:
                best = (score, 'v', (a + b) // 2)
    if best is None:
        out.append((x0, y0, x1, y1))
        return
    _, axis, pos = best
    if axis == 'h':
        split_guillotine(mask, x0, y0, x1, y0 + pos, out, thr)
        split_guillotine(mask, x0, y0 + pos, x1, y1, out, thr)
    else:
        split_guillotine(mask, x0, y0, x0 + pos, y1, out, thr)
        split_guillotine(mask, x0 + pos, y0, x1, y1, out, thr)


def trim_bg_edges(cell: np.ndarray, bg: np.ndarray) -> np.ndarray:
    """Remove fileiras/colunas ~100% fundo nas bordas da célula."""
    h, w, _ = cell.shape
    m = bg_mask(cell[:, :, :3].astype(np.int16), bg)
    top = 0
    while top < h and m[top, :].mean() > 0.97:
        top += 1
    bot = h
    while bot > top and m[bot - 1, :].mean() > 0.97:
        bot -= 1
    lef = 0
    while lef < w and m[:, lef].mean() > 0.97:
        lef += 1
    rig = w
    while rig > lef and m[:, rig - 1].mean() > 0.97:
        rig -= 1
    return cell[top:bot, lef:rig]


def save_cells(cells: list[np.ndarray], sec: str) -> int:
    d = os.path.join(OUT, sec)
    os.makedirs(d, exist_ok=True)
    for f in os.listdir(d):
        if f.endswith('.png'):
            os.remove(os.path.join(d, f))
    # ordena por posição (linhas, depois colunas) — precisa das caixas...
    n = 0
    for i, c in enumerate(cells):
        Image.fromarray(c).save(os.path.join(d, f"{sec}_{i + 1:02d}.png"))
        n += 1
    return n


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--qa", action="store_true", help="gera montagens de QA em TEMP")
    args = ap.parse_args()

    img, arr = load()
    H, W, _ = arr.shape
    full_bg = bg_mask(arr, border_bg(arr))

    # descobre a divisória muralhas/outros e ruínas/paleta (coluna escura y878-996)
    band = full_bg[878:996, 1000:]
    cols = np.where(band.mean(axis=0) > 0.985)[0]
    gutter_x = int(cols.min() + 1000) if len(cols) else 1150
    print(f"divisória direita x={gutter_x}")

    sections = [
        ("terreno", (16, 29, 567, 392), "guillotine"),
        ("rios", (16, 395, 567, 638), "guillotine"),
        ("montanhas", (16, 663, 567, 833), "components"),
        ("arvores", (16, 851, 567, 1003), "components"),
        ("decoracoes", (16, 1031, 567, 1177), "components"),
        ("casas", (585, 29, W, 432), "components"),
        ("interiores", (585, 450, W, 769), "components"),
        ("pontes", (585, 793, W, 871), "components"),
        ("muralhas", (585, 878, gutter_x, 996), "guillotine"),
        ("outros", (gutter_x, 878, W, 996), "components"),
        ("ruinas", (585, 1007, gutter_x, 1174), "components"),
        ("paleta", (gutter_x, 1007, W, 1174), "single"),
    ]

    total = 0
    qa_dir = os.path.join(tempfile.gettempdir(), "opencode", "slice_qa")
    if args.qa:
        os.makedirs(qa_dir, exist_ok=True)
    for sec, (x0, y0, x1, y1), mode in sections:
        crop = arr[y0:y1, x0:x1]
        if mode == "single":
            cells = [np.dstack([crop.astype(np.uint8),
                                np.full(crop.shape[:2], 255, np.uint8)])]
        elif mode == "components":
            cells = extract_components(crop)
        else:
            boxes: list = []
            split_guillotine(full_bg, x0, y0, x1, y1, boxes)
            boxes.sort(key=lambda b: (b[1], b[0]))
            bg = border_bg(crop)
            cells = []
            for bx0, by0, bx1, by1 in boxes:
                c = arr[by0:by1, bx0:bx1].astype(np.uint8)
                t = trim_bg_edges(np.dstack([c, np.full(c.shape[:2], 255, np.uint8)]), bg)
                # ignora filetes
                if t.shape[0] < 20 or t.shape[1] < 20:
                    continue
                cells.append(np.dstack([t[:, :, :3], np.full(t.shape[:2], 255, np.uint8)]))
        n = save_cells(cells, sec)
        total += n
        big = sum(1 for c in cells if c.shape[0] * c.shape[1] > (x1 - x0) * (y1 - y0) * 0.4)
        print(f"{sec:12s} {n:3d} arquivos" + (f"  (ATENÇÃO: {big} grande(s))" if big else ""))
        if args.qa and cells:
            # montagem de QA
            thumbs = []
            for c in cells:
                im = Image.fromarray(c)
                im.thumbnail((128, 128))
                thumbs.append(im)
            cols = 8
            rows = (len(thumbs) + cols - 1) // cols
            sheet = Image.new("RGBA", (cols * 132, rows * 132), (20, 20, 35, 255))
            for i, t in enumerate(thumbs):
                sheet.paste(t, ((i % cols) * 132 + 2, (i // cols) * 132 + 2), t)
            sheet.save(os.path.join(qa_dir, f"qa_{sec}.png"))
    print(f"TOTAL: {total} arquivos em {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
