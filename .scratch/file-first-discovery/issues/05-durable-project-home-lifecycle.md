# 05 — Durable Project Home lifecycle

**What to build:** The approved Project Room remains a useful Project Home where both parties see the current and prior approved Review Versions and live Shared Resources, while the Freelancer can manage room lifecycle safely.

**Blocked by:** 04 — Traceable Project Brief review.

**Status:** resolved

**Starting commit:** `48f958951797b8935b73216ee6d3690009bb4193`

## Authorized public test seams

- Project Home service operations for Shared Resources, archive/restore, soft delete/recover, hard-delete scheduling, and discovery reopening.
- Phase-aware Workspace/Home queries that compute last activity and next required action.
- Accessible lifecycle and Shared Resource UI for both actor types.

## Acceptance criteria

- [x] Freelancer-only Shared Resource CRUD/reordering is immediately Client-visible and rejects credentials/secrets while allowing label, URL, note, and optional account identifier.
- [x] Phase-aware Home and Workspace show correct next actions, approved-version history, archive/restore, search/filter, and Recently Deleted.
- [x] Archive retains room content and active Invite Link but makes the Client home read-only.
- [x] Delete immediately revokes access/cancels work, permits Freelancer restore for configurable seven days, then cascades every room-rooted record and storage object.
- [x] Reopening discovery preserves history, continues the plan, invalidates unapproved review state, and audits the transition.
- [x] Focused tests prove resource authorization, secret rejection, phase transitions, retention, restore, and cascading room isolation.

## Verification

- `bun run test` — 102 tests passed.
- `bun run typecheck` — passed.
- `bun run lint` — passed.
- `bun run build` — passed.
- Standards review against the starting commit — clean.
- Spec review against the starting commit — clean.
