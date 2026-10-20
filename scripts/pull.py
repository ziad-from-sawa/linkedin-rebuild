"""Step 1 (Pull): fetch a LinkedIn profile and its posts from Apify.

Usage:
    python scripts/pull.py <linkedin-url> [<linkedin-url> ...]
    python scripts/pull.py --from-file inputs/test-urls.md
    python scripts/pull.py --probe <linkedin-url>   # print field names only
    python scripts/pull.py --check                  # re-check fields in out/, no Apify calls

Writes out/<name-slug>/raw/ (see docs/pull-output.md): profile, posts, company, stats,
website colors, images and pull-meta.
Progress and errors go to stderr; stdout gets one line per success: the folder path.

Standard library only. Token comes from APIFY_API_TOKEN in .env and is never printed.
"""

import argparse
import json
import re
import statistics
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "out"

# Full Sections returns everything the batch profile scraper does, plus skills,
# recommendations and richer experience. Same vendor, no cookies, $0.01 per profile.
PROFILE_ACTOR = "apimaestro~linkedin-profile-full-sections-scraper"
POSTS_ACTOR = "apimaestro~linkedin-batch-profile-posts-scraper"
COMPANY_ACTOR = "apimaestro~linkedin-company-detail"
BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
API = "https://api.apify.com/v2/acts/{actor}/run-sync-get-dataset-items"
WINDOW_DAYS = 90
POST_LIMIT = 100  # the posts actor's max per call

URL_RE = re.compile(r"(?:https?://)?(?:[a-z]{2,3}\.)?linkedin\.com/in/([A-Za-z0-9\-_%]+)/?", re.I)


class PullError(Exception):
    """A failure we report as one readable line, not a stack trace."""


def load_token():
    env = ROOT / ".env"
    if not env.exists():
        raise PullError("No .env file. Copy .env.example to .env and paste your Apify token.")
    for line in env.read_text(encoding="utf-8").splitlines():
        key, _, value = line.partition("=")
        if key.strip() == "APIFY_API_TOKEN" and value.strip():
            return value.strip().strip('"').strip("'")
    raise PullError("APIFY_API_TOKEN is empty in .env.")


def username_from_url(url):
    m = URL_RE.search(url.strip())
    if not m:
        raise PullError(f"Not a LinkedIn profile URL (expected linkedin.com/in/<name>): {url}")
    return m.group(1).lower()


def urls_from_file(path):
    text = Path(path).read_text(encoding="utf-8")
    seen, urls = set(), []
    for m in URL_RE.finditer(text):
        if m.group(1).lower() not in seen:
            seen.add(m.group(1).lower())
            urls.append(m.group(0))
    if not urls:
        raise PullError(f"No LinkedIn URLs found in {path}.")
    return urls


def run_actor(actor, payload, token, retries=3):
    """Run an actor synchronously and return its dataset items (a list)."""
    req = urllib.request.Request(
        API.format(actor=actor),
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
        method="POST",
    )
    for attempt in range(1, retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=330) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            detail = apify_error_message(e)
            if e.code == 429 and attempt < retries:
                wait = 10 * attempt
                print(f"  rate limited by Apify, retrying in {wait}s ({attempt}/{retries})", file=sys.stderr)
                time.sleep(wait)
                continue
            if e.code in (401, 403):
                raise PullError(f"Apify rejected the token ({e.code}). Check APIFY_API_TOKEN in .env. {detail}")
            if e.code == 402:
                raise PullError(f"Apify account is out of credits or needs a paid plan for {actor}. {detail}")
            if e.code == 408:
                raise PullError(f"{actor} took longer than 5 minutes. Try again. {detail}")
            if e.code == 429:
                raise PullError(f"Apify rate limit hit {retries} times on {actor}. Wait a minute and retry.")
            raise PullError(f"{actor} failed (HTTP {e.code}). {detail}")
        except urllib.error.URLError as e:
            raise PullError(f"Could not reach Apify: {e.reason}")
        except json.JSONDecodeError:
            raise PullError(f"{actor} returned something that is not JSON.")


def apify_error_message(err):
    try:
        body = json.loads(err.read().decode("utf-8"))
        return body.get("error", {}).get("message", "")
    except Exception:
        return ""


def field_tree(value, prefix="", depth=0, out=None):
    """List field paths and types without printing any values."""
    out = [] if out is None else out
    if isinstance(value, dict):
        for k, v in value.items():
            path = f"{prefix}.{k}" if prefix else k
            out.append(f"{'  ' * depth}{path}: {type_label(v)}")
            if depth < 3:
                field_tree(v, path, depth + 1, out)
    elif isinstance(value, list) and value and isinstance(value[0], (dict, list)):
        field_tree(value[0], prefix + "[]", depth, out)
    return out


def type_label(v):
    if isinstance(v, list):
        return f"list[{len(v)}]"
    if isinstance(v, dict):
        return "object"
    if v in (None, ""):
        return f"{type(v).__name__} (empty)"
    return type(v).__name__


def probe(url, token):
    username = username_from_url(url)
    print(f"Pulling profile for {username} ...")
    profile = run_actor(PROFILE_ACTOR, {"usernames": [url], "includeEmail": False}, token)
    print(f"Pulling posts for {username} ...")
    posts = run_actor(POSTS_ACTOR, {"usernames": [url], "limit": 100}, token)

    raw = OUT / "_probe" / username
    raw.mkdir(parents=True, exist_ok=True)
    (raw / "profile.actor.json").write_text(json.dumps(profile, indent=2, ensure_ascii=False), encoding="utf-8")
    (raw / "posts.actor.json").write_text(json.dumps(posts, indent=2, ensure_ascii=False), encoding="utf-8")

    for label, items in (("PROFILE", profile), ("POSTS", posts)):
        print(f"\n===== {label} actor: {type_label(items)} items")
        if isinstance(items, list) and items:
            print("\n".join(field_tree(items[0])))
    print(f"\nSaved unedited actor output to {raw.relative_to(ROOT)}")


def slugify(name):
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_name.lower()).strip("-")


def log(msg):
    print(msg, file=sys.stderr)


def pull_profile(url, username, token):
    items = run_actor(PROFILE_ACTOR, {"usernames": [url], "includeEmail": False}, token)
    profiles = [i for i in items if isinstance(i, dict) and isinstance(i.get("basic_info"), dict)]
    if not profiles:
        hint = ""
        for i in items if isinstance(items, list) else []:
            if isinstance(i, dict) and (i.get("error") or i.get("message")):
                hint = f" Actor said: {i.get('error') or i.get('message')}"
        raise PullError(f"No profile came back for {username}. Check the URL is a public profile.{hint}")
    return profiles[0]


def pull_posts(url, username, token):
    items = run_actor(POSTS_ACTOR, {"usernames": [url], "limit": POST_LIMIT}, token)
    if not isinstance(items, list):
        raise PullError(f"Posts actor returned an unexpected shape for {username}.")
    summary = next((i for i in items if isinstance(i, dict) and "summary" in i), None)
    posts = [i for i in items if isinstance(i, dict) and "summary" not in i]
    failed = [u.lower() for u in ((summary or {}).get("summary") or {}).get("failedUsernames") or []]
    if username in failed or any(username in f for f in failed):
        raise PullError(f"Posts actor could not read {username}'s activity.")
    return items, posts


def own_posts(posts, username, now):
    """Split the founder's own posts (no reposts, de-duplicated) into all-time and last WINDOW_DAYS."""
    cutoff_ms = int((now - timedelta(days=WINDOW_DAYS)).timestamp() * 1000)
    seen, own = set(), []
    counts = {"returned": len(posts), "reposts_dropped": 0, "not_author_dropped": 0,
              "duplicates_dropped": 0, "older_than_window": 0, "no_date_dropped": 0}
    oldest_ms = None
    for p in posts:
        ts = (p.get("posted_at") or {}).get("timestamp")
        if isinstance(ts, int):
            oldest_ms = ts if oldest_ms is None else min(oldest_ms, ts)
        if p.get("post_type") == "repost":
            counts["reposts_dropped"] += 1
            continue
        if ((p.get("author") or {}).get("username") or "").lower() != username:
            counts["not_author_dropped"] += 1
            continue
        key = p.get("full_urn") or p.get("url")
        if key in seen:
            counts["duplicates_dropped"] += 1
            continue
        seen.add(key)
        if not isinstance(ts, int):
            counts["no_date_dropped"] += 1
            continue
        own.append(p)
    own.sort(key=lambda p: p["posted_at"]["timestamp"], reverse=True)
    recent = [p for p in own if p["posted_at"]["timestamp"] >= cutoff_ms]
    counts["older_than_window"] = len(own) - len(recent)
    counts["kept"] = len(recent)
    # If the actor hit its cap and even the oldest post is inside the window, we may be missing posts.
    truncated = len(posts) >= POST_LIMIT and oldest_ms is not None and oldest_ms >= cutoff_ms
    return own, recent, counts, cutoff_ms, truncated


def post_media_kind(p):
    if p.get("document"):
        return "document"
    if isinstance(p.get("media"), dict) and p["media"].get("type"):
        return p["media"]["type"]
    return "text"


def post_summary(p):
    s = p.get("stats") or {}
    return {
        "url": p.get("url"),
        "date": (p.get("posted_at") or {}).get("date"),
        "total_reactions": s.get("total_reactions", 0),
        "comments": s.get("comments", 0),
        "reposts": s.get("reposts", 0),
        "media": post_media_kind(p),
        "chars": len(p.get("text") or ""),
    }


def posting_stats(own, recent, now, truncated):
    """Numbers for the teardown, computed here so no step has to do arithmetic."""
    def avg(xs):
        return round(sum(xs) / len(xs), 1) if xs else None

    reactions = [(p.get("stats") or {}).get("total_reactions", 0) for p in recent]
    comments = [(p.get("stats") or {}).get("comments", 0) for p in recent]
    reposts = [(p.get("stats") or {}).get("reposts", 0) for p in recent]
    last = own[0] if own else None
    days_since = None
    if last:
        days_since = (now - datetime.fromtimestamp(last["posted_at"]["timestamp"] / 1000, timezone.utc)).days
    weekdays = Counter(datetime.fromtimestamp(p["posted_at"]["timestamp"] / 1000, timezone.utc).strftime("%A")
                       for p in recent)
    hashtags = Counter(t.lower() for p in recent for t in re.findall(r"#(\w+)", p.get("text") or ""))
    # Best post: most reactions, comments break ties.
    ranked = sorted(recent, key=lambda p: ((p.get("stats") or {}).get("total_reactions", 0),
                                           (p.get("stats") or {}).get("comments", 0)), reverse=True)
    by_media = {}
    for kind in sorted({post_media_kind(p) for p in recent}):
        group = [(p.get("stats") or {}).get("total_reactions", 0) for p in recent if post_media_kind(p) == kind]
        by_media[kind] = {"posts": len(group), "avg_reactions": avg(group)}
    return {
        "window_days": WINDOW_DAYS,
        "posts_in_window": len(recent),
        "posts_per_week": round(len(recent) / (WINDOW_DAYS / 7), 1),
        "last_post_date": (last or {}).get("posted_at", {}).get("date"),
        "days_since_last_post": days_since,
        "avg_reactions": avg(reactions),
        "median_reactions": statistics.median(reactions) if reactions else None,
        "avg_comments": avg(comments),
        "avg_reposts": avg(reposts),
        "avg_chars": avg([len(p.get("text") or "") for p in recent]),
        "by_media": by_media,
        "posts_by_weekday_utc": dict(weekdays.most_common()),
        "top_hashtags": dict(hashtags.most_common(10)),
        "best_post": post_summary(ranked[0]) if ranked else None,
        "top_3_posts": [post_summary(p) for p in ranked[:3]],
        "own_posts_returned_all_time": len(own),
        "oldest_own_post_date": own[-1]["posted_at"].get("date") if own else None,
        "maybe_truncated": truncated,
        "note": "Own posts only (reposts excluded). Best post ranks by total_reactions, then comments.",
    }


# Shared LinkedIn pages people attach when they have no real company page. Their data
# (e.g. 38,000 employees for "Stealth Startup") says nothing about the founder's company.
PLACEHOLDER_COMPANIES = {"stealth startup", "stealth", "stealth mode", "stealth mode startup",
                         "self-employed", "self employed", "freelance", "freelancer", "confidential"}


def pull_company(profile, token):
    """Company page for the founder's current company. Optional: returns (data, note)."""
    basic = profile.get("basic_info") or {}
    company_url = basic.get("current_company_url")
    if (basic.get("current_company") or "").strip().lower() in PLACEHOLDER_COMPANIES:
        return None, f"current company is the generic '{basic['current_company']}' page, skipped"
    if not company_url:
        return None, "no current_company_url on the profile"
    try:
        items = run_actor(COMPANY_ACTOR, {"identifier": [company_url]}, token)
    except PullError as e:
        return None, f"company pull failed: {e}"
    found = [i for i in items if isinstance(i, dict) and isinstance(i.get("basic_info"), dict)]
    return (found[0], "ok") if found else (None, "company actor returned nothing")


def http_get(url, max_bytes=5_000_000, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": BROWSER_UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read(max_bytes), resp.headers.get("Content-Type", ""), resp.geturl()


IMAGE_EXT = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif",
             "image/svg+xml": ".svg"}


def download_images(profile, company, raw):
    """Save images locally. LinkedIn image URLs expire after a couple of weeks."""
    basic = profile.get("basic_info") or {}
    wanted = {"headshot": basic.get("profile_picture_url"), "banner": basic.get("background_picture_url")}
    for n, f in enumerate(profile.get("featured") or [], 1):
        if isinstance(f, dict):
            wanted[f"featured-{n}"] = f.get("image_url")
    media = (company or {}).get("media") or {}
    wanted["company-logo"] = media.get("logo_url")
    wanted["company-cover"] = media.get("cover_url")

    folder = raw / "images"
    saved = {}
    for name, url in wanted.items():
        if not url:
            saved[name] = None
            continue
        try:
            data, ctype, _ = http_get(url)
            ext = IMAGE_EXT.get(ctype.split(";")[0].strip(), ".img")
            folder.mkdir(exist_ok=True)
            (folder / f"{name}{ext}").write_bytes(data)
            saved[name] = f"images/{name}{ext}"
        except Exception as e:  # images are a bonus; never fail the pull over one
            saved[name] = f"download failed: {type(e).__name__}"
    return saved


HEX_RE = re.compile(r"#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b")


def site_colors(website, raw):
    """Save the company homepage and count the hex colors in its HTML and CSS."""
    if not website:
        return {"website": None, "note": "no website found on the company page or profile"}
    if not website.startswith("http"):
        website = "https://" + website
    try:
        html_bytes, _, final_url = http_get(website, max_bytes=3_000_000)
    except Exception as e:
        return {"website": website, "note": f"could not fetch homepage: {type(e).__name__}"}
    html = html_bytes.decode("utf-8", "replace")
    (raw / "website.html").write_text(html, encoding="utf-8")

    css_text, css_files = "", []
    host = urllib.parse.urlparse(final_url).netloc
    for href in re.findall(r"<link[^>]+rel=[\"']?stylesheet[^>]*>", html, re.I):
        m = re.search(r"href=[\"']([^\"']+)", href)
        if not m:
            continue
        css_url = urllib.parse.urljoin(final_url, m.group(1))
        if urllib.parse.urlparse(css_url).netloc != host or len(css_files) >= 5:
            continue
        try:
            css_text += http_get(css_url, max_bytes=2_000_000)[0].decode("utf-8", "replace")
            css_files.append(css_url)
        except Exception:
            pass

    def norm(h):
        h = h.lower()
        return "#" + ("".join(c * 2 for c in h) if len(h) == 3 else h)

    counts = Counter(norm(h) for h in HEX_RE.findall(html + css_text))

    def is_neutral(hex_color):
        r, g, b = (int(hex_color[i:i + 2], 16) for i in (1, 3, 5))
        return max(r, g, b) - min(r, g, b) < 16  # white, black and greys

    theme = re.search(r"<meta[^>]+name=[\"']theme-color[\"'][^>]+content=[\"']([^\"']+)", html, re.I)
    return {
        "website": website,
        "final_url": final_url,
        "theme_color_meta": theme.group(1) if theme else None,
        "top_brand_colors": [{"hex": h, "count": n} for h, n in counts.most_common() if not is_neutral(h)][:10],
        "top_neutral_colors": [{"hex": h, "count": n} for h, n in counts.most_common() if is_neutral(h)][:5],
        "css_files_read": len(css_files),
        "note": "Counted from homepage HTML and up to 5 same-site stylesheets. Check against the logo.",
    }


def check_fields(profile, company=None):
    """Status for each field: ok, empty (present but blank), or missing (key absent)."""
    basic = profile.get("basic_info") or {}
    company = company or {}

    def status(container, key):
        if key not in container:
            return "missing"
        return "empty" if container[key] in (None, "", [], {}, 0) else "ok"

    featured = profile.get("featured")
    with_image = sum(1 for f in featured or [] if isinstance(f, dict) and f.get("image_url"))
    return {
        "headline": status(basic, "headline"),
        "about": status(basic, "about"),
        "banner": status(basic, "background_picture_url"),
        "website": status(basic, "creator_website"),
        "featured": status(profile, "featured"),
        "featured_with_image": with_image,
        "follower_count": status(basic, "follower_count"),
        # is_creator is false on Ziad's profile, which shows Follow, so it cannot decide check 7.
        "is_creator": str(basic["is_creator"]).lower() if "is_creator" in basic else "missing",
        "headshot": status(basic, "profile_picture_url"),
        "skills": len(profile.get("skills") or []),
        "recommendations": len(profile.get("recommendations") or []),
        "experience": len(profile.get("experience") or []),
        "company": "ok" if company else "missing",
        "company_website": status(company.get("basic_info") or {}, "website") if company else "missing",
        "employee_count": (company.get("stats") or {}).get("employee_count") if company else None,
    }


def pull_one(url, token, now):
    username = username_from_url(url)
    url = f"https://www.linkedin.com/in/{username}/"  # drop query strings like ?isSelfProfile=true
    log(f"[{username}] pulling profile ...")
    profile = pull_profile(url, username, token)
    log(f"[{username}] pulling posts ...")
    actor_items, posts = pull_posts(url, username, token)
    log(f"[{username}] pulling company page ...")
    company, company_note = pull_company(profile, token)

    basic = profile["basic_info"]
    username = (basic.get("public_identifier") or username).lower()
    slug = slugify(basic.get("fullname") or "") or username
    folder = OUT / slug
    meta_path = folder / "raw" / "pull-meta.json"
    if meta_path.exists():
        previous = json.loads(meta_path.read_text(encoding="utf-8")).get("username")
        if previous and previous != username:
            slug = f"{slug}-{username}"
            folder = OUT / slug
    raw = folder / "raw"
    raw.mkdir(parents=True, exist_ok=True)

    own, kept, counts, cutoff_ms, truncated = own_posts(posts, username, now)

    log(f"[{username}] saving images and company website ...")
    images = download_images(profile, company, raw)
    # The founder's own link first: it is the site they chose to show.
    website = basic.get("creator_website") or ((company or {}).get("basic_info") or {}).get("website")
    colors = site_colors(website, raw)
    colors["source"] = ("profile creator_website" if basic.get("creator_website")
                        else "company page website" if website else None)

    meta = {
        "input_url": url,
        "username": username,
        "slug": slug,
        "pulled_at": now.isoformat(timespec="seconds"),
        "window_days": WINDOW_DAYS,
        "window_start": datetime.fromtimestamp(cutoff_ms / 1000, timezone.utc).isoformat(timespec="seconds"),
        "actors": {"profile": PROFILE_ACTOR, "posts": POSTS_ACTOR, "company": COMPANY_ACTOR},
        "posts": counts,
        "posts_maybe_truncated": truncated,
        "company": company_note,
        "images": images,
        "website_fetched": "website.html" if (raw / "website.html").exists() else colors.get("note"),
        "fields": check_fields(profile, company),
    }

    write_json(raw / "profile.json", profile)
    write_json(raw / "posts.json", kept)
    write_json(raw / "posts-all-own.json", own)
    write_json(raw / "posts.actor.json", actor_items)
    write_json(raw / "stats.json", posting_stats(own, kept, now, truncated))
    write_json(raw / "website-colors.json", colors)
    if company:
        write_json(raw / "company.json", company)
    write_json(raw / "pull-meta.json", meta)

    if company_note != "ok":
        log(f"[{username}] note: {company_note}")
    log(f"[{username}] {counts['kept']} own posts in the last {WINDOW_DAYS} days "
        f"(dropped {counts['reposts_dropped']} reposts, {counts['duplicates_dropped']} duplicates)")
    if truncated:
        log(f"[{username}] WARNING: actor returned its cap of {POST_LIMIT} posts and all are inside "
            f"the window. Posts older than the newest {POST_LIMIT} are missing.")
    return folder, meta


def write_json(path, data):
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def print_field_table(metas):
    cols = ["headline", "about", "banner", "website", "featured", "featured_with_image", "follower_count",
            "is_creator", "headshot", "skills", "recommendations", "experience", "company", "company_website",
            "employee_count"]
    log("")
    log("| profile | " + " | ".join(cols) + " | posts (90d) | images saved |")
    log("|---" * (len(cols) + 3) + "|")
    for m in metas:
        f = m["fields"]
        images = sum(1 for v in (m.get("images") or {}).values() if v and v.startswith("images/"))
        log(f"| {m['slug']} | " + " | ".join(str(f.get(c)) for c in cols)
            + f" | {m['posts']['kept']} | {images} |")
    log("\nok = present with a value. empty = present but blank (a checklist finding). "
        "missing = key absent (the actor omits sections a profile does not have).\n"
        "is_creator shows the raw value. It is false on Ziad's profile, which shows Follow, "
        "so confirm check 7 on the live page.")


def main():
    parser = argparse.ArgumentParser(description="Pull LinkedIn profile and posts via Apify.")
    parser.add_argument("urls", nargs="*", help="LinkedIn profile URLs")
    parser.add_argument("--from-file", help="Read URLs from a file such as inputs/test-urls.md")
    parser.add_argument("--probe", action="store_true", help="Print actor field names, write nothing else")
    parser.add_argument("--check", action="store_true",
                        help="Re-run the field check on folders already in out/ (no Apify calls)")
    args = parser.parse_args()

    try:
        if args.check:
            metas = []
            for meta_path in sorted(OUT.glob("*/raw/pull-meta.json")):
                meta = json.loads(meta_path.read_text(encoding="utf-8"))
                profile = json.loads((meta_path.parent / "profile.json").read_text(encoding="utf-8"))
                company_path = meta_path.parent / "company.json"
                company = json.loads(company_path.read_text(encoding="utf-8")) if company_path.exists() else None
                meta["fields"] = check_fields(profile, company)
                metas.append(meta)
            if not metas:
                raise PullError("No pulled profiles in out/ yet.")
            print_field_table(metas)
            return 0

        urls = list(args.urls)
        if args.from_file:
            urls += urls_from_file(args.from_file)
        if not urls:
            raise PullError("Give a LinkedIn URL or --from-file inputs/test-urls.md.")
        for u in urls:
            username_from_url(u)  # fail fast on a bad URL before spending credits
        token = load_token()
        if args.probe:
            for u in urls:
                probe(u, token)
            return 0

        now = datetime.now(timezone.utc)
        metas, failures = [], 0
        for u in urls:
            try:
                folder, meta = pull_one(u, token, now)
                metas.append(meta)
                print(folder.relative_to(ROOT).as_posix())  # stdout carries only the folder paths
            except PullError as e:
                failures += 1
                log(f"ERROR: {e}")
        if metas:
            print_field_table(metas)
        return 1 if failures else 0
    except PullError as e:
        log(f"ERROR: {e}")
        return 1
    except KeyboardInterrupt:
        log("Stopped.")
        return 130


if __name__ == "__main__":
    sys.exit(main())
