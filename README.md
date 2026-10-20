# LinkedIn Rebuild

Paste a B2B founder's LinkedIn URL. Get Ziad's outreach email with a list of improvements, and a picture of their profile today next to the rebuilt version.

Team 9: Ziad Hassan (founder), Charlotte Driscoll, Yuri Mukai, Dan Chauvin.

## Start

1. Clone this repo and open it in Claude Code (`claude`).
2. Read the brief: `brief/team-9-linkedin-rebuild-brief.pdf`.
3. Ask Claude: "Read CLAUDE.md and the brief. Restate the workflow as numbered steps with inputs and outputs."
4. Everyone: copy `.env.example` to `.env` and paste the team's Apify token, which is Dan's. Ask Dan for it in a direct message. This repo is public, so the token never goes in a file you commit, a chat thread or a Claude prompt.
5. Photo generator (`scripts/generate_photos.py`): each person needs their own Gemini key from [Google AI Studio](https://aistudio.google.com/apikey). Turn on billing for that key in AI Studio, or the image steps fail. Details in `docs/generate-photos.md`.

## Run

In Claude Code, from this folder:

```
/rebuild https://www.linkedin.com/in/<their-profile>/ connect
```

- The word after the URL is the main button you see on their live profile: `follow` or `connect`. Leave it off if you didn't check.
- Add `photos` to also make a Gemini headshot and banner (needs your own Gemini key, see step 5 above). Only for people who agreed to it.
- Output lands in `out/<their-name>/`. Attach `mockup.png` to the email in `email.md`.
- Each run spends Dan's Apify credits once per founder. A second run on the same person reuses the saved pull.

`CLAUDE.md` has the steps, the rules and the file map.
