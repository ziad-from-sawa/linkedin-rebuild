"""Step 5 (Mockup): draw the before-and-after picture of one founder's profile.

Usage:
    python scripts/mockup.py out/<slug>

The Before side comes straight from the pull in out/<slug>/raw/, so no model writes it.
The After side comes from out/<slug>/rebuild.json, which /rebuild writes:

    {
      "button_today": "Follow" | "Connect" | null,   what the live profile shows now, null if unchecked
      "headline": "...",                             80 characters or fewer, 2 segments or fewer
      "website": "acme.com",                         the link under the name, null if no site was found
      "about": ["...", "...", "..."],                3 to 5 bullets
      "banner": {"text": "...", "subtext": "...", "background": "#0b2545", "color": "#ffffff",
                 "image": "photos/cover.jpg", "logo": "raw/images/company-logo.png"},
      "headshot": "raw/images/headshot.jpg",
      "featured": {"title": "...", "image": "raw/images/featured-1.jpg" or "https://..."} or null
    }

Paths are relative to out/<slug>/. banner.subtext, banner.image and banner.logo are optional.
Any of headline, website, about, banner, headshot and featured can be the string "keep":
the After side then shows what they have today. Use it for every check that passed.
featured is null when they have no post of their own to pin: the After side shows an empty slot.
Everything that changed gets an "Updated" tag or a highlight, so the founder sees the fixes at a glance.

Writes out/<slug>/mockup.html (self-contained, images inlined) and out/<slug>/mockup.png,
the picture Ziad attaches to the email.

Standard library only. The PNG comes from Chrome or Edge in headless mode.
"""

import argparse
import base64
import html
import json
import mimetypes
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

WIDTH, HEIGHT = 1360, 1150  # every section has a fixed height, so the page always fits this size
KEEP = "keep"

BROWSERS = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
]
BROWSER_COMMANDS = ["google-chrome", "chromium", "chromium-browser", "chrome", "msedge", "microsoft-edge"]

CSS = """
* { box-sizing: border-box; margin: 0; padding: 0; }
body { width: %(w)dpx; height: %(h)dpx; overflow: hidden; background: #f4f2ee; padding: 24px 28px;
  font-family: -apple-system, system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: rgba(0,0,0,.9); }
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
.label { height: 20px; margin: 0 0 12px 4px; font-size: 15px; font-weight: 700; letter-spacing: .06em;
  text-transform: uppercase; color: rgba(0,0,0,.55); }
.label.after { color: #0a66c2; }
.card { background: #fff; border: 1px solid #e0dfdc; border-radius: 10px; overflow: hidden; margin-bottom: 12px; }
.top { height: 500px; position: relative; }
.banner { height: 162px; background: #a0b4b7 center / cover no-repeat; display: flex; align-items: center;
  justify-content: flex-end; padding: 0 32px 0 220px; }
.banner .words { text-align: right; }
.banner h2 { font-size: 26px; line-height: 1.2; font-weight: 700; }
.banner p { font-size: 15px; line-height: 1.3; margin-top: 6px; opacity: .92; }
.banner img { height: 48px; max-width: 120px; object-fit: contain; margin-left: 22px; border-radius: 6px; }
.avatar { position: absolute; top: 82px; left: 24px; width: 160px; height: 160px; border-radius: 50%%;
  border: 4px solid #fff; background: #d9d9d9 center / cover no-repeat; }
.body { padding: 92px 24px 0; }
.name { font-size: 24px; font-weight: 600; }
.headline { margin-top: 4px; font-size: 16px; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 4;
  -webkit-box-orient: vertical; overflow: hidden; }
.meta { margin-top: 8px; font-size: 14px; color: rgba(0,0,0,.6); }
.site { margin-top: 6px; font-size: 14px; font-weight: 600; color: #0a66c2; }
.buttons { display: flex; gap: 8px; margin-top: 14px; }
.btn { height: 34px; padding: 0 18px; border-radius: 17px; font-size: 16px; font-weight: 600;
  display: inline-flex; align-items: center; }
.btn.primary { background: #0a66c2; color: #fff; }
.btn.outline { border: 1px solid #0a66c2; color: #0a66c2; }
.btn.plain { border: 1px solid rgba(0,0,0,.6); color: rgba(0,0,0,.6); }
.section { padding: 20px 24px; }
.section h3 { font-size: 20px; font-weight: 600; margin-bottom: 10px; }
.about { height: 236px; }
.about .text { font-size: 14px; line-height: 1.45; white-space: pre-line; display: -webkit-box;
  -webkit-line-clamp: 7; -webkit-box-orient: vertical; overflow: hidden; }
.about ul { list-style: none; font-size: 14px; line-height: 1.45; }
.about li { position: relative; padding-left: 16px; margin-bottom: 6px; }
.about li::before { content: "\\2022"; position: absolute; left: 2px; }
.featured { height: 300px; }
.feat { width: 300px; border: 1px solid #e0dfdc; border-radius: 8px; overflow: hidden; }
.feat .img { height: 140px; background: #e9e5df center / cover no-repeat; }
.feat .kind { padding: 10px 12px 0; font-size: 12px; color: rgba(0,0,0,.6); }
.slot { width: 300px; height: 205px; border: 2px dashed #a9c4e0; border-radius: 8px; display: flex;
  align-items: center; justify-content: center; padding: 16px; text-align: center; font-size: 14px; color: #3c6e9e; }
.new { display: inline-block; margin-left: 8px; padding: 2px 8px; border-radius: 10px; background: #0a66c2;
  color: #fff; font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; vertical-align: middle; }
.banner { position: relative; }
.banner > .new { position: absolute; top: 12px; left: 12px; margin: 0; }
.hl { background: #e3eefa; padding: 0 3px; border-radius: 3px; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
.btn.ring { box-shadow: 0 0 0 3px #b9d6f3; }
.feat .title { margin: 4px 12px 12px; font-size: 14px; font-weight: 600; line-height: 1.4;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.empty { font-size: 14px; font-style: italic; color: rgba(0,0,0,.45); }
"""


class MockupError(Exception):
    """A failure we report as one readable line, not a stack trace."""


def log(msg):
    print(msg, file=sys.stderr)


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def image_src(ref, folder):
    """A local path (relative to the founder's folder) or URL, as a data URI. None if it won't load."""
    if not ref:
        return None
    try:
        if re.match(r"https?://", ref):
            req = urllib.request.Request(ref, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=20) as resp:
                data = resp.read()
                ctype = resp.headers.get("Content-Type", "image/jpeg").split(";")[0].strip()
        else:
            path = folder / ref
            data = path.read_bytes()
            ctype = mimetypes.guess_type(path.name)[0] or "image/jpeg"  # .img files are sniffed by the browser
    except Exception as e:  # a missing picture should not stop the mockup
        log(f"warning: image {ref} did not load ({type(e).__name__}), drawing a plain block instead")
        return None
    return f"data:{ctype};base64,{base64.b64encode(data).decode()}"


def pulled_image(folder, name):
    """raw/images/<name>.* as saved by pull.py, relative to the founder's folder."""
    hits = sorted((folder / "raw" / "images").glob(f"{name}.*"))
    return hits[0].relative_to(folder).as_posix() if hits else None


def display_url(url):
    return re.sub(r"^(https?://)?(www\.)?", "", (url or "").strip()).rstrip("/")


def bg(src):
    return f' style="background-image: url(\'{src}\')"' if src else ""


def e(text):
    return html.escape(str(text or ""))


def today_side(folder, plan):
    """The Before column, built only from pulled data."""
    profile = read_json(folder / "raw" / "profile.json")
    basic = profile.get("basic_info") or {}
    featured = [f for f in profile.get("featured") or [] if isinstance(f, dict)]
    return {
        "banner": {"image": pulled_image(folder, "banner")},
        "headshot": pulled_image(folder, "headshot"),
        "headline": basic.get("headline"),
        "website": display_url(basic.get("creator_website")),
        "about_text": basic.get("about"),
        "featured": ({"title": featured[0].get("description"), "image": pulled_image(folder, "featured-1")}
                     if featured else None),
        "button": plan.get("button_today"),
    }


def check_plan(plan):
    missing = [k for k in ("headline", "about", "banner", "headshot") if not plan.get(k)]
    # null is allowed for these two: no site, or no post of theirs to pin, so the After side shows none
    missing += [k for k in ("website", "featured") if k not in plan]
    if isinstance(plan.get("banner"), dict) and not plan["banner"].get("text"):
        missing.append("banner.text")
    if missing:
        raise MockupError(f"rebuild.json is missing: {', '.join(missing)}")
    if plan["about"] != KEEP and not isinstance(plan["about"], list):
        raise MockupError('rebuild.json: about must be a list of bullets or "keep"')


def after_side(plan, today):
    """The After column: the rewrite, with today's version wherever the plan says keep."""
    side = {"button": "Follow", "changed": set()}
    for key in ("headline", "website", "headshot", "featured", "banner"):
        side[key] = today[key] if plan[key] == KEEP else plan[key]
        if plan[key] != KEEP and plan[key] and plan[key] != today[key]:
            side["changed"].add(key)
    if plan["about"] == KEEP:
        side["about_text"] = today["about_text"]
    else:
        side["about_list"] = plan["about"]
        side["changed"].add("about")
    if plan["featured"] is None:
        side["featured_slot"] = True
    if today.get("button") == "Connect":  # only a confirmed Connect counts as a change
        side["changed"].add("button")
    return side


def column(side, shared, folder, label, after):
    changed = side.get("changed", set())
    tag = '<span class="new">Updated</span>'

    def mark(field, text):
        return f'<span class="hl">{e(text)}</span>' if field in changed else e(text)

    banner = side["banner"] or {}
    banner_style = ""
    words = ""
    if banner.get("text"):
        banner_style = f"background-color: {e(banner.get('background') or '#1d2226')}; color: {e(banner.get('color') or '#ffffff')};"
        sub = f"<p>{e(banner['subtext'])}</p>" if banner.get("subtext") else ""
        logo_src = image_src(banner.get("logo"), folder)
        logo = f'<img src="{logo_src}" alt="">' if logo_src else ""
        words = f'<div class="words"><h2>{e(banner["text"])}</h2>{sub}</div>{logo}'
    img = image_src(banner.get("image"), folder)
    if img:
        banner_style += f" background-image: url('{img}');"
    if "banner" in changed:
        words = tag + words

    ring = " ring" if "button" in changed else ""
    button = f'<span class="btn primary{ring}">{e(side["button"])}</span>' if side.get("button") else ""
    site = f'<div class="site">{mark("website", side["website"])}</div>' if side.get("website") else ""
    reach = []
    if shared["followers"] is not None:
        reach.append(f"{shared['followers']:,} followers")
    if shared["connections"] is not None:
        reach.append("500+ connections" if shared["connections"] >= 500 else f"{shared['connections']} connections")

    if side.get("about_list"):
        about = "<ul>" + "".join(f"<li>{e(b)}</li>" for b in side["about_list"]) + "</ul>"
    elif side.get("about_text"):
        about = f'<div class="text">{e(side["about_text"])}</div>'
    else:
        about = '<div class="empty">No About section</div>'

    feat = side.get("featured")
    if feat:
        featured = (f'<div class="feat"><div class="img"{bg(image_src(feat.get("image"), folder))}></div>'
                    f'<div class="kind">Post</div><div class="title">{e(feat.get("title"))}</div></div>')
    elif side.get("featured_slot"):
        featured = '<div class="slot">Your best post, pinned here with an image</div>'
    else:
        featured = '<div class="empty">Nothing featured</div>'

    return f"""
<div>
  <div class="label{' after' if after else ''}">{e(label)}</div>
  <div class="card top">
    <div class="banner" style="{banner_style}">{words}</div>
    <div class="avatar"{bg(image_src(side.get("headshot"), folder))}></div>
    <div class="body">
      <div class="name">{e(shared["name"])}</div>
      <div class="headline">{mark("headline", side.get("headline"))}</div>
      <div class="meta">{e(shared["location"])}</div>
      {site}
      <div class="meta">{e(" · ".join(reach))}</div>
      <div class="buttons">{button}<span class="btn outline">Message</span><span class="btn plain">More</span></div>
    </div>
  </div>
  <div class="card section about"><h3>About{tag if "about" in changed else ""}</h3>{about}</div>
  <div class="card section featured"><h3>Featured{tag if "featured" in changed else ""}</h3>{featured}</div>
</div>"""


def build_html(folder):
    plan_path = folder / "rebuild.json"
    if not plan_path.exists():
        raise MockupError(f"No rebuild.json in {folder}. /rebuild writes it before this step.")
    plan = read_json(plan_path)
    check_plan(plan)
    basic = read_json(folder / "raw" / "profile.json").get("basic_info") or {}
    shared = {
        "name": basic.get("fullname") or "",
        "location": (basic.get("location") or {}).get("full") or "",
        "followers": basic.get("follower_count"),
        "connections": basic.get("connection_count"),
    }
    today = today_side(folder, plan)
    after = after_side(plan, today)
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>{e(shared["name"])}: profile before and after</title>
<style>{CSS % {"w": WIDTH, "h": HEIGHT}}</style></head>
<body><div class="cols">
{column(today, shared, folder, "Your profile today", after=False)}
{column(after, shared, folder, "With our changes", after=True)}
</div></body></html>
"""


def find_browser():
    for path in BROWSERS:
        if Path(path).exists():
            return path
    for name in BROWSER_COMMANDS:
        hit = shutil.which(name)
        if hit:
            return hit
    raise MockupError("No Chrome or Edge found. Open mockup.html in a browser and take a screenshot instead.")


def render_png(html_path, png_path):
    browser = find_browser()
    png_path.unlink(missing_ok=True)
    profile_dir = tempfile.mkdtemp(prefix="mockup-browser-")  # keeps it apart from a Chrome you have open
    cmd = [browser, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
           f"--user-data-dir={profile_dir}", f"--window-size={WIDTH},{HEIGHT}",
           "--force-device-scale-factor=2", f"--screenshot={png_path.resolve()}", html_path.resolve().as_uri()]
    try:
        subprocess.run(cmd, capture_output=True, timeout=90)
    except subprocess.TimeoutExpired:
        raise MockupError("The browser took over 90 seconds to draw the mockup.")
    finally:
        shutil.rmtree(profile_dir, ignore_errors=True)
    if not png_path.exists() or png_path.stat().st_size == 0:
        raise MockupError(f"The browser did not write {png_path.name}. Open mockup.html and take a screenshot instead.")


def main():
    parser = argparse.ArgumentParser(description="Draw the before-and-after mockup for one founder.")
    parser.add_argument("folder", help="The founder's folder, e.g. out/ziad-hassan")
    args = parser.parse_args()
    folder = Path(args.folder)
    try:
        if not (folder / "raw" / "profile.json").exists():
            raise MockupError(f"No raw/profile.json in {folder}. Run scripts/pull.py first.")
        html_path, png_path = folder / "mockup.html", folder / "mockup.png"
        html_path.write_text(build_html(folder), encoding="utf-8")
        render_png(html_path, png_path)
        print(png_path.as_posix())  # stdout carries only the picture's path
        return 0
    except MockupError as err:
        log(f"ERROR: {err}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
