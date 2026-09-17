#!/usr/bin/env python3
"""Gera index.html — versão ARQUIVO ÚNICO do jogo (duplo clique funciona).

Motivo: ES Modules via file:// são bloqueados pelo navegador (CORS).
Este script resolve os imports, concatena os módulos em ordem topológica,
remove `import`/`export` e embute CSS + JS no HTML. Sem Node, só Python.

Fluxo:
    edite js/ + dev.html  →  python tools/build_single.py  →  abra index.html

Uso:
    python tools/build_single.py
    # abra index.html com duplo clique
"""
from __future__ import annotations

import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

IMPORT_LINE = re.compile(r"""^\s*import\s+(?!\()""")
FROM_RE = re.compile(r"""from\s*['"]([^'"]+)['"]""")


def read(path: str) -> str:
    with open(path, encoding="utf-8") as f:
        return f.read()


def collect_deps(path: str) -> list[str]:
    """Imports relativos de um módulo (uma linha cada, como no projeto)."""
    deps: list[str] = []
    skip = False
    for line in read(path).splitlines():
        s = line.strip()
        if skip:
            if ";" in s:
                skip = False
            continue
        if IMPORT_LINE.match(line) and "import(" not in line:
            m = FROM_RE.search(line)
            if m and m.group(1).startswith("."):
                deps.append(os.path.normpath(os.path.join(os.path.dirname(path), m.group(1))))
            if ";" not in line:
                skip = True
    return deps


def topo(entry: str) -> list[str]:
    order: list[str] = []
    seen: set[str] = set()

    def visit(p: str) -> None:
        if p in seen:
            return
        seen.add(p)
        for d in collect_deps(p):
            visit(d)
        order.append(p)

    visit(entry)
    return order


def strip_module(src: str, rel: str) -> str:
    out: list[str] = []
    skip = False
    for line in src.splitlines():
        s = line.strip()
        if skip:
            if ";" in s:
                skip = False
            continue
        if IMPORT_LINE.match(line) and "import(" not in line:
            if ";" not in line:
                skip = True
            continue
        if re.match(r"^export\s+default\b", s):
            raise SystemExit(f"export default nao suportado pelo bundler: {rel}")
        line = re.sub(r"^(\s*)export\s+(?=(class|const|let|var|function|async\s+function)\b)", r"\1", line)
        if re.match(r"^\s*export\s*\{", line):
            raise SystemExit(f"export {{}} nao suportado pelo bundler: {rel}")
        out.append(line)
    return "\n".join(out)


def main() -> int:
    print("Gerando index.html (arquivo unico)...")
    entry = os.path.join(ROOT, "js", "main.js")
    files = topo(entry)
    print(f"  {len(files)} modulos em ordem topologica")

    parts = []
    for f in files:
        rel = os.path.relpath(f, ROOT)
        if rel.replace(os.sep, "/") == "js/test/AutoTest.js":
            continue
        src = read(f)
        # autoteste só existe no modo servidor (?autotest=1): vira no-op no bundle
        src = src.replace(
            "await import('./test/AutoTest.js')",
            "Promise.resolve({ runAutoTest: async () => {} })",
        )
        body = strip_module(src, rel)
        parts.append(f"\n/* ===== {rel} ===== */\n{body}")

    bundle = "\n".join(parts)
    if re.search(r"^\s*import\s+(?!\()", bundle, re.MULTILINE):
        print("ERRO: restou import nao resolvido no bundle.")
        return 1
    # nomes de topo duplicados quebrariam o bundle (nos módulos são isolados)
    seen: dict[str, str] = {}
    dupes: list[str] = []
    for f in files:
        rel = os.path.relpath(f, ROOT)
        if rel.replace(os.sep, "/") == "js/test/AutoTest.js":
            continue
        for i, line in enumerate(read(f).splitlines(), 1):
            m = re.match(r"^(?:export\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)", line)
            if m:
                if m.group(1) in seen:
                    dupes.append(f"{m.group(1)}: {seen[m.group(1)]} x {rel}:{i}")
                else:
                    seen[m.group(1)] = f"{rel}:{i}"
    if dupes:
        print("ERRO: nomes de topo duplicados no bundle:")
        for d in dupes:
            print("  - " + d)
        return 1

    html = read(os.path.join(ROOT, "dev.html"))
    for css in ("css/base.css", "css/ui.css", "css/battle.css"):
        tag = f'<link rel="stylesheet" href="{css}" />'
        if tag not in html:
            print(f"ERRO: tag esperada nao achada: {tag}")
            return 1
        html = html.replace(tag, "<style>\n" + read(os.path.join(ROOT, css)) + "\n</style>")

    mod_tag = '<script type="module" src="js/main.js"></script>'
    if mod_tag not in html:
        print("ERRO: tag do script principal nao achada.")
        return 1
    html = html.replace(
        mod_tag,
        "<script>\n/* Bundle gerado por tools/build_single.py — não edite. */\n"
        + bundle
        + "\n</script>",
    )

    os.makedirs(ROOT, exist_ok=True)
    out = os.path.join(ROOT, "index.html")
    with open(out, "w", encoding="utf-8") as f:
        f.write(html)
    kb = os.path.getsize(out) // 1024
    print(f"OK - {out} ({kb} KB). Duplo clique para jogar.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
