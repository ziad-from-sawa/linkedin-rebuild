# Photo generator: profile picture and cover

`scripts/generate_photos.py` uses Gemini to make a better headshot and a new banner from the data `scripts/pull.py` saved.

> **Ziad and team: you need your own Gemini key.** Charlotte's key is not in this repo and is not shared. Get a free key at [Google AI Studio](https://aistudio.google.com/apikey) (sign in with Google, click Create API key), then add it to your `.env` as `GEMINI_API_KEY=` or run `export GEMINI_API_KEY=your_key` before using the script. Never commit the key: this repo is public.

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
  --photo out/<slug>/raw/images/headshot.jpg
```

`--photo` takes `.jpg`, `.png` or `.webp`. Leave it off to download `basic_info.profile_picture_url` instead. Output goes to `output/` in the folder you run from:

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
