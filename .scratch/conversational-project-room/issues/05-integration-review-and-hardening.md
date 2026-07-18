# 05 — Integration, Review, and Hardening

Status: resolved
Starting commit: `cda1d94e6e87f20bce7951c9fd2ee1386304b82f`

Blocked by: 01, 02, 03, 04

## What to build

Integrate the four slices, remove obsolete authored CSS/interfaces/tests, run
the complete verification suite, inspect rendered desktop/mobile states, and
perform Standards and Spec review against the feature specification.

## Acceptance criteria

- [x] No stale anchor navigation, browser application mode, or structured
      multi-form Brief editor remains in the public UI.
- [x] Auth, invite, file, interview, Brief, resource, archive, and deletion
      flows still pass their focused tests.
- [x] `bun run verify` and `git diff --check` pass.
- [x] Rendered desktop/mobile inspection passes for all changed views.
- [x] Standards and Spec review findings are fixed or explicitly reported.
- [x] The final implementation is committed.

## Review outcome

- Standards review found one tracker-status violation and two duplicated Convex
  Brief persistence shapes. The status now uses the tracker vocabulary, and
  the persistence/draft-from-review invariants are centralized in helpers.
- Spec review found incorrect next-actor guidance in material-waiting and
  Change Request states, a source-free Markdown copy action, and missing
  non-contract approval copy. All three findings are fixed with focused tests.
- Rendered inspection covered the desktop Overview, chronological Client chat,
  desktop Review Version, and 390×844 Client Overview/Review Version. It caught
  and fixed visible Markdown identity comments and a narrow-screen grid
  overflow before final verification.

## Verification

- `bun run verify` — 170 tests, 15 evaluation fixtures, all gates passed.
- `git diff --check`
- Production environment validation with non-secret placeholder Convex URLs.
