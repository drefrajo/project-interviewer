# 03 — File-aware Discovery Interview

**What to build:** A Client can conduct a resumable, one-question-at-a-time Discovery Interview grounded in current Project Material, while other devices observe or explicitly take over and structured source-linked discovery state remains authoritative.

**Blocked by:** 02 — Project Material to Context Pack.

**Status:** ready-for-agent

## Authorized public test seams

- Discovery Interview service commands/queries for planning, lease/takeover, answer/skip/pause/resume/finish/correct, late material, review, and completion.
- Planner, Interview Agent, staged retrieval tools, and read-only reviewer adapter contracts.
- Accessible Client and Freelancer interview views with reactive/polled operation states.

## Acceptance criteria

- [ ] The versioned software-project Discovery Profile creates an evolving rubric-backed Interview Plan in English or German.
- [ ] Start/resume—not page load—claims one Responding Device; heartbeat, warning, takeover, and current-question idempotency prevent duplicate answers.
- [ ] Each accepted answer and pending operation persist before AI work; exactly one validated next question and structured delta commit atomically.
- [ ] Turns link Context Pack Revisions and update Coverage Areas, source-linked Findings, unresolved topics, completion rationale, and operation metadata.
- [ ] Skip, pause/resume, confirmed early finish, immutable Interview Corrections, and read-only Freelancer observation work.
- [ ] Late Project Material blocks answering until terminal, adds a typed event, updates future reasoning, and never rewrites earlier turns.
- [ ] Completion requires agent assessment, read-only reviewer clearance, final anything-else turn, and Client confirmation; 40 answers triggers review only.
- [ ] Focused tests cover redundancy avoidance, bounded vague follow-up, contradictions, constraints, corrections, takeover, retry, and English/German safety.

