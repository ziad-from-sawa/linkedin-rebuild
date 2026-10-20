# The outreach email

Ziad's own template, from his note to the team (Oct 19). Every `/rebuild` email uses it. Fill in the slots, change nothing else.

```
Subject: <First name>, a few ideas for your LinkedIn

Hey <First name>,

I randomly stumbled upon your profile on LinkedIn and noticed a few things that could be improved. I'm not sure if growing on LinkedIn is a priority, but if we were to work together, here is what I would do specifically for you:

1. <improvement>
2. <improvement>
3. <improvement>

I even went ahead and built you a mockup of these changes. I attached it to this email, let me know what you think.

Ziad
```

## The improvements

- **1 to 4 of them**, picked from the teardown's Fix lines. Most visible first: banner, headline, headshot, About, Featured, website, button.
- **Only confirmed fixes.** A check scored Fix because it could not be confirmed (the button, when Ziad didn't check it) never goes in the email.
- **Each one is one or two short sentences**: what is there now, as a fact from their profile, then what Ziad would change. *"Your headline runs 172 characters across 5 parts. I'd cut it to one line on what Acme does for finance teams."*
- **Specific to them.** Name their company, their words, their numbers. A line that would fit any founder gets rewritten.
- **Every number** comes from the pulled data. `scripts/check.py` fails any it can't trace.

## Rules

- Ziad's voice (`ziad-voice.md`) and every anti-AI rule (`anti-ai-rules.md`). No em dashes or en dashes.
- No links anywhere, including a bare domain like `acme.com` (email apps turn it into a link).
- The attachment is `mockup.png`. Ziad attaches it himself and sends from his own inbox.
- If every check passes, write `No email. <Name> passes all 7 checks.` instead.

## Ziad's original wording

> Hey Ziad, I randomly stumbled upon your profile on LinkedIn and noticed a few things that could be improved. I'm not sure if growing on LinkedIn is a priority, but if we were to work together here are a few things I would do specifically for you:
>
> [List the custom improvements]
>
> I even went ahead and built you a mockup of these changes. I attached them to this email, let me know what you think:
>
> [Attach custom assets]

The working version above changes two phrases: "here is what I would do" (the anti-AI rules allow one "things" per email) and "attached it" (one picture).
