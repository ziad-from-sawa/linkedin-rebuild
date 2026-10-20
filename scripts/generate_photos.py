"""
LinkedIn profile picture + cover photo generator (Gemini).

Input:  Apify LinkedIn profile JSON (+ optional local .jpg) and a rubric .txt
Output: output/profile.png (800x800) and output/cover.jpg (1584x396)

Steps:
  1. Gemini (text) reads the profile + rubric and writes the image prompts.
  2. Gemini (image) edits the photo: clean background + professional outfit, same face.
  3. Gemini (image) creates a cover photo from the profile context.
  4. Pillow crops/resizes to LinkedIn sizes.

Usage:
  export GEMINI_API_KEY=your_key
  python generate_photos.py --json profile.json --rubric rubric.txt [--photo photo.jpg]
"""
import argparse, json, os, sys
from io import BytesIO

import requests
from PIL import Image, ImageOps
from google import genai
from google.genai import types

TEXT_MODEL = os.getenv("GEMINI_TEXT_MODEL", "gemini-3.8-flash")
IMAGE_MODEL = os.getenv("GEMINI_IMAGE_MODEL", "gemini-3.1-flash-image")
OUT_DIR = "output"

client = genai.Client()  # reads GEMINI_API_KEY


def load_profile(path):
    data = json.load(open(path, encoding="utf-8"))
    return data[0] if isinstance(data, list) else data  # Apify returns a list


def get_photo(profile, photo_path):
    if photo_path:
        img = Image.open(photo_path)  # works with .png, .jpg, .jpeg, .webp
        if img.mode in ("RGBA", "LA", "P"):  # transparent PNG -> white background
            img = img.convert("RGBA")
            bg = Image.new("RGB", img.size, "white")
            bg.paste(img, mask=img.split()[-1])
            return bg
        return img.convert("RGB")
    bi = profile.get("basic_info") or {}
    if bi.get("profile_picture_url"):
        profile = {**profile, "profilePicture": bi["profile_picture_url"]}
    for key in ("profilePicture", "profilePic", "profilePicHighQuality", "photo", "profilePictureUrl"):
        url = profile.get(key)
        if isinstance(url, dict):
            url = url.get("url")
        if url:
            r = requests.get(url, timeout=30)
            r.raise_for_status()
            return Image.open(BytesIO(r.content)).convert("RGB")
    sys.exit("No photo found. Pass --photo or check the JSON's picture field.")


def profile_summary(p):
    keys = ["fullName", "firstName", "lastName", "headline", "about", "summary",
            "jobTitle", "companyName", "industry", "location", "addressWithCountry"]
    flat = {**p, **(p.get("basic_info") or {})}  # apimaestro nests fields in basic_info
    keys += ["fullname", "about", "current_company", "creator_website"]
    s = {k: flat[k] for k in keys if flat.get(k)}
    exp = p.get("experiences") or p.get("experience") or []
    s["experience"] = exp[:3]
    return json.dumps(s, ensure_ascii=False, default=str)[:6000]


def plan_prompts(summary, rubric):
    """Step 1: write the two image prompts based on profile + rubric."""
    ask = f"""You are a LinkedIn branding expert. Using the profile and rubric below,
write two image prompts. Return JSON only:
{{"profile_prompt": "...", "cover_prompt": "..."}}

profile_prompt: instructions to EDIT the person's existing photo. Always keep the face,
identity, skin tone and expression unchanged. Replace the background with a solid,
flat color (pick one that suits their brand) and dress them in an outfit appropriate to their field. Head-and-shoulders,
centered, soft studio lighting.

cover_prompt: a wide banner image (no people, no text, no logos) that visually reflects
their industry, role and personal brand. Keep the left ~third calm/simple, because the
profile picture overlaps it.

RUBRIC:
{rubric}

PROFILE:
{summary}"""
    r = client.models.generate_content(
        model=TEXT_MODEL, contents=ask,
        config=types.GenerateContentConfig(response_mime_type="application/json"))
    return json.loads(r.text)


def gemini_image(contents):
    r = client.models.generate_content(model=IMAGE_MODEL, contents=contents)
    for part in r.candidates[0].content.parts:
        if part.inline_data:
            return Image.open(BytesIO(part.inline_data.data)).convert("RGB")
    sys.exit("Gemini returned no image (possibly blocked). Try rewording the prompt.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", required=True, help="Apify profile JSON")
    ap.add_argument("--rubric", required=True, help="Rubric text file")
    ap.add_argument("--photo", help="Optional local photo (otherwise uses JSON URL)")
    a = ap.parse_args()
    os.makedirs(OUT_DIR, exist_ok=True)

    profile = load_profile(a.json)
    rubric = open(a.rubric, encoding="utf-8").read()
    photo = get_photo(profile, a.photo)

    print("1/3 Planning prompts...")
    prompts = plan_prompts(profile_summary(profile), rubric)
    json.dump(prompts, open(f"{OUT_DIR}/prompts.json", "w"), indent=2)

    print("2/3 Editing profile picture...")
    pic = gemini_image([prompts["profile_prompt"] + " Square 1:1 framing.", photo])
    ImageOps.fit(pic, (800, 800), centering=(0.5, 0.4)).save(f"{OUT_DIR}/profile.png")

    print("3/3 Generating cover photo...")
    cover = gemini_image([prompts["cover_prompt"] + " Very wide panoramic landscape composition."])
    ImageOps.fit(cover, (1584, 396)).save(f"{OUT_DIR}/cover.jpg", quality=95)

    print(f"Done -> {OUT_DIR}/profile.png, {OUT_DIR}/cover.jpg, {OUT_DIR}/prompts.json")


if __name__ == "__main__":
    main()
