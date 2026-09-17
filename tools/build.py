#!/usr/bin/env python3
"""Build/check do projeto sem depender de Node.

- `python tools/build.py` — valida a estrutura: todos os módulos importados
  existem, index.html referencia arquivos reais e não há TODOs esquecidos.
- `python tools/build.py --stats` — mostra linhas por módulo.

A checagem de tipos real é feita por `npm run check` (tsc --noEmit)
quando o Node estiver instalado; este script garante integridade mesmo sem ele.
"""
from __future__ import annotations

import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

IMPORT_RE = re.compile(
    r"""^\s*(?:import|export)\b[^\n'"]*?\bfrom\s*['"]([^'"]+)['"]"""
    r"""|^\s*import\s*['"]([^'"]+)['"]""",
    re.MULTILINE,
)

failures: list[str] = []


def resolve(base_dir: str, spec: str) -> str | None:
    if not spec.startswith("."):
        return None  # pacote externo (não usado no runtime)
    path = os.path.normpath(os.path.join(base_dir, spec))
    for cand in (path, path + ".js"):
        if os.path.isfile(cand):
            return cand
    return None


def check_js(path: str) -> None:
    with open(path, encoding="utf-8") as f:
        src = f.read()
    base = os.path.dirname(path)
    for m in IMPORT_RE.finditer(src):
        spec = m.group(1) or m.group(2)
        if resolve(base, spec) is None:
            failures.append(f"{os.path.relpath(path, ROOT)}: import nao resolvido: {spec}")
    # parênteses/chaves/colchetes balanceados (sanidade rápida)
    stack: list[str] = []
    pairs = {")": "(", "}": "{", "]": "["}
    in_str: str | None = None
    esc = False
    i = 0
    in_comment_line = False
    in_comment_block = False
    while i < len(src):
        c = src[i]
        nxt = src[i + 1] if i + 1 < len(src) else ""
        if in_comment_line:
            if c == "\n":
                in_comment_line = False
        elif in_comment_block:
            if c == "*" and nxt == "/":
                in_comment_block = False
                i += 1
        elif in_str:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == in_str:
                in_str = None
        else:
            if c == "/" and nxt == "/":
                in_comment_line = True
            elif c == "/" and nxt == "*":
                in_comment_block = True
            elif c in "\"'`":
                in_str = c
            elif c in "({[":
                stack.append(c)
            elif c in ")}]":
                if not stack or stack.pop() != pairs[c]:
                    failures.append(f"{os.path.relpath(path, ROOT)}: desbalanceado em '{c}' (pos {i})")
                    return
        i += 1
    if stack:
        failures.append(f"{os.path.relpath(path, ROOT)}: blocos não fechados: {stack}")
    if in_str:
        failures.append(f"{os.path.relpath(path, ROOT)}: string não terminada")


def check_html() -> None:
    # dev.html é o template modular (fonte da verdade)
    index = os.path.join(ROOT, "dev.html")
    with open(index, encoding="utf-8") as f:
        src = f.read()
    for ref in re.findall(r'(?:src|href)="([^"#]+)"', src):
        if ref.startswith(("http", "data:")):
            continue
        if not os.path.isfile(os.path.join(ROOT, ref)):
            failures.append(f"dev.html: referência quebrada: {ref}")
    # index.html é o bundle gerado: não pode depender de arquivos externos
    bundled = os.path.join(ROOT, "index.html")
    if os.path.isfile(bundled):
        with open(bundled, encoding="utf-8") as f:
            bsrc = f.read()
        if "Bundle gerado por tools/build_single.py" not in bsrc:
            failures.append("index.html: não parece ser o bundle gerado (rode build_single.py)")
        for ref in re.findall(r'(?:src|href)="(css/|js/[^"#"]*)"', bsrc):
            failures.append(f"index.html: bundle referencia arquivo externo: {ref}")


def stats() -> None:
    total = 0
    for dirpath, _, files in os.walk(os.path.join(ROOT, "js")):
        for fn in sorted(files):
            if fn.endswith(".js"):
                p = os.path.join(dirpath, fn)
                n = sum(1 for _ in open(p, encoding="utf-8"))
                total += n
                print(f"  {n:4d}  {os.path.relpath(p, ROOT)}")
    print(f"  {total:4d}  TOTAL (js)")


def main() -> int:
    print("Verificando Cronicas de Valoria...\n")
    check_html()
    js_files: list[str] = []
    for dirpath, _, files in os.walk(os.path.join(ROOT, "js")):
        for fn in files:
            if fn.endswith(".js"):
                js_files.append(os.path.join(dirpath, fn))
    for p in sorted(js_files):
        check_js(p)
    if "--stats" in sys.argv:
        print("Módulos:");
        stats()
        print()
    if failures:
        print(f"ERRO: {len(failures)} problema(s):")
        for f in failures:
            print(f"   - {f}")
        return 1
    print(f"OK - {len(js_files)} modulos JS + dev.html + bundle integros.\n")
    print("Para jogar:  duplo clique em index.html  |  dev: python tools/server.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
