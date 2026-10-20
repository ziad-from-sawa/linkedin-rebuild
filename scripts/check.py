"""Step 7 (Check): test one founder's folder against the judging list in the brief.

Usage:
    python scripts/check.py out/<slug>

Prints one line per check: PASS, WARN or FAIL. Exit code 1 if anything fails.
Nothing goes to Ziad on a FAIL. A clean run still needs a human read: the anti-AI
rules are mostly judgment, and only the mechanical ones are tested here.

Standard library only.
"""

import argparse
import json
import re
import sys
from pathlib import Path

DASHES = re.compile("[\u2014\u2013]")
# Hard-ban list from rule 6 of context/anti-ai-rules.md, matched on word stems.
BANNED = re.compile(
    r"\b(leverag|utiliz|utilis|streamlin|optimiz|optimis|seamless|robust|scalab|holistic|frictionless|"
    r"ecosystem|tapestr|deep[ -]dive|unpack|delv|stakeholder|synerg|cutting[ -]edge|next[ -]generation|"
    r"game[ -]changer|paradigm shift|low[ -]hanging fruit|move the needle|circle back|actionable insight|"
    r"bleeding[ -]edge|pain point|touchpoint|thought leader|essentially)\w*", re.I)
LINK = re.compile(r"https?://|www\.|\b[a-z0-9-]+\.(com|co|io|ai|org|net|app|dev|xyz|me|us|uk)\b", re.I)
SEGMENT_SPLIT = re.compile(r"\s[|\u2022\u00b7/]\s|\s-\s")
TEARDOWN_LINE = re.compile(r"^([1-7]) \u00b7 (.+?) \u00b7 (Pass|Fix) \u00b7 (.+)$")
SCORE_LINE = re.compile(r"^Score: (\d) of 7 pass", re.M)
NUMBER = re.compile(r"\d[\d,]*(?:\.\d+)?")
FILES = ["teardown.md", "rebuild.json", "mockup.html", "mockup.png", "email.md"]


class Report:
    def __init__(self):
        self.lines = []

    def add(self, status, name, detail=""):
        self.lines.append((status, name, detail))

    def check(self, ok, name, detail_if_bad, status_if_bad="FAIL"):
        self.add("PASS" if ok else status_if_bad, name, "" if ok else detail_if_bad)

    def failed(self):
        return any(s == "FAIL" for s, _, _ in self.lines)


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def strings(value):
    """Every string inside a JSON value."""
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for v in value.values():
            yield from strings(v)
    elif isinstance(value, list):
        for v in value:
            yield from strings(v)


def hits(pattern, text):
    found = sorted({m.group(0).lower() for m in pattern.finditer(text)})
    return ", ".join(found)


def dash_lines(text):
    return [n for n, line in enumerate(text.splitlines(), 1) if DASHES.search(line)]


def known_numbers(folder, profile):
    """Every number in the pulled data, plus rounded versions and the lengths a teardown cites."""
    nums = set()

    def walk(v):
        if isinstance(v, bool):
            return
        if isinstance(v, int):
            nums.add(str(v))
        elif isinstance(v, float):
            nums.update({str(round(v)), f"{v:.1f}", f"{v:g}"})
        elif isinstance(v, dict):
            for x in v.values():
                walk(x)
        elif isinstance(v, list):
            for x in v:
                walk(x)

    for name in ("profile.json", "stats.json", "pull-meta.json", "posts.json", "company.json"):
        path = folder / "raw" / name
        if path.exists():
            text = path.read_text(encoding="utf-8")
            nums.update(n.replace(",", "") for n in NUMBER.findall(text))
            walk(json.loads(text))
    basic = profile.get("basic_info") or {}
    for field in ("headline", "about"):
        nums.add(str(len(basic.get(field) or "")))
    return nums


def untraced_numbers(text, known):
    """Numbers above 10 that appear nowhere in the pulled data. Small numbers are counts and list markers."""
    text = re.sub(r"^\s*\d+\.\s", "", text, flags=re.M)
    text = re.sub(r"\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?", "", text)  # dates come from the pull
    out = []
    for raw in NUMBER.findall(text):
        n = raw.replace(",", "").rstrip(".")
        try:
            if float(n) <= 10:
                continue
        except ValueError:
            continue
        if n not in known:
            out.append(raw)
    return sorted(set(out))


def check_teardown(folder, known, r):
    text = (folder / "teardown.md").read_text(encoding="utf-8")
    rows = [m for m in (TEARDOWN_LINE.match(line.strip()) for line in text.splitlines()) if m]
    numbers = [int(m.group(1)) for m in rows]
    r.check(numbers == list(range(1, 8)), "teardown: 7 checks in order",
            f"found check numbers {numbers}, want 1 to 7 once each in the form '<#> \u00b7 <Check> \u00b7 <Pass|Fix> \u00b7 <fact>'")
    passes = sum(m.group(3) == "Pass" for m in rows)
    score = SCORE_LINE.search(text)
    r.check(bool(score) and int(score.group(1)) == passes, "teardown: score line matches",
            f"{passes} checks pass but the score line says {score.group(1) if score else 'nothing'}")
    bad = dash_lines(text)
    r.check(not bad, "teardown: no em or en dashes",
            f"lines {bad}. Fine only inside a quote of their own words", "WARN")
    stray = untraced_numbers(text, known)
    r.check(not stray, "teardown: numbers trace to the pull",
            f"not in the pulled data: {', '.join(stray)}. Check each by hand", "WARN")
    return sum(m.group(3) == "Fix" for m in rows)


def check_rebuild(folder, r):
    plan = read_json(folder / "rebuild.json")
    headline = plan.get("headline") or ""
    r.check(0 < len(headline) <= 80, "after: headline 80 characters or fewer", f"{len(headline)} characters")
    segments = len(SEGMENT_SPLIT.split(headline)) if headline else 0
    r.check(segments <= 2, "after: headline 2 segments or fewer", f"{segments} segments")
    about = plan.get("about") if isinstance(plan.get("about"), list) else []
    r.check(3 <= len(about) <= 5, "after: About has 3 to 5 bullets", f"{len(about)} bullets")
    website = plan.get("website") or ""
    r.check(bool(website) and "linkedin.com" not in website.lower(), "after: website link under the name",
            f"website is '{website}'")
    banner = plan.get("banner") or {}
    r.check(bool(banner.get("text")), "after: banner has a message", "banner.text is empty")
    r.check(bool((plan.get("featured") or {}).get("image")), "after: featured item has an image",
            "featured.image is empty")
    refs = [plan.get("headshot"), banner.get("image"), banner.get("logo"), (plan.get("featured") or {}).get("image")]
    missing = [ref for ref in refs if ref and not re.match(r"https?://", ref) and not (folder / ref).exists()]
    r.check(bool(plan.get("headshot")) and not missing, "after: image files exist",
            f"missing: {', '.join(missing) or 'headshot not set'}")
    copy = "\n".join(strings({k: v for k, v in plan.items() if k != "button_today"}))
    r.check(not DASHES.search(copy), "after: no em or en dashes", "rebuild.json has one")
    found = hits(BANNED, copy)
    r.check(not found, "after: no banned words", found)
    png, html = folder / "mockup.png", folder / "mockup.html"
    r.check(png.exists() and png.stat().st_mtime >= (folder / "rebuild.json").stat().st_mtime,
            "mockup.png is up to date", "rebuild.json changed after the picture. Run scripts/mockup.py again")
    r.check(html.exists() and html.stat().st_size > 0, "mockup.html written", "missing or empty")


def check_email(folder, profile, fixes, known, r):
    text = (folder / "email.md").read_text(encoding="utf-8").strip()
    if not text:
        return  # already reported as an empty file
    if text.startswith("No email."):
        r.check(fixes == 0, "email: skipped only when nothing needs fixing",
                f"email.md says no email, but the teardown has {fixes} Fix lines")
        return
    lines = text.splitlines()
    r.check(lines[0].startswith("Subject: "), "email: first line is 'Subject: ...'", f"first line is '{lines[0]}'")
    body = "\n".join(lines[1:])
    first = (profile.get("basic_info") or {}).get("first_name") or ""
    r.check(bool(first) and re.search(rf"^Hey {re.escape(first)}\b", body, re.M) is not None,
            "email: greets them by first name", f"no 'Hey {first},' line")
    items = re.findall(r"^\s*\d+\.\s", body, re.M)
    r.check(1 <= len(items) <= 4, "email: lists 1 to 4 improvements", f"{len(items)} numbered items")
    r.check(len(items) <= fixes, "email: every improvement is a Fix in the teardown",
            f"{len(items)} improvements but only {fixes} Fix lines")
    found = hits(LINK, text)
    r.check(not found, "email: no links", found)
    r.check("attach" in body.lower(), "email: mentions the attached mockup", "no mention of the attachment")
    bad = dash_lines(text)
    r.check(not bad, "email: no em or en dashes", f"lines {bad}")
    found = hits(BANNED, text)
    r.check(not found, "email: no banned words", found)
    stray = untraced_numbers(text, known)
    r.check(not stray, "email: numbers trace to the pull", f"not in the pulled data: {', '.join(stray)}")
    words = len(body.split())
    r.check(words <= 170, "email: short", f"{words} words. Aim for 170 or fewer", "WARN")


def main():
    parser = argparse.ArgumentParser(description="Check one founder's folder before Ziad sees it.")
    parser.add_argument("folder", help="The founder's folder, e.g. out/ziad-hassan")
    folder = Path(parser.parse_args().folder)
    r = Report()

    missing = [f for f in FILES if not (folder / f).exists() or (folder / f).stat().st_size == 0]
    r.check(not missing, "all files written", f"missing or empty: {', '.join(missing)}")
    profile_path = folder / "raw" / "profile.json"
    if not profile_path.exists():
        r.add("FAIL", "pulled data", f"no {profile_path}. Run scripts/pull.py first")
    else:
        profile = read_json(profile_path)
        known = known_numbers(folder, profile)
        fixes = check_teardown(folder, known, r) if (folder / "teardown.md").exists() else 0
        if (folder / "rebuild.json").exists():
            check_rebuild(folder, r)
        if (folder / "email.md").exists():
            check_email(folder, profile, fixes, known, r)

    for status, name, detail in r.lines:
        print(f"{status}  {name}" + (f": {detail}" if detail else ""))
    counts = {s: sum(1 for x, _, _ in r.lines if x == s) for s in ("PASS", "WARN", "FAIL")}
    print(f"\n{counts['PASS']} pass, {counts['WARN']} warn, {counts['FAIL']} fail")
    return 1 if r.failed() else 0


if __name__ == "__main__":
    sys.exit(main())
