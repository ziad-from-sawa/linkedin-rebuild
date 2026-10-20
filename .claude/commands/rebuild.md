---
description: One LinkedIn URL in, Ziad's outreach email and a before-and-after mockup out
argument-hint: <linkedin-url> [follow|connect] [photos]
allowed-tools: Bash(python scripts/pull.py:*), Bash(python3 scripts/pull.py:*), Bash(python scripts/mockup.py:*), Bash(python3 scripts/mockup.py:*), Bash(python scripts/check.py:*), Bash(python3 scripts/check.py:*), Bash(python scripts/generate_photos.py:*), Bash(python3 scripts/generate_photos.py:*), Read, Write, Edit, Glob, Grep
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

Follow `context/scoring-rubric.md` exactly. Read `F/raw/profile.json`, `F/raw/stats.json` and `F/raw/pull-meta.json`, and open `F/raw/images/headshot.*` and `F/raw/images/banner.*` to look at them.

```
# Teardown: <full name>

<linkedin url> · pulled <pulled_at date>

<the 7 check lines, in the rubric's format>

Score: <n> of 7 pass

## Posting stats
<the rubric's stats, numbers copied from stats.json>
```

## 3. Rewrite: write `F/rebuild.json`

The After side of the mockup. Every Fix gets fixed. Every Pass keeps what they have today.

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

- **headline:** if it passed, copy it. Otherwise 80 characters or fewer, 2 segments or fewer: their role, their company and what it does for whom, from `company.json` and their own About and posts.
- **website:** `creator_website` if it isn't LinkedIn, else the company website from `company.json`. Domain only, no `https://`.
- **about:** 3 to 5 bullets, each under about 90 characters, in their voice (`I` for a person). What they do, who for, one proof point, how to reach them. Every fact comes from their profile, company page or posts.
- **banner.text:** what the company does, in 6 words or fewer, from the company's own tagline or description. **subtext** is optional, one short line. **background** is their main brand color from `website-colors.json` (check it against `raw/images/company-logo.*`); **color** is white or near-black, whichever reads better on it. **logo** only if a company logo was saved. With no brand colors, use `#1d2226` and white.
- **headshot:** `raw/images/headshot.*` as saved.
- **featured:** if they have a featured item with an image, keep it (its `description` and `raw/images/featured-1.*`). Otherwise feature their best post from `stats.json`: the title is its first line from `posts.json` (match by `url`), and the image is the post's first `media.images[].url`, else `raw/images/company-cover.*`.

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

Use `context/email-template.md` word for word and fill in the slots. Pick 1 to 4 confirmed Fix lines from the teardown, most visible first. Write each improvement in Ziad's voice (`context/ziad-voice.md`), with their specific fact and the change. No links. If every check passed, write `No email. <Name> passes all 7 checks.`

## 7. Check

```
python scripts/check.py F
```

Fix every FAIL and run it again until there are none. Read each WARN and fix the ones that are real. Then read `email.md` and `rebuild.json` against `context/anti-ai-rules.md` yourself: the script only catches the mechanical rules.

## 8. Report to Ziad

Keep it short:

- The folder, and the score (`n of 7`).
- The email, pasted in full, ready to copy.
- The attachment: `F/mockup.png`.
- Anything he must confirm by hand (the button if he didn't pass one, any WARN left).

## Never

- Invent a fact, number, client, result or quote. Missing means "not found".
- Send, post or message anyone. Ziad sends the email himself.
- Print, paste or commit a token, or anything in `out/`.
