#!/usr/bin/env python3
"""Valida index.html via file:// (duplo clique simulado) no Chrome headless.

Verifica: boot sem erros, opções do título, overlay de boot ausente,
início de jogo, movimento por teclado e captura screenshot.
Uso:
    python tools/check_dist.py
"""
from __future__ import annotations

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
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
DIST_URL = "file:///C:/Users/Clinica/Desktop/@LucasTavares/OutrosProjetos/Game/index.html"

START_GAME_JS = """(async () => {
  // clique REAL com o mouse na primeira opção (caminho do usuário)
  const g = window.valoria;
  const opt = document.querySelector('#title-list .opt');
  if (!opt) return 'sem-opcao';
  opt.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 200));
  const sel = document.querySelectorAll('#title-list .opt')[g.title.sel];
  opt.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  const t0 = performance.now();
  while (g.state !== 'FIELD' && performance.now() - t0 < 15000)
    await new Promise((r) => setTimeout(r, 200));
  let n = 0;
  while (g.dialog.active && n++ < 80) {
    g.dialog.charsShown = g.dialog.fullText.length;
    g.dialog._render(); g.dialog._press(null);
  }
  return (sel === opt ? 'hover-ok' : 'hover-fail') + '|' + g.state + '|' + !g.dialog.active;
})()"""

MOVE_JS = """(async () => {
  const g = window.valoria;
  const x0 = g.player.x;
  const key = (t, code) => window.dispatchEvent(new KeyboardEvent(t, { code }));
  key('keydown', 'ArrowRight');
  await new Promise((res) => {
    let i = 0;
    const f = () => { if (++i >= 30) res(); else requestAnimationFrame(f); };
    requestAnimationFrame(f);
  });
  key('keyup', 'ArrowRight');
  await new Promise((r) => setTimeout(r, 300));
  return Math.round(g.player.x - x0);
})()"""


class CDP:
    def __init__(self, ws_url: str):
        import websocket
        self.ws = websocket.create_connection(ws_url, timeout=120)
        self._id = 0

    def call(self, method: str, params: dict | None = None, timeout: int = 90):
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
        raise TimeoutError(f"CDP {method}")

    def ev(self, expr: str, timeout: int = 90):
        r = self.call("Runtime.evaluate",
                      {"expression": expr, "awaitPromise": True, "returnByValue": True},
                      timeout=timeout)
        if "exceptionDetails" in r:
            raise RuntimeError(f"JS: {r['exceptionDetails']}")
        return r.get("result", {}).get("value")


def main() -> int:
    dist = os.path.join(ROOT, "index.html")
    if "Bundle gerado por tools/build_single.py" not in open(dist, encoding="utf-8").read():
        print("index.html não é o bundle. Rode: python tools/build_single.py")
        return 2
    profile = tempfile.mkdtemp(prefix="valoria_dist_")
    browser = subprocess.Popen([
        CHROME, "--headless=new", "--disable-gpu", "--no-sandbox",
        "--no-first-run", f"--user-data-dir={profile}",
        "--remote-debugging-port=9224", "--mute-audio",
        "--remote-allow-origins=*", DIST_URL,
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        ws_url = None
        for _ in range(100):
            try:
                targets = json.loads(urllib.request.urlopen(
                    "http://127.0.0.1:9224/json/list", timeout=2).read())
                pages = [t for t in targets if t.get("type") == "page"]
                if pages:
                    ws_url = pages[0]["webSocketDebuggerUrl"]
                    break
            except Exception:
                pass
            time.sleep(0.3)
        if not ws_url:
            print("CDP indisponível.")
            return 2
        cdp = CDP(ws_url)
        time.sleep(3)
        checks = [
            ("boot", cdp.ev("window.__valoriaBooted === true") is True),
            ("opcoes-titulo", cdp.ev("document.querySelectorAll('#title-list .opt').length") == 2),
            ("sem-overlay-boot", cdp.ev("!!document.getElementById('boot-error')") is False),
        ]
        start = cdp.ev(START_GAME_JS)
        checks.append(("mouse-hover+click-inicia", start == "hover-ok|FIELD|true"))
        dx = cdp.ev(MOVE_JS)
        checks.append(("movimento", isinstance(dx, (int, float)) and dx > 40))
        ok = True
        for name, passed in checks:
            print(f"  {'PASS' if passed else 'FAIL'} {name}")
            ok = ok and passed
        r = cdp.call("Page.captureScreenshot", {"format": "png"})
        shot = os.path.join(ROOT, "shots", "dist_field.png")
        with open(shot, "wb") as f:
            f.write(base64.b64decode(r["data"]))
        print("  screenshot:", os.path.relpath(shot, ROOT))
        print("DIST OK" if ok else "DIST FALHOU")
        return 0 if ok else 1
    finally:
        browser.terminate()


if __name__ == "__main__":
    sys.exit(main())
