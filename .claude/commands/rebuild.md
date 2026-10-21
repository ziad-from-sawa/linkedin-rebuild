---
description: One LinkedIn URL in, Ziad's outreach email and a before-and-after mockup out
argument-hint: <linkedin-url> [follow|connect] [photos]
allowed-tools: Bash(python scripts/pull.py:*), Bash(python3 scripts/pull.py:*), Bash(python scripts/mockup.py:*), Bash(python3 scripts/mockup.py:*), Bash(python scripts/check.py:*), Bash(python3 scripts/check.py:*), Bash(python scripts/generate_photos.py:*), Bash(python3 scripts/generate_photos.py:*), Read, Write(out/**), Edit(out/**), Glob, Grep
---

# /rebuild

Input: $ARGUMENTS

Turn one founder's LinkedIn profile into the email Ziad sends them: a short list of improvements, plus a picture of their profile today next to the rebuilt version. Read `CLAUDE.md` first if you haven't this session.

## Arguments

- **First:** the LinkedIn profile URL. Required.
- **`follow` or `connect`:** optional. The main button Ziad saw on their live profile. Without it, check 7 can't pass and stays out of the email.
- **`photos`:** optional. Also run Gemini to make a new headshot and banner image. Only for people who agreed to have their photo edited (`docs/generate-photos.md`). Off by default.

Use `python` on Windows and `python3` on a Mac.

## 1. Pull

Look for an earlier pull first, so Dan's Apify credits aren't spent twice: search `out/*/raw/pull-meta.json` for a `"username"` equal to the part of the URL after `/in/`, lowercased. If one exists, reuse that folder and say so.

Otherwise run `python scripts/pull.py <url>`. The folder is the one line it prints on stdout, e.g. `out/ziad-hassan`. If it prints a line starting with `ERROR:`, stop and show Ziad that line.

Call the folder `F`. `docs/pull-output.md` describes every file in `F/raw/`.

## 2. Score: write `F/teardown.md`

**Fit first.** Sawa sells to founders and CEOs of B2B companies with 10 to 200 staff (`context/sawa.md`). From their current roles in `experience[]` and `company.json`, write one Fit line: Yes if they founded or run their company, No otherwise (a student, an intern, an employee). A No doesn't stop the run, but the rewrite then speaks for the person, never for an employer's brand.

Follow `context/scoring-rubric.md` exactly. Read `F/raw/profile.json`, `F/raw/stats.json` and `F/raw/pull-meta.json`, and open `F/raw/images/headshot.*` and `F/raw/images/banner.*` to look at them.

```
# Teardown: <full name>

<linkedin url> · pulled <pulled_at date>

Fit: <Yes or No>. <one line: their current role and company, and its size from company.json>

<the 7 check lines, in the rubric's format>

Score: <n> of 7 pass

## Posting stats
<the rubric's stats, numbers copied from stats.json>
```

## 3. Rewrite: write `F/rebuild.json`

The After side of the mockup. Every Fix gets fixed. Every Pass keeps what they have today: write the string `"keep"` for that field and the mockup shows their current version. Fields and their checks: `headshot` 1, `website` 2, `banner` 3, `about` 4, `featured` 5, `headline` 6. `scripts/check.py` fails a `"keep"` on a check that scored Fix.

```json
{
  "button_today": "Follow" or "Connect" or null,
  "headline": "...",
  "website": "acme.com",
  "about": ["...", "...", "..."],
  "banner": {"text": "...", "subtext": "...", "background": "#hex", "color": "#hex", "logo": "raw/images/company-logo.png"},
  "headshot": "raw/images/headshot.jpg",
  "featured": {"title": "...", "image": "raw/images/featured-1.jpg"}
}
```

- **headline:** `"keep"` if check 6 passed. Otherwise 80 characters or fewer, 2 segments or fewer: their role, their company and what it does for whom, from `company.json` and their own About and posts.
- **website:** `"keep"` if check 2 passed. Otherwise their own site, or the site of a company they founded or run now (from `company.json`, or named in their About or posts). Never an employer's site when they are an intern, student or past member, and never an institution's (a school, the military). Domain only, no `https://`. If nothing qualifies, write `null`; the check stays out of the email.
- **about:** `"keep"` if check 4 passed. Otherwise 3 to 5 bullets, each under about 90 characters, in their voice (`I` for a person). What they do, who for, one proof point, how to reach them. Every fact comes from their profile, company page, saved website or posts. "How to reach them" names only a channel in the data (a LinkedIn message, their own website) and never claims a preference they didn't state.
- **banner:** `"keep"` if check 3 passed. Otherwise an object. **text:** what the company does, in 6 words or fewer, from the company's own tagline or description. **subtext** is optional, one short line. **background** is their main brand color from `website-colors.json` (check it against `raw/images/company-logo.*`), only for a company they founded or run; a Fit No uses the default below and a banner about their own work; **color** is white or near-black, whichever reads better on it. **logo** only if a company logo was saved. With no brand colors, use `#1d2226` and white.
- **headshot:** `"keep"` if check 1 passed. If it failed, `raw/images/headshot.*` as saved (only the `photos` step can fix the photo itself; the email can still name the fix). If they have no photo at all, write `null`.
- **featured:** `"keep"` if check 5 passed. Otherwise pin one real post of theirs, in this order: the best post in `stats.json` (find it in `posts.json` by `url`); else, with no posts in the window, their most-reacted post in `posts-all-own.json` that has an image. The title is the post's first line, word for word (`check.py` fails anything else), and the image is that post's first `media.images[].url`. If they have no post at all, write `null`: the mockup shows an empty slot, and the check stays out of the email. Never feature an award, a logo or a made-up post.

The founder will read this copy as their own, so it follows `context/anti-ai-rules.md` and invents nothing.

## 4. Photos (only with `photos`)

```
python scripts/generate_photos.py --json F/raw/profile.json --rubric context/scoring-rubric.md --photo F/raw/images/headshot.<ext> --out F/photos
```

If it works, set `headshot` to `photos/profile.png` and add `"image": "photos/cover.jpg"` to `banner`. If it fails (no `GEMINI_API_KEY` in `.env`, or billing not set up), keep going without it and tell Ziad why.

## 5. Mockup

```
python scripts/mockup.py F
```

It writes `F/mockup.html` and `F/mockup.png`. Open `F/mockup.png` and look at it: text cut off, unreadable banner colors, missing images. Fix `rebuild.json` and run it again until it looks right.

## 6. Email: write `F/email.md`

Use `context/email-template.md` word for word and fill in the slots. Greet them by the name they go by: their LinkedIn first name, unless their posts, reposts or About show a shorter form they go by (a Jeffrey whose posts say "no one calls me Jeffrey" and whose reposts say "Jeff" gets "Hey Jeff"). Pick 1 to 4 confirmed Fix lines from the teardown, most visible first, and only fixes the mockup shows: a `null` website or featured, or an unconfirmed button, stays out. Write each improvement in Ziad's voice (`context/ziad-voice.md`), with their specific fact and the change. No links. If every check passed, write `No email. <Name> passes all 7 checks.`

## 7. Check

```
python scripts/check.py F
```

Fix every FAIL and run it again until there are none. Read each WARN and fix the ones that are real. Then read `email.md` and `rebuild.json` against `context/anti-ai-rules.md` yourself: the script only catches the mechanical rules.

## 8. Report to Ziad

Keep it short:

- The folder, the score (`n of 7`) and the Fit line.
- The email, pasted in full, ready to copy.
- The attachment: `F/mockup.png`.
- Anything he must confirm by hand (the button if he didn't pass one, any WARN left).

## Never

- Invent a fact, number, client, result or quote. Missing means "not found".
- Send, post or message anyone. Ziad sends the email himself.
- Print, paste or commit a token, or anything in `out/`.
- Write or edit any file outside `F`. If a script or a rule gets in the way, stop and tell Ziad what blocked you; the fix belongs in the repo, made by a person.
- Call Apify, or any paid service, except through `scripts/pull.py`, once per founder. If the pull came back incomplete, say so instead of fetching more.
