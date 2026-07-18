# 05 — Integration, Review, and Hardening

Status: in-progress
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
- [ ] `bun run verify` and `git diff --check` pass.
- [x] Rendered desktop/mobile inspection passes for all changed views.
- [ ] Standards and Spec review findings are fixed or explicitly reported.
- [ ] The final implementation is committed.
