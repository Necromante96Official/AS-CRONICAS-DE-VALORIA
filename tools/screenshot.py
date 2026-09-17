#!/usr/bin/env python3
"""Captura screenshots reais do jogo via Chrome DevTools Protocol.

Uso:
    python tools/screenshot.py [--port 8902]

Salva em shots/title.png, shots/field.png e shots/battle.png.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SHOTS = os.path.join(ROOT, "shots")

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"


class CDP:
    def __init__(self, ws_url: str):
        import websocket  # pip install websocket-client
        self.ws = websocket.create_connection(ws_url, timeout=120)
        self._id = 0

    def call(self, method: str, params: dict | None = None, timeout: int = 120):
        self._id += 1
        cur = self._id
        self.ws.send(json.dumps({"id": cur, "method": method, "params": params or {}}))
        deadline = time.time() + timeout
        while time.time() < deadline:
            msg = json.loads(self.ws.recv())
            if msg.get("id") == cur:
                if "error" in msg:
                    raise RuntimeError(f"CDP {method}: {msg['error']}")
                return msg.get("result", {})
        raise TimeoutError(f"CDP {method} sem resposta")

    def eval(self, expr: str, timeout: int = 120):
        r = self.call("Runtime.evaluate", {
            "expression": expr, "awaitPromise": True, "returnByValue": True,
        }, timeout=timeout)
        if r.get("exceptionDetails"):
            raise RuntimeError(f"JS: {r['exceptionDetails']}")
        return r.get("result", {}).get("value")

    def shot(self, path: str):
        r = self.call("Page.captureScreenshot", {"format": "png"})
        with open(path, "wb") as f:
            f.write(base64.b64decode(r["data"]))
        print("  salvo", os.path.relpath(path, ROOT))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8902)
    args = ap.parse_args()
    os.makedirs(SHOTS, exist_ok=True)

    server = subprocess.Popen(
        [sys.executable, os.path.join(HERE, "server.py"), "--port", str(args.port), "--no-browser"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    browser = None
    try:
        for _ in range(50):
            try:
                urllib.request.urlopen(f"http://localhost:{args.port}/index.html", timeout=2)
                break
            except Exception:
                time.sleep(0.2)

        profile = tempfile.mkdtemp(prefix="valoria_shots_")
        browser = subprocess.Popen([
            CHROME, "--headless=new", "--disable-gpu", "--no-sandbox",
            "--no-first-run", f"--user-data-dir={profile}",
            "--remote-debugging-port=9223", "--mute-audio",
            "--remote-allow-origins=*",
            f"http://localhost:{args.port}/index.html",
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        ws_url = None
        for _ in range(100):
            try:
                targets = json.loads(urllib.request.urlopen("http://127.0.0.1:9223/json/list", timeout=2).read())
                pages = [t for t in targets if t.get("type") == "page"]
                if pages:
                    ws_url = pages[0]["webSocketDebuggerUrl"]
                    break
            except Exception:
                pass
            time.sleep(0.3)
        if not ws_url:
            print("CDP indisponivel.")
            return 2

        cdp = CDP(ws_url)
        time.sleep(2.5)
        print("title..."); cdp.shot(os.path.join(SHOTS, "title.png"))

        print("field...")
        cdp.eval("""(async () => {
          const g = window.valoria;
          await g._onTitlePick('new');
          while (g.dialog.active) {
            g.dialog.charsShown = g.dialog.fullText.length;
            g.dialog._render(); g.dialog._press(null);
          }
          g.player.x = 30*32+4; g.player.y = 25*32; g.player.dir = 'down';
          g.camera.snap(g.player.cx, g.player.cy);
          await new Promise(r => setTimeout(r, 1200));
          return 'ok';
        })()""")
        cdp.shot(os.path.join(SHOTS, "field.png"))

        print("battle...")
        cdp.eval("""(async () => {
          const g = window.valoria;
          g._startWildBattle('field');
          const t0 = performance.now();
          while (g.battle.phase !== 'command' && performance.now() - t0 < 30000)
            await new Promise(r => setTimeout(r, 200));
          await new Promise(r => setTimeout(r, 800));
          return g.battle.phase;
        })()""")
        cdp.shot(os.path.join(SHOTS, "battle.png"))

        print("dialog...")
        cdp.eval("""(async () => {
          const g = window.valoria;
          g.battle.stop();
          g.state = 'FIELD'; g.hud.show();
          g.player.x = 14*32+4; g.player.y = 37*32; g.player.dir = 'up';
          g.camera.snap(g.player.cx, g.player.cy);
          window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
          await new Promise(r => setTimeout(r, 400));
          window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE' }));
          await new Promise(r => setTimeout(r, 1200));
          return g.dialog.active;
        })()""")
        cdp.shot(os.path.join(SHOTS, "dialog.png"))

        print("menu...")
        cdp.eval("""(async () => {
          const g = window.valoria;
          g.dialog.close();
          window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ' }));
          await new Promise(r => setTimeout(r, 300));
          window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyQ' }));
          await new Promise(r => setTimeout(r, 600));
          return g.menu.active;
        })()""")
        cdp.shot(os.path.join(SHOTS, "menu.png"))

        print("pond...")
        cdp.eval("""(async () => {
          const g = window.valoria;
          g.menu.close();
          g.player.x = 33*32+4; g.player.y = 22*32; g.player.dir = 'right';
          g.camera.snap(g.player.cx, g.player.cy);
          await new Promise(r => setTimeout(r, 1000));
          return 'ok';
        })()""")
        cdp.shot(os.path.join(SHOTS, "pond.png"))

        print("gate...")
        cdp.eval("""(async () => {
          const g = window.valoria;
          g.player.x = 14*32+4; g.player.y = 29*32; g.player.dir = 'up';
          g.camera.snap(g.player.cx, g.player.cy);
          await new Promise(r => setTimeout(r, 1000));
          return 'ok';
        })()""")
        cdp.shot(os.path.join(SHOTS, "gate.png"))

        print("farm...")
        cdp.eval("""(async () => {
          const g = window.valoria;
          g.player.x = 8*32+4; g.player.y = 40*32; g.player.dir = 'left';
          g.camera.snap(g.player.cx, g.player.cy);
          await new Promise(r => setTimeout(r, 1000));
          return 'ok';
        })()""")
        cdp.shot(os.path.join(SHOTS, "farm.png"))

        print("forest...")
        cdp.eval("""(async () => {
          const g = window.valoria;
          g.player.x = 10*32+4; g.player.y = 12*32; g.player.dir = 'up';
          g.camera.snap(g.player.cx, g.player.cy);
          await new Promise(r => setTimeout(r, 1000));
          return 'ok';
        })()""")
        cdp.shot(os.path.join(SHOTS, "forest.png"))
        print("OK")
        return 0
    finally:
        if browser:
            browser.terminate()
        server.terminate()


if __name__ == "__main__":
    sys.exit(main())
