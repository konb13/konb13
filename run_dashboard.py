#!/usr/bin/env python3
"""
run_dashboard.py – Start the ArticleBot web dashboard.

Usage:
  python run_dashboard.py               # http://localhost:8000
  python run_dashboard.py --port 3000   # http://localhost:3000
  python run_dashboard.py --host 0.0.0.0 --port 8080
"""

import argparse
import sys
import webbrowser
from pathlib import Path

# Ensure project root on PYTHONPATH
sys.path.insert(0, str(Path(__file__).parent))

import uvicorn


def main() -> None:
    parser = argparse.ArgumentParser(description="Start the ArticleBot dashboard")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--reload", action="store_true", help="Enable hot-reload (dev mode)")
    parser.add_argument("--no-browser", action="store_true", help="Don't open browser automatically")
    args = parser.parse_args()

    url = f"http://{args.host}:{args.port}"
    print(f"\n  ArticleBot Dashboard → {url}\n")

    if not args.no_browser:
        import threading, time
        def _open():
            time.sleep(1.5)
            webbrowser.open(url)
        threading.Thread(target=_open, daemon=True).start()

    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        log_level="info",
    )


if __name__ == "__main__":
    main()
