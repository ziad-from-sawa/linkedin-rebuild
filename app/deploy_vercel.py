"""Publish the demo app's page to Vercel.

Usage:
    python app/deploy_vercel.py https://<laptop>.<tailnet>.ts.net

Vercel serves the page (app/static). Every /api and /out request is passed through to
the laptop running app/server.py, which `tailscale funnel --bg 8787` exposes at that
address. Claude Code runs on the laptop, on its own login, so no API key is involved.

Builds ~/.linkedin-rebuild-site/linkedin-rebuild/ (the folder name becomes the Vercel project
name) and runs `npx vercel deploy --prod`. The folder sits outside this repo on purpose: built
inside it, the Vercel CLI connects the project to the GitHub repo, and every push to main then
replaces the page with the repo. Needs Node and a Vercel login (`npx vercel login`).
"""

import json
import shutil
import subprocess
import sys
from pathlib import Path

APP = Path(__file__).resolve().parent
SITE = Path.home() / ".linkedin-rebuild-site" / "linkedin-rebuild"


def main():
    if len(sys.argv) != 2 or not sys.argv[1].startswith("https://"):
        sys.exit(__doc__)
    backend = sys.argv[1].rstrip("/")
    SITE.mkdir(parents=True, exist_ok=True)  # keeps .vercel/ from earlier deploys, so the URL stays the same
    shutil.rmtree(SITE / "static", ignore_errors=True)
    shutil.copytree(APP / "static", SITE / "static")
    shutil.copy2(APP / "static" / "index.html", SITE / "index.html")
    config = {
        "rewrites": [
            {"source": "/api/:path*", "destination": f"{backend}/api/:path*"},
            {"source": "/out/:path*", "destination": f"{backend}/out/:path*"},
        ],
    }
    (SITE / "vercel.json").write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")
    npx = shutil.which("npx")
    if not npx:
        sys.exit("Node isn't installed (npx not found).")
    subprocess.run([npx, "--yes", "vercel@latest", "deploy", "--prod", "--yes"], cwd=SITE, check=True)


if __name__ == "__main__":
    main()
