#!/usr/bin/env python3
"""Roda a bateria funcional automatizada (?autotest=1) no Chrome headless.

Uso:
    python tools/run_autotest.py [--port 8901] [--timeout 420]

Sobe o servidor, abre o jogo com ?autotest=1, aguarda o POST de resultados
e imprime o placar. Retorna 0 se tudo passou.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
RESULT_FILE = os.path.join(tempfile.gettempdir(), "valoria_autotest.json")

CHROME_PATHS = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
]


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8901)
    ap.add_argument("--timeout", type=int, default=420)
    args = ap.parse_args()

    chrome = next((p for p in CHROME_PATHS if os.path.isfile(p)), None)
    if not chrome:
        print("Chrome nao encontrado.")
        return 2
    if os.path.exists(RESULT_FILE):
        os.remove(RESULT_FILE)

    server = subprocess.Popen(
        [sys.executable, os.path.join(HERE, "server.py"), "--port", str(args.port), "--no-browser"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    try:
        # espera o servidor responder
        for _ in range(50):
            try:
                urllib.request.urlopen(f"http://localhost:{args.port}/dev.html", timeout=2)
                break
            except Exception:
                time.sleep(0.2)
        else:
            print("Servidor nao subiu.")
            return 2

        profile = tempfile.mkdtemp(prefix="valoria_prof_")
        browser = subprocess.Popen([
            chrome, "--headless=new", "--disable-gpu", "--no-sandbox",
            "--no-first-run", "--mute-audio",
            "--autoplay-policy=no-user-gesture-required",
            f"--user-data-dir={profile}",
            "--enable-logging=stderr", "--v=0",
            f"http://localhost:{args.port}/dev.html?autotest=1",
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        deadline = time.time() + args.timeout
        data = None
        while time.time() < deadline:
            if os.path.exists(RESULT_FILE):
                with open(RESULT_FILE, encoding="utf-8") as f:
                    data = json.load(f)
                break
            if browser.poll() is not None:
                print("Chrome encerrou antes de postar resultados.")
                break
            time.sleep(2)

        browser.terminate()
        try:
            browser.wait(timeout=10)
        except subprocess.TimeoutExpired:
            browser.kill()

        if not data:
            print("TIMEOUT: sem resultados do autoteste.")
            return 1
        print(f"\n===== AUTOTEST {data['passed']}/{data['total']} =====")
        for d in data["details"]:
            print("  " + d)
        return 0 if data["passed"] == data["total"] else 1
    finally:
        server.terminate()


if __name__ == "__main__":
    sys.exit(main())
