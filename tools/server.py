#!/usr/bin/env python3
"""Servidor local de desenvolvimento para Crônicas de Valoria.

Uso:
    python tools/server.py            # serve em http://localhost:8080
    python tools/server.py --port 8000

Por que um servidor? ES Modules (`import`/`export`) exigem HTTP —
abrir index.html via file:// bloqueia os módulos por CORS.
"""
from __future__ import annotations

import argparse
import functools
import http.server
import os
import webbrowser

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".ts": "text/plain",
        ".json": "application/json",
    }

    def log_message(self, fmt, *args):  # log enxuto
        print(f"[{self.log_date_time_string()}] {fmt % args}")

    def end_headers(self):
        # Sem cache em dev: sempre carrega o código novo
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_POST(self):
        # endpoint do autoteste: salva o JSON de resultados em TEMP
        if self.path == "/__autotest_result":
            size = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(size)
            out = os.path.join(os.environ.get("TEMP", HERE), "valoria_autotest.json")
            with open(out, "wb") as f:
                f.write(body)
            data = b'{"ok":true}'
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        else:
            self.send_error(404)


def main() -> None:
    ap = argparse.ArgumentParser(description="Serve Crônicas de Valoria localmente")
    ap.add_argument("--port", type=int, default=8080)
    ap.add_argument("--no-browser", action="store_true")
    args = ap.parse_args()

    handler = functools.partial(Handler, directory=ROOT)
    with http.server.ThreadingHTTPServer(("127.0.0.1", args.port), handler) as srv:
        url = f"http://localhost:{args.port}/index.html"
        print(f"\n  CRONICAS DE VALORIA em {url}")
        print("   Ctrl+C para encerrar.\n")
        if not args.no_browser:
            try:
                webbrowser.open(url)
            except Exception:
                pass
        try:
            srv.serve_forever()
        except KeyboardInterrupt:
            print("\nEncerrado.")


if __name__ == "__main__":
    main()
