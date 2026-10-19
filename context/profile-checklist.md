# What a good founder profile has

Ziad's checklist. His own profile is the model: https://www.linkedin.com/in/ziad-has/

| # | Check | Where to look in the Apify profile data |
|---|---|---|
| 1 | Headshot on a solid color background | `profile_picture_url` (open the image and look) |
| 2 | Website link under the name | `creator_website` |
| 3 | A banner | `background_picture_url` (empty or LinkedIn default = fail) |
| 4 | About section filled out, in bullets | `about` |
| 5 | At least one featured post with an image | `featured[]`, check `image_url` |
| 6 | Short, clear headline | `headline` |
| 7 | Follow button instead of Connect | `is_creator` may show it. Confirm on the live page. |

## Posting stats (from the posts data)

- Posts in the last 90 days
- Days since the last post
- Average reactions and comments per post
- Their best post in the window, and why it worked

## Rules

- Every number in the teardown comes from the saved JSON. If a field is missing, say "not found". Never guess.
- Score each check as **Pass** or **Fix**, with the fact behind it.
