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

## Demo app

```
python app/server.py
```

Then open http://127.0.0.1:8787. It walks the same five steps as the demo video: Choose, Scan, Recommend, Generate, Email.

- **Paste a URL** and pick the button you see on their live profile, then press Scan. A new founder takes about a minute to pull and a few minutes for Claude; the scan runs over their profile while Claude scores it, and each check lights up green or amber as the verdicts land.
- **Saved founders open instantly**, so demo with someone already pulled. A link like `http://127.0.0.1:8787/#/jeffrey-bussgang/2` jumps straight to a step.
- **Arrow keys** move between steps. **R** replays the scan.
- **Needs** Python 3, Chrome or Edge, Claude Code installed and logged in (`claude` in a terminal), and the Apify token in `.env`.
- Nothing sends from the app. Copy the email, attach `mockup.png`, send it from your own inbox.

`CLAUDE.md` has the steps, the rules and the file map.
