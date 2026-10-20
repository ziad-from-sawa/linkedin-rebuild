# Step 1 output: what `scripts/pull.py` writes

Code steps 2 to 5 against this. Field names come from real pulls of 4 profiles (Oct 20, 2026).

## Running it

```
python scripts/pull.py <linkedin-url>
python scripts/pull.py --from-file inputs/test-urls.md
python scripts/pull.py --check        # re-run the field check on out/, no Apify calls
```

- **stdout** gets one line per profile pulled: the folder, e.g. `out/ziad-hassan`. Use this in `/rebuild` to find the files.
- **stderr** gets progress, warnings and the field table.
- **Exit code** is 0 if every URL worked, 1 if any failed. Errors are one line starting with `ERROR:`.
- Needs `APIFY_API_TOKEN` in `.env`. Standard library only, no installs.
- Cost: about $0.02 per profile plus $0.005 per post returned (max 100), so $0.02 to $0.52 per founder.

## Sources

| Source | Actor or method | Saved as |
|---|---|---|
| Profile | `apimaestro/linkedin-profile-full-sections-scraper` (superset of the batch scraper in the brief: adds skills, recommendations, fuller experience) | `profile.json` |
| Posts | `apimaestro/linkedin-batch-profile-posts-scraper`, newest 100 | `posts.json`, `posts-all-own.json`, `posts.actor.json` |
| Company | `apimaestro/linkedin-company-detail` on `current_company_url` | `company.json` |
| Website | Plain HTTP fetch of the founder's `creator_website`, else the company page's website | `website.html`, `website-colors.json` |
| Images | Downloaded from LinkedIn (their URLs expire after about 2 weeks) | `images/` |

## Folder

`out/<slug>/raw/`, where `<slug>` is `basic_info.fullname` lowercased with non-letters turned into `-` (Ziad Hassan becomes `ziad-hassan`). If two different people share a name, the second gets `<slug>-<username>`. Steps 2 to 5 write their files in `out/<slug>/`, next to `raw/`.

| File | Always there? | What it is |
|---|---|---|
| `profile.json` | yes | One object, exactly as the profile actor returned it |
| `posts.json` | yes | The founder's **own** posts from the last 90 days, newest first. Actor item shape |
| `posts-all-own.json` | yes | Same filter without the 90 day limit (everything the actor returned, up to 100) |
| `posts.actor.json` | yes | Everything the posts actor returned, unfiltered. For tracing numbers only |
| `stats.json` | yes | Posting stats computed by the script. **Use these numbers, don't recompute** |
| `company.json` | if found | Company page data. Absent for no company or a placeholder like "Stealth Startup" |
| `website.html` | if fetched | The homepage, saved |
| `website-colors.json` | yes | Hex colors found on the website, or a note on why there are none |
| `images/` | if any | `headshot`, `banner`, `featured-N`, `company-logo`, `company-cover` (`.jpg`/`.png`) |
| `pull-meta.json` | yes | When it was pulled, sources, post counts, image paths and the field check |

Optional keys are absent, not null, throughout. Use `.get()`.

## `profile.json`

Checklist fields:

| Check | Path | Notes |
|---|---|---|
| 1 Headshot | `basic_info.profile_picture_url`, local copy `images/headshot.*` | Open the local image to judge the background |
| 2 Website | `basic_info.creator_website` | The website link under the name |
| 3 Banner | `basic_info.background_picture_url`, local copy `images/banner.*` | Empty or missing means Fix |
| 4 About | `basic_info.about` | Plain text with `\n` line breaks |
| 5 Featured | `featured[]` with `type`, `description`, `url`, `image_url`, `social_counts.likes`, `social_counts.comments` | Pass needs one item with `image_url`. Local copies `images/featured-N.*` |
| 6 Headline | `basic_info.headline` | |
| 7 Follow button | `basic_info.is_creator` | **Not reliable.** It is `false` on Ziad's profile, which shows Follow. Confirm on the live page |

More for the rubric:

| Path | What it gives you |
|---|---|
| `basic_info.follower_count`, `connection_count`, `show_follower_count` | Audience size |
| `basic_info.is_premium`, `is_verified`, `is_top_voice`, `is_influencer`, `open_to_work` | Profile flags |
| `basic_info.creator_hashtags[]`, `top_skills[]` | Topics they claim (often empty) |
| `basic_info.location.full`, `primary_locale`, `created_timestamp` | Where, which language, account age |
| `basic_info.current_company`, `current_company_url`, `top_education_school` | Current role context |
| `experience[]` | `title`, `company`, `description`, `start_date`, `end_date`, `is_current`, `employment_type`, `location`, `skills[]` |
| `education[]` | `school`, `degree`, `field_of_study`, `description`, `activities`, dates |
| `skills[]` | `name`, `endorsement_count` |
| `recommendations[]` | `recommender_name`, `recommender_title`, `relationship`, `recommendation_text`, `recommendation_date`, `type` |
| `languages[]`, `volunteering-experiences[]`, `honors[]`, `certifications[]`, `projects[]` | Present only if the profile has them |

## `posts.json` and `posts-all-own.json`

Filtered so every item is the founder's own post:

- reposts removed (`post_type == "repost"`; their `stats` belong to someone else's post)
- posts by other authors removed
- duplicates removed (by `full_urn`)
- `posts.json` only: `posted_at.timestamp` inside the last 90 days, measured from `pulled_at`

Each item:

| Path | Notes |
|---|---|
| `posted_at.timestamp` | Milliseconds since epoch, UTC |
| `posted_at.date` | `"YYYY-MM-DD HH:MM:SS"` |
| `text` | Post body |
| `url` | Link to the post |
| `post_type` | `regular` or `quote` |
| `stats.total_reactions`, `stats.comments`, `stats.reposts` | Plus per reaction: `like`, `love`, `insight`, `celebrate`, `support`, `funny`, `curious` |
| `media.type`, `media.url`, `media.images[]` | Only on posts with media. `type` is `image` or `video` |
| `document` | Only on document (carousel) posts |
| `text_annotations` | Mentions and links inside the text, when present |
| `author.username`, `author.headline` | Always the founder |

An empty `posts.json` means no own posts in 90 days. That is a real finding.

## `stats.json`

Computed from the files above, so the teardown never does arithmetic. Ziad's, for shape:

```json
{
  "window_days": 90,
  "posts_in_window": 46,
  "posts_per_week": 3.6,
  "last_post_date": "2026-10-20 15:37:46",
  "days_since_last_post": 0,
  "avg_reactions": 18.4,
  "median_reactions": 10.5,
  "avg_comments": 3.8,
  "avg_reposts": 0.1,
  "avg_chars": 1074.1,
  "by_media": {"image": {"posts": 17, "avg_reactions": 30.1}, "text": {"posts": 28, "avg_reactions": 11.7}, "video": {"posts": 1, "avg_reactions": 9.0}},
  "posts_by_weekday_utc": {"Tuesday": 12, "Monday": 8, "Thursday": 8, "...": 0},
  "top_hashtags": {},
  "best_post": {"url": "...", "date": "...", "total_reactions": 0, "comments": 0, "reposts": 0, "media": "image", "chars": 0},
  "top_3_posts": ["same shape as best_post"],
  "own_posts_returned_all_time": 86,
  "oldest_own_post_date": "2024-10-15 18:01:08",
  "maybe_truncated": false
}
```

- Averages and best post use the 90 day window only. `null` means no posts in the window.
- `days_since_last_post` and `last_post_date` use all own posts, so they work for people who stopped posting. `null` means no own posts at all in what the actor returned.
- Best post ranks by `total_reactions`, then `comments`. Read its full text in `posts.json` by matching `url`.
- `maybe_truncated: true` means the actor hit its 100 post cap with every post inside the window, so counts undercount. Say so in the teardown.

## `company.json`

| Path | Notes |
|---|---|
| `basic_info.name`, `description`, `website`, `industries[]`, `specialties[]` | What the company says it does |
| `stats.employee_count`, `stats.employee_count_range.{start,end}`, `stats.follower_count` | Size. Sawa's target is 10 to 200 staff |
| `tagline`, `call_to_action.{text,url}` | Company page messaging |
| `media.logo_url`, `media.cover_url` | Local copies in `images/company-logo.*`, `images/company-cover.*` |
| `locations.headquarters`, `funding`, `similar_companies[]` | Context |

Missing when the profile has no `current_company_url`, or when the current company is a shared placeholder page ("Stealth Startup", "Self-employed" and similar). `pull-meta.json` → `company` says which.

## `website-colors.json`

```json
{
  "website": "https://...",
  "source": "profile creator_website",
  "theme_color_meta": null,
  "top_brand_colors": [{"hex": "#fe6e00", "count": 4}],
  "top_neutral_colors": [{"hex": "#ffffff", "count": 9}],
  "css_files_read": 2,
  "note": "..."
}
```

Colors are counted from the homepage and up to 5 same-site stylesheets, so a high count is a hint, not proof. Check against `images/company-logo.*`. Some sites block scripts (navy.mil did): then the lists are empty and `note` says why.

## `pull-meta.json`

```json
{
  "input_url": "https://www.linkedin.com/in/ziad-has/",
  "username": "ziad-has",
  "slug": "ziad-hassan",
  "pulled_at": "2026-10-20T...",
  "window_days": 90,
  "window_start": "2026-07-22T...",
  "actors": {"profile": "...", "posts": "...", "company": "..."},
  "posts": {"returned": 100, "reposts_dropped": 14, "not_author_dropped": 0,
            "duplicates_dropped": 0, "older_than_window": 40, "no_date_dropped": 0, "kept": 46},
  "posts_maybe_truncated": false,
  "company": "current company is the generic 'Stealth Startup' page, skipped",
  "images": {"headshot": "images/headshot.jpg", "banner": "images/banner.jpg", "company-logo": null},
  "website_fetched": "website.html",
  "fields": {"headline": "ok", "about": "ok", "banner": "ok", "website": "ok", "featured": "ok",
             "featured_with_image": 1, "follower_count": "ok", "is_creator": "false", "headshot": "ok",
             "skills": 10, "recommendations": 2, "experience": 7, "company": "missing",
             "company_website": "missing", "employee_count": null}
}
```

- `fields` values: `ok` (has a value), `empty` (present but blank), `missing` (key absent). Counts are plain numbers.
- **The actors drop keys for sections a profile does not have.** On a successful pull, `featured` and `creator_website` are simply absent when the profile has none (seen on 3 of 4 test profiles). So `empty` and `missing` both mean the profile lacks it: score both as **Fix**, and write the fact as "not found in the pulled profile". Only a failed pull (an `ERROR:` line, no folder) means the data itself is unknown.
- `images` values: a path under `raw/`, `null` (no URL on the profile), or `"download failed: ..."`.
