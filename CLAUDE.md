# LinkedIn Rebuild

Team 9, LTV AI Build Exercise. Founder: Ziad Hassan (Sawa). Read `brief/team-9-linkedin-rebuild-brief.pdf` first.

## What we are building

One command, `/rebuild <linkedin-url> [follow|connect] [photos]`. One founder's LinkedIn URL goes in; Ziad's outreach email comes out, with a picture of their profile today next to the rebuilt version. Ziad sets the target in his note to the team: a list of custom improvements, plus a mockup of the profile with those changes, attached to his email. The full procedure is `.claude/commands/rebuild.md`.

It writes one folder, `out/<their-slug>/`:

| File | What it holds |
|---|---|
| `raw/` | Everything pulled from LinkedIn, the company page and their website (step 1) |
| `teardown.md` | Posting stats and the 7 checks, each Pass or Fix with the fact behind it |
| `rebuild.json` | The rewritten profile: headline, About bullets, banner, website, featured |
| `mockup.png` | Their profile today next to the rebuilt one. The email attachment |
| `mockup.html` | The same picture as a web page |
| `email.md` | Ziad's email: his template, 1 to 4 improvements, no links |
| `photos/` | Only with `photos`: Gemini headshot and banner |

The brief's first post and bump email are not part of the flow for now.

## Steps

1. **Pull.** Run `python scripts/pull.py <linkedin-url>`. It prints the folder, `out/<slug>/`, and saves everything to `out/<slug>/raw/`: profile, own posts (last 90 days and all), posting stats, company page, homepage and its colors, and images. File shapes: `docs/pull-output.md`. Apify actors, with the token in `.env`: profile `apimaestro/linkedin-profile-full-sections-scraper` (replaces the batch profile scraper in the brief: same fields plus skills, recommendations and fuller experience), posts `apimaestro/linkedin-batch-profile-posts-scraper`, company `apimaestro/linkedin-company-detail`.
2. **Score.** Apply `context/scoring-rubric.md` (Yuri) to the pulled data. Write `teardown.md`.
3. **Rewrite.** Write `rebuild.json`: every Fix fixed, every Pass kept, in the founder's voice.
4. **Photos (optional).** `scripts/generate_photos.py` (Charlotte) makes a new headshot and banner image with Gemini. Only for people who agreed to it.
5. **Mockup.** `python scripts/mockup.py out/<slug>` draws `mockup.png`. The Before side comes straight from the pulled data, so no model writes it.
6. **Email.** Fill in `context/email-template.md` (Ziad's own words) with the improvements. Ziad's voice.
7. **Check.** `python scripts/check.py out/<slug>` tests the judging list in the brief. Nothing goes to Ziad on a FAIL.
8. **Review.** Ziad reads the folder, attaches `mockup.png` and sends from his own inbox.

## Rules

- **Never invent.** Every number and every detail traces to the saved JSON or a page you saved. Missing means "not found".
- **Nothing sends.** Emails are drafts for Ziad. Never send, post or message anyone.
- **Anti-AI rules apply** to every word the workflow writes: `context/anti-ai-rules.md`. No em dashes or en dashes. Search for them before calling a file done.
- **Pulled data stays local.** `out/` and `.env` are gitignored. Don't paste other people's data into chat threads.
- **One Apify key, Dan's.** Everyone puts Dan's token in their own `.env`. This repo is public: never commit the token, print it, or paste it into chat or a prompt.

## Apify notes

- The posts actor has no date filter. `scripts/pull.py` keeps the last 90 days and drops reposts.
- Cost is about $0.02 per profile plus $0.005 per post (max 100). Check credit before batch runs.
- `harvestapi` actors cap free plans at 10 lifetime runs. Use the `apimaestro` actors above.
- The team shares Dan's Apify account, so every run spends his credits. Pull each founder once and reuse the saved JSON in `out/`.

## Files

- `context/sawa.md`: the business
- `context/startsawa-website.md`: saved copy of startsawa.com
- `context/profile-checklist.md`: what good looks like
- `context/ziad-voice.md`: how the emails sound
- `context/anti-ai-rules.md`: the writing rules
- `inputs/test-urls.md`: profiles to test on
- `scripts/pull.py`: step 1, the data pull
- `docs/pull-output.md`: what step 1 writes, field by field
- `scripts/generate_photos.py`: Gemini headshot and banner generator (`docs/generate-photos.md`)
- `.claude/commands/rebuild.md`: the whole flow, steps 1 to 8
- `context/scoring-rubric.md`: exact Pass and Fix rules for the 7 checks
- `context/email-template.md`: Ziad's email, word for word
- `scripts/mockup.py`: step 5, the before-and-after picture
- `scripts/check.py`: step 7, the judging list as tests
- `app/server.py`: the demo app (`app/static/`), a page over the same flow
- `docs/test-plan.md`, `docs/test-log.md`: how the flow is tested, and what each cycle found
