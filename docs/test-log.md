# Test log

Results of each cycle in `docs/test-plan.md`. Profiles are named by test ID only; pulled data stays in `out/` and never lands here.

## Cycle 1 (Oct 20)

Fresh agent per profile: `claude -p "/rebuild <url> [button]"`. Pulls reused where they existed.

### T0 (Ziad, `follow`)

Score 6 of 7. Headline is the only Fix. Run took about 6 minutes, no Apify credit (pull reused).

| Line | Result | Note |
|---|---|---|
| S1 check.py | Pass | 0 FAIL, 1 WARN: the hex color `#080808` read as a number |
| S2 facts trace | Pass | New headline built from About, banner and website. "MBA at HBS" shortens "MBA Candidate" |
| S3 diagnosis | Pass | `+` bullets counted after the rubric fix below |
| S4 specific | Pass | Quotes his headline, names Sawa |
| S5 template | Pass | Word for word |
| S6 voice | Pass | |
| S7 anti-AI | Pass | |
| S8 rewrite | Pass | 74 characters, 2 segments |
| S9 mockup draws | Pass | Every image loads, nothing cut off |
| S10 fixes visible | Weak | The new headline is there, but nothing points the eye to what changed |
| S11 report | Pass | Raised the headline question unprompted, explained the WARN |

Found before the run:

- The rubric didn't count `+` as a bullet, so Ziad's About would have failed. Added `+` (rubric rule 4: if Ziad fails, fix the rubric).
- `rebuild.json` had no way to say "this already passes". Added `"keep"`, and `check.py` now fails a keep on a check that scored Fix.

### T1 to T4

| ID | Score | check.py | Main problems found by reading |
|---|---|---|---|
| T1 | 1 of 7 | clean | Website set to an institution's site (not his). Featured filled with an award logo labelled "Post". About ends on a reaching-out line he never wrote |
| T2 | 1 of 7 | clean | Not a founder (intern), yet the rewrite wore the employer's brand. Featured was a made-up post on a stock photo. Email item 4 promised a post that doesn't exist |
| T3 | 1 of 7 | 1 WARN | Strongest of the four. Featured is a real post (from before the 90-day window). No website anywhere, handled as `null` |
| T4 | 3 of 7 | clean | Every fact traced (portfolio names and check sizes come from the saved company page and website). Email is specific and sendable |

All four emails kept the template, had no links and passed the anti-AI read. The rewrites (S8) and the mockup filler (S10) are where cycle 1 failed.

### Process problems

- **Agents edited shared scripts mid-run.** T3's agent changed `mockup.py`, `check.py` and `rebuild.md` to allow a `null` website. The change was right and is kept, but an agent must never change the repo during a run.
- **An agent spent Apify credit on its own** (T2 re-fetched a company page that had a 502 on the first pull).
- **Git Bash rewrote `/rebuild`** into a Windows path when passed to `claude -p`. Test runs now set `MSYS_NO_PATHCONV=1`.

### Root causes and fixes

| Problem | Root cause | Fix |
|---|---|---|
| Made-up featured posts | `rebuild.md` demanded a featured item with an image and fell back to a company cover with no real title | Real posts only: best in window, else their most-reacted post ever with an image, else `null` and an empty slot in the mockup. `check.py` fails a featured title that isn't in their own posts |
| Employer's website and brand on a non-founder | No notion of fit | Teardown opens with a Fit line (`check.py` requires it). Website and brand colors only from a company they founded or run |
| Invented "message me" lines | `rebuild.md` asked for "how to reach them" with no limit | Only a channel in the data, never a stated preference. (A check for this was tried and dropped: it fought the rubric's own "how to reach you" line) |
| Email promising what the mockup doesn't show | No rule linking the two | Email names only fixes the mockup shows |
| Agents editing the repo, spending credit | No rule against it | `rebuild.md`: write only inside the founder's folder, Apify only through `pull.py`. `allowed-tools` limits Write and Edit to `out/**` |
| Hex color read as a number | `check.py` | Hex colors ignored |
| Changes hard to spot | `mockup.py` | Changed sections get an "Updated" tag or a highlight |

Cycle 1 outputs are archived outside the repo; cycle 2 starts from the saved pulls only.

## Cycle 2 (Oct 20)

All five rerun by fresh agents from the saved pulls, with the cycle 1 fixes in place.

| ID | Score | Fit | check.py | Scorecard |
|---|---|---|---|---|
| T0 | 6 of 7 | Yes | 0 FAIL, 0 WARN | All pass |
| T1 | 1 of 7 | No (student, past Navy role) | 0 FAIL, 2 WARN (no website, nothing to feature) | All pass |
| T2 | 1 of 7 | No (intern) | 0 FAIL, 2 WARN (same) | All pass |
| T3 | 1 of 7 | Yes (founded her company in June 2026) | 0 FAIL, 1 WARN (no website) | All pass |
| T4 | 3 of 7 | Yes (co-founder of a 26-person firm) | 0 FAIL, 0 WARN | S4 and S6 weak: greeted by his LinkedIn first name, though his own post says nobody calls him that |

- **No agent touched a repo file.** Every shared file's timestamp predates the run.
- **No made-up content.** Every About bullet, headline and banner line was traced to `experience[]`, `education[]`, the About, the saved website or the company page. Featured is a real post (T3) or an honest empty slot (T1, T2).
- **Same scores as cycle 1** on all five, with the same Pass and Fix on every check: the consistency test in "done" holds so far.
- **Agents raised the right questions unprompted:** fit, the rubric's T0 headline conflict, T4's banner being a book promo, and T4's name.

Fix: the email greets people by the name they go by. `check.py` accepts the LinkedIn first name or a shorter form of it found in their posts or reposts, and `rebuild.md` says so.

Open for Ziad: T0's headline rule, whether a VC firm counts as a target, and whether T4's book banner should pass.

## Cycle 3 (Oct 20)

All five rerun by fresh agents. 0 FAIL on every profile, same expected WARNs, no repo file touched.

| ID | Checks 1 to 7 | Same as cycle 2? |
|---|---|---|
| T0 | P P P P P F P | Yes |
| T1 | P F F F F F F | Yes |
| T2 | P F F F F F F | Yes |
| T3 | P F F F F F F | Yes |
| T4 | P F **F** F P F F | **No**: the banner (check 3) passed in cycles 1 and 2 and failed here |

- T4 is now greeted "Hey Jeff". The name fix works.
- T3's email now names her featured post (a real one, outside the 90-day window); cycle 2 left it out. Both are allowed by the rules, so this is variety, not a fault.

Root cause of the T4 flip: the rubric said a banner passes if its text "says what the company does or who it helps". T4's banner is a promo for his book whose quotes say who the book helps. Two readings, both defensible. Fix: the rubric now says the text must be about their own company, and lists "a book, an event, a quote" under Fix. This is the builder's call on Ziad's rubric, flagged for him to overrule.

Cycle 4 reruns T4 twice in a row (consistency) and T0 (control).

## Cycle 4 (Oct 20)

T4 run twice in a row by fresh agents, T0 once as the control.

| Run | Checks 1 to 7 | Greeting | check.py |
|---|---|---|---|
| T0 | P P P P P F P | Hey Ziad | 0 FAIL, 0 WARN |
| T4, run A | P F F F P F F | Hey Jeff | 0 FAIL, 0 WARN |
| T4, run B | P F F F P F F | Hey Jeff | 0 FAIL, 0 WARN |

T4's banner now scores the same in every run (cycle 3, 4A and 4B). No agent touched a repo file (the only new files during the run were the demo app, written by the builder).

## Where "done" stands

1. check.py 0 FAIL on every profile, two cycles in a row: **met** (cycles 2 and 3 for T1 to T3, cycles 3 and 4 for T0 and T4).
2. Scorecard passes on every profile: **met**.
3. Same Pass and Fix across fresh runs: **met** (T0 and T1 to T3 across cycles 1 to 3, T4 across three runs after the banner fix).
4. Ziad would send one email without edits: **waiting on Ziad**.
