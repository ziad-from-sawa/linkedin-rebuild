# Scoring rubric

Step 2 (Score) reads this file and writes `teardown.md`. It turns Ziad's `profile-checklist.md` into exact Pass and Fix rules. Ziad's calls on the edge cases are in the decisions log at the end.

## At a glance

| # | Check | Pass when | Fix when |
|---|---|---|---|
| 1 | Headshot | One person's face, on a solid, studio or blurred background | No photo, not a headshot, or a sharp scene behind them |
| 2 | Website link | `creator_website` has a URL that isn't LinkedIn | Empty, missing, or a LinkedIn URL |
| 3 | Banner | Custom image with readable text saying what the company does | Empty, default, no message, or text too small to read |
| 4 | About | 2 or more bullet lines, anywhere | Empty, or fewer than 2 bullet lines |
| 5 | Featured | 1 or more featured items with an image | None, none with an image, or not found |
| 6 | Headline | 80 characters or fewer, 2 segments or fewer, says what the company does | Too long, too many segments, title and company only, buzzwords |
| 7 | Main button | Follow | Connect, or can't confirm Follow |

## Four rules for every check

1. **Pass or Fix.** Nothing in between.
2. **Cite the fact.** Name the field and what it holds, or what you saw in a saved file.
3. **Missing means Fix.** The pull drops the key when a profile lacks a section, so a missing field means they don't have it. Write "not found in the pulled profile" and score it **Fix**. Never guess a Pass.
4. **Ziad scores 7 of 7.** Run his profile first: `/rebuild https://www.linkedin.com/in/ziad-has/ follow`. If he fails a check, the rubric is wrong. Fix the rubric, not his score.

## How each line looks in `teardown.md`

```
<#> · <Check> · <Pass|Fix> · <fact>. <fix line, only if Fix>
```

```
3 · Banner · Fix · `background_picture_url` is empty. Add a banner that says what Acme does, in its own colors.
```

End with `Score: <n> of 7 pass`.

---

## 1. Headshot

**Look at:** `basic_info.profile_picture_url`. The pull saves it as `raw/images/headshot.*`. Open that file and look.

**Pass** when all of these hold:
- One person, face clearly visible, head and shoulders filling most of the frame
- The background is a solid color, a plain studio backdrop, or blurred (portrait mode)

**Fix** if any of these is true:
- No photo, or LinkedIn's grey silhouette
- A logo, illustration, group shot or cropped event photo
- The face is small, far away or turned away
- A sharp, in-focus scene behind them: office, outdoors, stage, other people

**Cite:** what the background is. *"Background is a blurred office."*

**Fix line:** "Swap the photo for a head and shoulders shot on a solid <brand color> background."

**Pass note:** if it passes but the background isn't a solid brand color, add: "A solid <brand color> background would tie the photo to the brand."

## 2. Website link

**Look at:** `creator_website`, the link under the name. The Contact info website doesn't count.

**Pass** when:
- `creator_website` holds a URL to their company, their own site, or a link page such as Linktree

**Fix** if any of these is true:
- `creator_website` is empty or missing
- The URL goes back to LinkedIn

**Cite:** the URL, or "empty".

**Fix line:** "Add <company domain> as the link under your name."

## 3. Banner

**Look at:** `basic_info.background_picture_url`. The pull saves it as `raw/images/banner.*`. Open that file and look.

**Pass** when all of these hold:
- It's a custom image
- It has text you can read at normal size
- The text says what their own company does or who it helps (for a Fit No, what they themselves do)

**Fix** if any of these is true:
- Empty or missing
- LinkedIn's default blue and grey banner
- A custom image with no message: skyline, stock photo, pattern, event photo
- Text too small to read
- Text about something else: a book, an event, a quote, a slogan that never says what the company does

**Cite:** what the banner shows. *"`background_picture_url` is a city skyline with no text."*

**Fix line:** "Add a banner that says what <company> does, in its own colors."

## 4. About

**Look at:** `about`. Count the characters and the bullet lines. A bullet line starts with `•`, `-`, `*`, `+`, `·`, an emoji, or a number followed by `.` or `)`.

**Pass** when:
- `about` has 2 or more bullet lines, anywhere in the text

**Fix** if any of these is true:
- `about` is empty or missing
- Fewer than 2 bullet lines (paragraphs only)

**Cite:** both counts. *"`about` is 1,840 characters, 0 bullet lines."*

**Fix line:** "Rewrite About as 3 to 5 bullets: what you do, who for, one proof point, how to reach you."

## 5. Featured

**Look at:** `featured[]` and each item's `image_url`. Images are saved as `raw/images/featured-N.*`.

**Pass** when:
- At least 1 featured item has a non-empty `image_url`

**Fix** if any of these is true:
- `featured` is empty
- No featured item has an image
- `featured` isn't in the JSON ("not found in the pulled profile")

**Cite:** *"`featured` has 2 items, 0 with an image."*

**Fix line:** "Pin your best post (<its first few words>) to Featured, with an image." Use the best post from the posting stats.

## 6. Headline

**Look at:** `headline`. Count the characters and the segments. Segments are split by `|`, `•`, `·`, `/` or ` - `.

**Pass** when all of these hold:
- 80 characters or fewer
- 2 segments or fewer
- Says what the company does or who they help, in plain words

**Fix** if any of these is true:
- Over 80 characters
- 3 or more segments
- Only a title and company name, such as "CEO at Acme"
- Uses a banned word from `anti-ai-rules.md` (leverage, scalable, ecosystem and the rest)
- Strings of emoji or hashtags

**Cite:** both counts. *"`headline` is 172 characters, 5 segments."*

**Fix line:** "Cut the headline to one line: <role> at <company>, <what it does> for <who>."

## 7. Main button

**Look at:** the word Ziad passes to `/rebuild` after the URL, `follow` or `connect`, which he reads off the live page. The JSON can't answer this: `is_creator` is `false` on Ziad's own profile, which shows Follow.

**Pass** when:
- Ziad passed `follow`

**Fix** if any of these is true:
- Ziad passed `connect`
- Ziad passed nothing. Write "not confirmed on the live page". This Fix never goes in the email.

**Cite:** *"Ziad saw Connect on the live page."* or *"Not confirmed on the live page."*

**Fix line:** "In Settings, set your main profile button to Follow."

---

## Posting stats

**Look at:** `raw/stats.json`. The pull already did the counting, so copy its numbers and don't recompute. Fields are in `docs/pull-output.md`. Reposts are already removed, and `raw/pull-meta.json` says how many (`posts.reposts_dropped`).

**Window:** the 90 days up to and including the pull date. Put the pull date at the top of the teardown.

**Only original posts count.** Leave out every repost, including reposts where they added their own text. Report how many were left out.

| Stat | How to work it out | If there are no posts |
|---|---|---|
| Posts in the last 90 days | Count original posts in the window | `0` |
| Days since the last post | Pull date minus their latest original post, in whole days. Search the full pull, not only the window | "not found" |
| Average reactions per post | Total reactions ÷ posts in the window, rounded to a whole number | "n/a (0 posts)" |
| Average comments per post | Same, for comments | "n/a (0 posts)" |
| Best post | Most reactions + comments in the window. On a tie, the more recent post | "n/a (0 posts)" |

**Why the best post worked:** stick to facts you can see. Compare it with their average and their other posts on format, length, first line and topic. Don't guess about the algorithm, timing or how readers felt.

> 312 reactions, 4.1x their average. The only post in the window with an image. Opens with a number.

**Quotes:** quote at most the first line of their best post.

---

## Done when

- [ ] 7 lines in order, each Pass or Fix, each with a fact
- [ ] Every Fix has its fix line
- [ ] Every number matches the JSON (open the file and check)
- [ ] Missing fields say "not found"
- [ ] Posting stats show the pull date
- [ ] No em dashes or en dashes (search for U+2014 and U+2013)
- [ ] Ziad's profile scores 7 of 7

## Decisions log (Ziad, Oct 20)

- Banner with no message: Fix
- Headline: 80 characters and 2 segments; title and company only is a Fix
- Headshot with a blurred background: Pass (a solid brand color is the ideal)
- Linktree as the website link: Pass
- Missing data: Fix, checked by hand on the live page
- About: any bullets pass, wherever they are
- Reposts: never counted, for the post count or the best post

Field names are confirmed against Dan's pulls of 4 profiles on Oct 20 (`docs/pull-output.md`).
