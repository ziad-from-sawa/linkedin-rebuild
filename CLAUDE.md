# LinkedIn Rebuild

Team 9, LTV AI Build Exercise. Founder: Ziad Hassan (Sawa). Read `brief/team-9-linkedin-rebuild-brief.pdf` first.

## What we are building

One command, `/rebuild <linkedin-url>`. It takes a B2B founder's LinkedIn profile and writes one folder, `out/<their-slug>/`, with five files:

| File | What it holds |
|---|---|
| `teardown.md` | Posting stats and the 7-point checklist, each check Pass or Fix with the fact behind it |
| `mockup.html` | The top of their profile, rebuilt: banner, headshot on a solid color, short headline, website link, Follow button, About in bullets, one featured post with an image |
| `first-post.md` | One LinkedIn post we would write for them, in their voice |
| `email-1.md` | First email from Ziad. Shows the work. No links |
| `email-2-bump.md` | Short follow-up. Adds https://calendly.com/ziad-startsawa/15min |

## Steps

1. **Pull.** Run `python scripts/pull.py <linkedin-url>`. It prints the folder, `out/<slug>/`, and saves everything to `out/<slug>/raw/`: profile, own posts (last 90 days and all), posting stats, company page, homepage and its colors, and images. File shapes: `docs/pull-output.md`. Apify actors, with the token in `.env`: profile `apimaestro/linkedin-profile-full-sections-scraper` (replaces the batch profile scraper in the brief: same fields plus skills, recommendations and fuller experience), posts `apimaestro/linkedin-batch-profile-posts-scraper`, company `apimaestro/linkedin-company-detail`.
2. **Score.** Check against `context/profile-checklist.md`. Write `teardown.md`.
3. **Rebuild.** Write `mockup.html`. Use colors from their company website.
4. **Post.** Write `first-post.md` from their own posts and About section.
5. **Email.** Write both emails in Ziad's voice (`context/ziad-voice.md`).
6. **Review.** Ziad reads the folder and drafts the emails into his own inbox.

## Rules

- **Never invent.** Every number and every detail traces to the saved JSON or a page you saved. Missing means "not found".
- **Nothing sends.** Emails are drafts for Ziad. Never send, post or message anyone.
- **Anti-AI rules apply** to every word the workflow writes: `context/anti-ai-rules.md`. No em dashes or en dashes. Search for them before calling a file done.
- **Pulled data stays local.** `out/` and `.env` are gitignored. Don't paste other people's data into chat threads.

## Apify notes

- The posts actor has no date filter. `scripts/pull.py` keeps the last 90 days and drops reposts.
- Cost is about $0.02 per profile plus $0.005 per post (max 100). Check credit before batch runs.
- `harvestapi` actors cap free plans at 10 lifetime runs. Use the `apimaestro` actors above.
- A free Apify account is enough for testing.

## Files

- `context/sawa.md`: the business
- `context/startsawa-website.md`: saved copy of startsawa.com
- `context/profile-checklist.md`: what good looks like
- `context/ziad-voice.md`: how the emails sound
- `context/anti-ai-rules.md`: the writing rules
- `inputs/test-urls.md`: profiles to test on
- `scripts/pull.py`: step 1, the data pull
- `docs/pull-output.md`: what step 1 writes, field by field
