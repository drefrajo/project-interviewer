# 02 — Conversational Discovery Interview

Status: resolved
Starting commit: `cda1d94e6e87f20bce7951c9fd2ee1386304b82f`

## What to build

Turn the visible Discovery Interview into a chronological chat while preserving
the structured Interview Plan, durable operation, evidence, correction,
completion-review, and Responding Device behavior.

## Acceptance criteria

- [x] Questions, answers, corrections, current processing, and the composer form
      one readable chronological transcript.
- [x] Accepted answers remain visible while the next question is generated.
- [x] Client-facing flow does not lead with Coverage Areas, Findings, or system
      internals; Freelancer may inspect them in a secondary disclosure.
- [x] Prompt policy explicitly requires natural conversational transitions and
      forbids questionnaire/category narration.
- [x] Existing pause/skip/retry/finish/takeover/correction capabilities remain
      accessible.
- [x] Focused prompt and React tests cover conversational behavior.

## Verification

- `bun run test -- src/app/discovery-interview-panel.test.tsx src/infrastructure/ai-role-prompts.test.ts`
  — 2 files, 8 tests passed.
- `bunx eslint src/app/discovery-interview-panel.tsx src/app/discovery-interview-panel.test.tsx src/infrastructure/ai-role-prompts.ts src/infrastructure/ai-role-prompts.test.ts --max-warnings 0`
  — passed.
- `git diff --check -- src/app/discovery-interview-panel.tsx src/app/discovery-interview-panel.test.tsx src/infrastructure/ai-role-prompts.ts src/infrastructure/ai-role-prompts.test.ts`
  — passed.
- Final integration typecheck and the complete test suite pass.
