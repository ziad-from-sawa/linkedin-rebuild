# Test and improvement plan for /rebuild

The goal, in Ziad's words: give it a LinkedIn profile, get back an email with the list of improvements and a before and after of the profile. Anything in the repo can change if it gets us closer to that. This plan says how we find out what is wrong, how we fix it, and when we stop.

Results go in `docs/test-log.md`, one section per cycle.

## What "done" means

All of these, on every test profile, two cycles in a row:

1. `scripts/check.py` reports 0 FAIL.
2. Every line of the scorecard below passes.
3. The same profile run twice by fresh agents gives the same Pass and Fix on all 7 checks, and emails of the same quality.
4. Ziad reads the email for one founder and would send it without edits. His marked-up version, if he edits, becomes the bar for the next cycle (the brief's rule).

## Test profiles

| ID | Who | Why it is in the set | Button word |
|---|---|---|---|
| T0 | Ziad, `linkedin.com/in/ziad-has` | The model profile. The control: it should score 7 of 7 | `follow` |
| T1 | Dan, from `inputs/test-urls.md` | A real profile with gaps | none (tests the unconfirmed path) |
| T2 | Charlotte, from `inputs/test-urls.md` | Same | none |
| T3 | Yuri, from `inputs/test-urls.md` | Same | none |
| T4 | Professor Jeff Bussgang | The demo case Ziad asked for | none |

Swap T1 to T3 for real B2B founders once Ziad adds them. T4's URL gets confirmed by the pulled name before any writing.

Between them these cover: a stealth company page (T0), missing banners and featured posts, people who post rarely, and someone with a large audience (T4).

## How a run is done

Two modes, used for different jobs:

- **Fresh agent (the real test).** From the repo folder: `claude -p "/rebuild <url> [follow|connect]"`. A new agent reads only the repo, exactly like a teammate's run. This tests `rebuild.md` itself. Every official cycle uses this.
- **In the loop (for fixing).** The builder runs single steps by hand (`scripts/mockup.py`, `scripts/check.py`) to try a fix quickly. Never counts as a result.

Pulls are reused: a second run on the same person reads the saved `out/<slug>/raw/` and spends no Apify credit.

## The scorecard

Each line is Pass or Fail per profile. The judge (the builder, then Ziad) fills it in after reading every output file and the raw data behind it.

| # | Line | How to judge it |
|---|---|---|
| S1 | check.py clean | 0 FAIL. Every WARN read and either fixed or explained |
| S2 | Facts trace | Every fact in `email.md`, `teardown.md` and `rebuild.json` is found in `raw/`. Check each claim, not only the numbers |
| S3 | Diagnosis right | Each Pass and Fix matches what the data and the images show. A wrong Fix in the email fails the run outright: it tells a founder something false about their own profile |
| S4 | Specific | Each improvement in the email names something only this founder has (their company, their words, their numbers) |
| S5 | Ziad's template | The email is `context/email-template.md` word for word around the slots |
| S6 | Ziad's voice | Reads like Ziad (`context/ziad-voice.md`) |
| S7 | Anti-AI rules | A full read against all 30 rules in `context/anti-ai-rules.md`, not just the ones the script tests |
| S8 | Rewrite quality | The new headline, About and banner are in the founder's voice, invent nothing, and a founder would accept them as their own |
| S9 | Mockup draws right | Nothing cut off, every image loads, banner text readable, looks like LinkedIn |
| S10 | Mockup shows the fixes | Every Fix that can be shown is visible on the After side, and every Pass looks the same as today |
| S11 | Report | The agent's final message has the folder, the score, the email in full, the attachment path and anything to confirm |

## The cycle

1. **Run** every test profile with a fresh agent.
2. **Check**: `python scripts/check.py out/<slug>` on each folder.
3. **Judge**: fill in the scorecard for each profile.
4. **Log**: for every failed line, write in `docs/test-log.md` what went wrong, the root cause (which file made it happen) and the fix.
5. **Fix**: one change per root cause, in the file that caused it. Prefer tightening an instruction or a script over adding a new step. Add a test to `scripts/check.py` whenever a failure can be caught by code, so it never comes back silently.
6. **Rerun** the failed profiles, plus T0 every cycle, so a fix for one person can't break the control.
7. **Repeat** until "done" holds two cycles in a row. Then run one profile twice to test consistency, and hand one email to Ziad.

## Limits

- **Apify:** about $0.52 per new founder at most, on Dan's account. Five founders is about $2.60. Reruns cost nothing.
- **Cycles:** at most 4 before stopping to talk to Ziad. If the same line keeps failing after 2 fixes, the plan is wrong, not the fix.
- **Never:** send anything, post anything, commit anything in `out/`, or paste pulled data into the team thread.

## Questions only Ziad can answer

Collected here as they come up. They never block other fixes.

1. Your headline, "MBA Candidate at Harvard Business School", is a title and an organization only. Your Oct 20 decision says that is a Fix, and the rubric says you must score 7 of 7. Which rule wins?
