"""The LinkedIn Rebuild demo app: paste a URL, watch the scan, get the email.

Usage:
    python app/server.py            then open http://127.0.0.1:8787

It runs the real workflow behind the page: scripts/pull.py for the data (once per
founder, on the team's Apify key) and `claude -p "/rebuild <url>"` for everything
else. The page reads the files the run writes in out/<slug>/ as they appear, so a
founder already built opens instantly.

It listens on 127.0.0.1. To share it, Tailscale Funnel can expose this port and the
Vercel page (app/deploy_vercel.py) proxies to it. Set APP_KEY in .env first: every /api
and /out request then needs that key (header, cookie or ?k=), so nobody else can spend
the Apify credit or run Claude on this laptop.
Standard library only.
"""

import hmac
import json
import os
import mimetypes
import re
import shutil
import subprocess
import sys
import threading
import time
import uuid
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from http.cookies import SimpleCookie
from urllib.parse import parse_qs, unquote, urlparse

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "out"
STATIC = Path(__file__).resolve().parent / "static"
PORT = 8787


def env_value(name):
    if os.environ.get(name):
        return os.environ[name]
    env = ROOT / ".env"
    if env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            key, _, value = line.partition("=")
            if key.strip() == name and value.strip():
                return value.strip().strip('"').strip("'")
    return ""


APP_KEY = env_value("APP_KEY")

USERNAME_RE = re.compile(r"linkedin\.com/in/([A-Za-z0-9_-]+)/?", re.I)  # no % or quotes: it reaches a shell on Windows
CHECK_LINE = re.compile(r"^([1-7]) · (.+?) · (Pass|Fix) · (.+)$")
OUTPUTS = ["teardown.md", "rebuild.json", "mockup.html", "mockup.png", "email.md", "run-report.md"]
JOBS = {}


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def find_folder(username):
    """The founder's folder from an earlier pull, so Apify isn't paid twice."""
    for meta_path in OUT.glob("*/raw/pull-meta.json"):
        try:
            if read_json(meta_path).get("username", "").lower() == username.lower():
                return meta_path.parent.parent
        except (OSError, ValueError):
            continue
    return None


def file_url(folder, rel):
    if not rel:
        return None
    if re.match(r"https?://", rel):
        return rel
    return f"/out/{folder.name}/{rel}"


def pulled_image(folder, name):
    hits = sorted((folder / "raw" / "images").glob(f"{name}.*"))
    return file_url(folder, hits[0].relative_to(folder).as_posix()) if hits else None


def weekly_posts(folder, pulled_at):
    """Own posts per week over the 90-day window, oldest week first."""
    path = folder / "raw" / "posts.json"
    if not path.exists() or not pulled_at:
        return []
    end = datetime.fromisoformat(pulled_at).timestamp() * 1000
    weeks = [0] * 13
    for post in read_json(path):
        ts = (post.get("posted_at") or {}).get("timestamp")
        if ts:
            age = int((end - ts) // (7 * 86400 * 1000))
            if 0 <= age < 13:
                weeks[12 - age] += 1
    return weeks


def parse_teardown(text):
    checks = []
    for line in text.splitlines():
        m = CHECK_LINE.match(line.strip())
        if m:
            fact = m.group(4).replace("`", "")
            status = m.group(3).lower()
            if status == "fix" and re.search(r"not confirmed|not checked", fact, re.I):
                status = "unknown"
            checks.append({"n": int(m.group(1)), "name": m.group(2), "status": status, "fact": fact})
    fit = re.search(r"^Fit: (Yes|No)\.?\s*(.*)$", text, re.M)
    stats = text.split("## Posting stats", 1)[1].strip() if "## Posting stats" in text else ""
    return {"checks": checks, "fit": fit.group(1) if fit else None, "fit_note": fit.group(2) if fit else "",
            "passes": sum(c["status"] == "pass" for c in checks), "stats_text": stats}


def parse_email(text):
    text = text.strip()
    if text.startswith("No email."):
        return {"none": text}
    lines = text.splitlines()
    subject = lines[0].removeprefix("Subject:").strip() if lines and lines[0].startswith("Subject:") else ""
    body = "\n".join(lines[1:]).strip()
    items = [re.sub(r"^\s*\d+\.\s*", "", l) for l in body.splitlines() if re.match(r"^\s*\d+\.\s", l)]
    return {"subject": subject, "body": body, "items": items}


def run_check(folder):
    proc = subprocess.run([sys.executable, str(ROOT / "scripts" / "check.py"), str(folder)],
                          capture_output=True, text=True, encoding="utf-8", errors="replace")
    lines = proc.stdout.strip().splitlines()
    return {"ok": proc.returncode == 0, "summary": lines[-1] if lines else "",
            "notes": [l for l in lines if l.startswith(("FAIL", "WARN"))]}


def founder(folder):
    """Everything the page shows for one founder, read from the files the run wrote."""
    raw = folder / "raw"
    meta = read_json(raw / "pull-meta.json")
    profile = read_json(raw / "profile.json")
    basic = profile.get("basic_info") or {}
    stats = read_json(raw / "stats.json") if (raw / "stats.json").exists() else {}
    featured = [f for f in profile.get("featured") or [] if isinstance(f, dict)]
    data = {
        "slug": folder.name,
        "url": meta.get("input_url"),
        "username": meta.get("username"),
        "pulled_at": meta.get("pulled_at"),
        "profile": {
            "name": basic.get("fullname"),
            "first_name": basic.get("first_name"),
            "headline": basic.get("headline"),
            "location": (basic.get("location") or {}).get("full"),
            "followers": basic.get("follower_count"),
            "connections": basic.get("connection_count"),
            "website": re.sub(r"^(https?://)?(www\.)?", "", basic.get("creator_website") or "").rstrip("/"),
            "about": basic.get("about"),
            "company": basic.get("current_company"),
            "school": (basic.get("top_education_school") or {}).get("name"),
            "headshot": pulled_image(folder, "headshot"),
            "banner": pulled_image(folder, "banner"),
            "logo": pulled_image(folder, "company-logo"),
            "featured": ({"title": featured[0].get("description"), "image": pulled_image(folder, "featured-1")}
                         if featured else None),
        },
        "stats": stats,
        "weekly": weekly_posts(folder, meta.get("pulled_at")),
        "files": {name: (folder / name).exists() for name in OUTPUTS},
        "teardown": None, "rebuild": None, "email": None, "check": None, "report": None,
    }
    if data["files"]["teardown.md"]:
        data["teardown"] = parse_teardown((folder / "teardown.md").read_text(encoding="utf-8"))
    if data["files"]["rebuild.json"]:
        try:
            plan = read_json(folder / "rebuild.json")
            for key in ("headshot",):
                if plan.get(key) not in (None, "keep"):
                    plan[key] = file_url(folder, plan[key])
            for part in ("banner", "featured"):
                if isinstance(plan.get(part), dict):
                    for key in ("image", "logo"):
                        if plan[part].get(key):
                            plan[part][key] = file_url(folder, plan[part][key])
            data["rebuild"] = plan
        except ValueError:
            pass  # still being written
    if data["files"]["email.md"]:
        data["email"] = parse_email((folder / "email.md").read_text(encoding="utf-8"))
        data["check"] = run_check(folder)
    if data["files"]["run-report.md"]:
        data["report"] = (folder / "run-report.md").read_text(encoding="utf-8")
    if data["files"]["mockup.png"]:
        data["mockup"] = f"/out/{folder.name}/mockup.png?v={int((folder / 'mockup.png').stat().st_mtime)}"
    return data


def founders():
    out = []
    for meta_path in sorted(OUT.glob("*/raw/pull-meta.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        folder = meta_path.parent.parent
        try:
            basic = read_json(folder / "raw" / "profile.json").get("basic_info") or {}
        except (OSError, ValueError):
            continue
        out.append({"slug": folder.name, "name": basic.get("fullname"), "headline": basic.get("headline"),
                    "headshot": pulled_image(folder, "headshot"), "url": read_json(meta_path).get("input_url"),
                    "done": (folder / "email.md").exists()})
    return out


class Job:
    def __init__(self, username, button, fresh):
        self.id = uuid.uuid4().hex[:10]
        self.username, self.button, self.fresh = username, button, fresh
        self.url = f"https://www.linkedin.com/in/{username}/"
        self.stage, self.slug, self.error = "starting", None, None
        self.started = time.time()

    def as_dict(self):
        return {"id": self.id, "stage": self.stage, "slug": self.slug, "error": self.error,
                "elapsed": int(time.time() - self.started)}

    def run(self):
        try:
            folder = find_folder(self.username)
            if folder is None:
                self.stage = "pulling"
                proc = subprocess.run([sys.executable, str(ROOT / "scripts" / "pull.py"), self.url], cwd=ROOT,
                                      capture_output=True, text=True, encoding="utf-8", errors="replace")
                errors = [l for l in proc.stderr.splitlines() if l.startswith("ERROR:")]
                lines = [l for l in proc.stdout.splitlines() if l.startswith("out/")]
                if proc.returncode != 0 or not lines:
                    raise RuntimeError(errors[-1][7:] if errors else "The pull failed. Check the URL and the Apify key in .env.")
                folder = ROOT / lines[-1]
            self.slug = folder.name
            if self.fresh:
                for name in OUTPUTS:
                    (folder / name).unlink(missing_ok=True)
            if (folder / "email.md").exists():
                self.stage = "done"
                return
            claude = shutil.which("claude")
            if not claude:
                raise RuntimeError("Claude Code isn't installed on this computer, so the rewrite can't run.")
            self.stage = "rebuilding"
            prompt = f"/rebuild {self.url}" + (f" {self.button}" if self.button else "")
            proc = subprocess.run([claude, "-p", prompt, "--output-format", "text"], cwd=ROOT,
                                  capture_output=True, text=True, encoding="utf-8", errors="replace")
            (folder / "run-report.md").write_text(proc.stdout.strip() or proc.stderr.strip(), encoding="utf-8")
            if not (folder / "email.md").exists():
                raise RuntimeError("Claude finished without writing the email. The run's notes are on the last step.")
            self.stage = "done"
        except Exception as err:  # the page shows one readable line
            self.stage, self.error = "error", str(err)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def send(self, code, body, ctype="application/json"):
        data = body if isinstance(body, bytes) else json.dumps(body).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def send_file(self, path):
        ctype = mimetypes.guess_type(path.name)[0] or ("image/jpeg" if path.suffix == ".img" else "application/octet-stream")
        self.send(200, path.read_bytes(), ctype)

    def safe_path(self, base, rel):
        path = (base / unquote(rel)).resolve()
        return path if path.is_file() and base.resolve() in path.parents else None

    def authorized(self):
        if not APP_KEY:
            return True
        cookie = SimpleCookie(self.headers.get("Cookie") or "")
        supplied = (self.headers.get("X-App-Key") or (cookie["appkey"].value if "appkey" in cookie else "")
                    or (parse_qs(urlparse(self.path).query).get("k") or [""])[0])
        return hmac.compare_digest(unquote(supplied), APP_KEY)

    def do_GET(self):
        route = urlparse(self.path).path
        if route.startswith(("/api/", "/out/")) and not self.authorized():
            return self.send(401, {"error": "Enter the team key."})
        if route in ("/", "/index.html"):
            return self.send_file(STATIC / "index.html")
        if route.startswith("/static/"):
            path = self.safe_path(STATIC, route[len("/static/"):])
            return self.send_file(path) if path else self.send(404, {"error": "not found"})
        if route.startswith("/out/"):
            path = self.safe_path(OUT, route[len("/out/"):])
            return self.send_file(path) if path else self.send(404, {"error": "not found"})
        if route == "/api/founders":
            return self.send(200, founders())
        if route.startswith("/api/founder/"):
            folder = OUT / route.rsplit("/", 1)[-1]
            if not (folder / "raw" / "pull-meta.json").exists():
                return self.send(404, {"error": "No saved pull for that founder."})
            return self.send(200, founder(folder))
        if route.startswith("/api/job/"):
            job = JOBS.get(route.rsplit("/", 1)[-1])
            return self.send(200, job.as_dict()) if job else self.send(404, {"error": "No such run."})
        self.send(404, {"error": "not found"})

    def do_POST(self):
        if not self.authorized():
            return self.send(401, {"error": "Enter the team key."})
        if urlparse(self.path).path != "/api/run":
            return self.send(404, {"error": "not found"})
        try:
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)) or b"{}")
        except ValueError:
            return self.send(400, {"error": "Bad request."})
        m = USERNAME_RE.search(body.get("url") or "")
        if not m:
            return self.send(400, {"error": "That doesn't look like a LinkedIn profile URL (linkedin.com/in/...)."})
        button = body.get("button") if body.get("button") in ("follow", "connect") else None
        job = Job(m.group(1), button, bool(body.get("fresh")))
        JOBS[job.id] = job
        threading.Thread(target=job.run, daemon=True).start()
        self.send(200, job.as_dict())


def main():
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"LinkedIn Rebuild is running at http://127.0.0.1:{PORT}  (Ctrl+C to stop)")
    if not APP_KEY:
        print("No APP_KEY in .env: fine on this laptop, but never expose this port without one.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Stopped.")


if __name__ == "__main__":
    main()
