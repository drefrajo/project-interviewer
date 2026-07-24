# Launch readiness

## Machine gate

Run:

```sh
bun run verify
```

The gate contains only tests that protect a user-visible flow, an authorization/privacy boundary, or irreversible data behavior:

- one deterministic browser flow from Creator Interview creation through Client Project Submission and Creator download;
- focused Convex checks for Creator ownership, regenerated Interview Links, first-write-wins submission, and cascading deletion;
- one provider-request contract check for pinned model settings, OpenRouter privacy requirements, and the minimal Cloudflare Email payload;
- the production build with a strict Content Security Policy that never uses `unsafe-inline`; and
- one integrated accessibility pass over the main Client flow at desktop and mobile widths.

Do not add lower-level tests that duplicate these behaviors.

## Provider and language evaluation

Before launch, run one representative website Interview in each supported pairing:

- English with GPT-5.6 Terra;
- German with GPT-5.6 Terra;
- English with DeepSeek V4 Flash; and
- German with DeepSeek V4 Flash.

Review whether each Interview reaches a useful Project Document efficiently, preserves supplied facts, marks unknown facts, writes credible first-draft copy, and generates three meaningfully different Visual Concepts. This is an opt-in launch evaluation rather than a broad deterministic test matrix.

## Security and privacy gate

Confirm in the configured production environment that:

- Creator registration is allowlisted;
- Google and GitHub sign-in work independently and matching emails cannot link or duplicate accounts;
- Interview Links are unguessable, regeneration invalidates the prior link, and Client pages are not indexed;
- every OpenRouter request requires zero data retention, denies data collection, and disables fallback;
- no raw prompt, provider response, sensitive content, or Interview Link appears in diagnostic logs;
- the global OpenRouter spend ceiling and per-Interview-Link rate limits are active;
- Markdown disables raw HTML and accepts only safe HTTP(S) links;
- the Content Security Policy has exact origins where possible and contains no `unsafe-inline`; and
- confirmed Interview deletion removes the transcript, Project Document, Visual Concepts, Project Submission, and link capability.

## Operational gate

Confirm that:

- temporary AI and image failures retry twice and then expose a retry action;
- successful Visual Concepts survive retry of a failed concept;
- email delivery failure never blocks Project Submission;
- an ambiguous email timeout is reported as delivery unknown rather than retried blindly;
- the Creator can download a complete ZIP and each individual artifact; and
- the submitted Client page is read-only and shows the Creator's business/display name and verified email.

## Human approval

The product is ready to open beyond the allowlist only after a representative Creator and Client complete the full flow on mobile and desktop, understand that Visual Concepts are rough directions rather than final designs, and judge the Project Submission sufficient to begin implementation.
