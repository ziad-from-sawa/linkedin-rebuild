# Photo generator: profile picture and cover

`scripts/generate_photos.py` uses Gemini to make a better headshot and a new banner from the data `scripts/pull.py` saved.

> **Ziad and team: you need your own Gemini key.** Charlotte's key is not in this repo and is not shared. Get a key at [Google AI Studio](https://aistudio.google.com/apikey) (sign in with Google, click Create API key), then add it to your `.env` as `GEMINI_API_KEY=` or run `export GEMINI_API_KEY=your_key` before using the script. Never commit the key: this repo is public.

> **Billing is required for the image steps.** Free keys can write prompts (step 1) but have zero quota for Gemini image models, so steps 2 and 3 fail with `429 RESOURCE_EXHAUSTED ... limit: 0`. To fix:
> 1. Go to [Google AI Studio](https://aistudio.google.com/apikey).
> 2. Next to your key, click **Set up billing** (or **Upgrade**) and add a card. This links your key to a Google Cloud billing account.
> 3. Wait a few minutes, then run the script again in the same Terminal window.

## Steps

1. Gemini (text) reads `profile.json` and the rubric and writes two image prompts.
2. Gemini (image) edits the headshot: solid color background and a professional outfit. The face stays the same.
3. Gemini (image) makes a banner from the profile context. No people, no text.
4. Pillow crops to LinkedIn sizes.

## Setup

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
export GEMINI_API_KEY=your_key   # https://aistudio.google.com/apikey
```

## Run

```bash
python scripts/generate_photos.py \
  --json out/<slug>/raw/profile.json \
  --rubric context/profile-checklist.md \
  --photo out/<slug>/raw/images/headshot.jpg \
  --out out/<slug>/photos
```

`--photo` takes `.jpg`, `.png` or `.webp`. Leave it off to download `basic_info.profile_picture_url` instead. Output goes to `--out` (default `output/` in the folder you run from). `/rebuild <url> photos` runs this for you and puts the results in `out/<slug>/photos/`. The key can live in `.env` as `GEMINI_API_KEY=`; the script reads it from there.

- `profile.png`: 800x800 headshot
- `cover.jpg`: 1584x396 banner
- `prompts.json`: the prompts Gemini wrote

## Models

Defaults are `gemini-3.8-flash` (text) and `gemini-3.1-flash-image` (image). To try another without editing the script:

```bash
export GEMINI_IMAGE_MODEL=gemini-3.1-flash-lite-image
```

A 503 error means the model is busy. Wait a few minutes or switch models.

## Rules

Only edit photos of people who agreed to it. Keep them recognizable. Output is for review, nothing gets posted.
