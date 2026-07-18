# 03 — File-aware Discovery Interview

**What to build:** A Client can conduct a resumable, one-question-at-a-time Discovery Interview grounded in current Project Material, while other devices observe or explicitly take over and structured source-linked discovery state remains authoritative.

**Blocked by:** 02 — Project Material to Context Pack.

**Status:** resolved

**Starting commit:** `3d7285bc4be00f64506d5ef5bcd8cbdd988c794d`

## Authorized public test seams

- Discovery Interview service commands/queries for planning, lease/takeover, answer/skip/pause/resume/finish/correct, late material, review, and completion.
- Planner, Interview Agent, staged retrieval tools, and read-only reviewer adapter contracts.
- Accessible Client and Freelancer interview views with reactive/polled operation states.

## Acceptance criteria

- [x] The versioned software-project Discovery Profile creates an evolving rubric-backed Interview Plan in English or German.
- [x] Start/resume—not page load—claims one Responding Device; heartbeat, warning, takeover, and current-question idempotency prevent duplicate answers.
- [x] Each accepted answer and pending operation persist before AI work; exactly one validated next question and structured delta commit atomically.
- [x] Turns link Context Pack Revisions and update Coverage Areas, source-linked Findings, unresolved topics, completion rationale, and operation metadata.
- [x] Skip, pause/resume, confirmed early finish, immutable Interview Corrections, and read-only Freelancer observation work.
- [x] Late Project Material blocks answering until terminal, adds a typed event, updates future reasoning, and never rewrites earlier turns.
- [x] Completion requires agent assessment, read-only reviewer clearance, final anything-else turn, and Client confirmation; 40 answers triggers review only.
- [x] Focused tests cover redundancy avoidance, bounded vague follow-up, contradictions, constraints, corrections, takeover, retry, and English/German safety.

## Answer

Implemented the complete local-first Discovery Interview tracer bullet: versioned EN/DE planning, one-device response leases and takeover, durable idempotent turn operations, schema-validated Agent/Reviewer repair, source-linked structured discovery state, Context Pack retrieval and bounded inspection, late-material events, corrections, completion clearance, and accessible Client/Freelancer UI states. Added matching Convex persistence shapes and deterministic local adapters.

Verification: 66 tests pass; typecheck, lint, and production build pass; `git diff --check` passes. Final Standards and Spec reviews against the starting commit are clean with no actionable findings.
