# 02 — Project Material to Context Pack

**What to build:** Either party can add supported Project Material, see honest processing and failure states, safely handle suspected secrets, inspect shallow source-linked File Analysis, correct it additively, and reach an immutable Context Pack Revision or explicitly continue without files.

**Blocked by:** 01 — Foundation and shared Project Room.

**Status:** resolved

**Starting commit:** `6299f331ba8e0405724ad040b25514afdc6dae49`

## Authorized public test seams

- Project Material service operations from authorized upload through terminal analysis, retry/removal, feedback, and no-file continuation.
- Parser, secret scanner, AI analyzer, embedding, and retrieval adapter contracts at their system boundaries.
- Accessible Project Material UI using user-selected files and observable workflow states.

## Acceptance criteria

- [x] Supported formats and configurable count/size/room limits are validated by extension, content type, and signature where available.
- [x] Text/document parsers preserve page, slide, sheet/cell, image, paragraph, or range locators; extraction failure never injects raw content.
- [x] Suspected text secrets are masked by default, visible safely, and may be explicitly/auditably included after disclosure.
- [x] Durable idempotent processing records real stages and ends in `analyzed`, `unsupported`, or `failed`, with retry/remove/continue paths.
- [x] File Analysis remains shallow, versioned, source-linked, multilingual, and correctable through additive Analysis Feedback.
- [x] Active source chunks support room-scoped full-text and multilingual semantic retrieval without exposing raw storage URLs.
- [x] Every material/feedback/removal change creates an immutable Context Pack Revision and retains historical availability semantics.
- [x] English/German representative files, prompt-injection material, suspected secrets, failures, and no-file paths have focused tests.

## Answer

Delivered the complete local Project Material pipeline and its production data model. Both room roles can upload supported files, observe real processing stages, inspect source-linked analysis, safely override suspected-secret masking, add source-specific feedback, retry or remove files, and deliberately proceed without files. Processing is bounded, idempotent, resumable after interruption, safe under concurrent processing/removal, and produces immutable Context Pack revisions with historical availability.

Verification:

- `bun run test` — 36 passed
- `bun run typecheck` — passed
- `bun run lint` — passed
- `bun run build` — passed
- `$code-review` Standards — no actionable findings
- `$code-review` Spec — no actionable findings
