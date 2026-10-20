# Demo video

A 60-second walkthrough of the five steps, run on Ziad's own profile: choose, scan, recommend, generate, email.

- **Watch it live:** open `index.html` in Chrome. Space pauses, arrow keys scrub, `?t=30` starts at 30 seconds.
- **Render the MP4:** `npm install`, then `npm run render`. Writes `out/linkedin-rebuild-demo.mp4` (1080p, 30 fps) in about 5 minutes, using 4 browser pages in parallel (`--workers 6` for more). Needs Google Chrome and ffmpeg.
- **Check one frame:** `node snap.mjs 12.5` saves `out/snap-12.5.png`.
- **Other profiles:** `index.html?p=bussgang` loads `data-bussgang.js` (Jeff Bussgang). `npm run render -- --p bussgang` writes `out/linkedin-rebuild-demo-bussgang.mp4`, and `node snap.mjs --p bussgang 12.5` works too.

| File | What it holds |
|---|---|
| `data.js` | Every fact on screen: checks, stats, fixes, post, email |
| `demo.js` | The timeline. Each scene is a function of time |
| `demo.css` | Sawa look: near-black, off-white, Manrope, glass panels |
| `assets/` | Real screenshots of the profile, Sawa font and texture |

Facts trace to the pull saved in `out/ziad-has/raw/` (gitignored). The screenshots hide only owner-only controls (edit pencils, the private Analytics card).
