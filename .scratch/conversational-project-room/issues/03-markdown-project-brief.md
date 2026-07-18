# 03 — Markdown Project Brief Review

Status: resolved
Starting commit: `cda1d94e6e87f20bce7951c9fd2ee1386304b82f`

## What to build

Expose the Project Brief as one Markdown document for Freelancer editing and
Client review while keeping structured provenance, validation warnings, and
Requirement state behind the module interface.

## Acceptance criteria

- [x] Freelancer can copy, replace, validate, and save one Markdown Brief Draft.
- [x] Markdown round-trips through the structured implementation without losing
      unedited evidence and Requirement state.
- [x] Invalid or structurally ambiguous Markdown fails with actionable feedback
      before a Review Version can be sent.
- [x] Client sees a neatly rendered immutable Review Version followed by Approve
      and one Change Request field.
- [x] Change Request acknowledgement and revision history remain immutable.
- [x] Hosted/Convex adapters expose the same document interface as the domain
      coordinator, with focused round-trip and lifecycle tests.

## Answer

Implemented a stable-comment Markdown projection for Project Brief Drafts.
Editing preserves unchanged item evidence, findings, and Requirement state,
records Freelancer provenance for changed material, and reports malformed or
ambiguous structure before it can reach review. Draft and immutable Review
Version documents now flow through Convex and the hosted adapter; the UI offers
one Markdown editor with copy, preview, validation, warning resolution, and
send controls, plus a safe immutable Client render with Approve and one Change
Request field. Readable evidence citations remain available through Markdown
export while the editable document stays clean and stable.

Focused verification: `bunx vitest run src/domain/project-brief-markdown.test.ts src/domain/project-brief.test.ts src/production/hosted-application.test.ts src/production/hosted-dto-schemas.test.ts` (23 passing).
