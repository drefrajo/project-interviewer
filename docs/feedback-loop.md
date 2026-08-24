# Feedback loop

How Interview collects quality signals on its AI outputs and turns them into
Interview Policy and template improvements.

## What is collected

| Signal | Source | Notes |
| --- | --- | --- |
| Document 👍/👎 | Creator, on the Interview detail page | Target `project_document`; one rating per target, replaceable |
| Submission 👍/👎 plus optional note | Creator, post-submission "Two quick questions" card | Target `project_submission` |
| Requested changes text | Client free text at Document Review | Persisted in `documentRevisions`; survives the transient operation |
| Built-in template origin | Recorded at Interview creation | `interviews.builtInTemplateKey` |
| Funnel behavior | Existing fields | Revision counts, concept regeneration (`additionalConceptsUsed`), inspiration-link fallbacks, submission state |

All rows are deleted together with the Interview by the standard deletion and
retention flows. Ratings and notes live in `interviewFeedback`, requested
changes in `documentRevisions`.

## Prompt attribution

`PROMPT_VERSION` in `convex/lib/interview_prompts.ts` identifies the current
Interview Policy generation. It is stamped on Interviews at creation and
refreshed whenever an AI output is written. **Bump it in the same commit as any
prompt text change**; without a bump, before/after comparisons are meaningless.
Rows without a version are reported as `legacy`.

## Reading the data

```sh
bunx convex run stats:aggregateStats
```

Returns totals plus cohorts by prompt version and built-in template key:
interview counts, submitted counts, revision-request sums, and thumbs per
target. Drill into individual complaints via the `documentRevisions` and
`interviewFeedback` tables in the Convex dashboard, or a deployment data
export.

## Improvement loop

1. Run `stats:aggregateStats` and note the baseline cohort.
2. Change exactly one prompt surface or template instruction set.
3. Bump `PROMPT_VERSION`.
4. After enough traffic, compare cohorts on document thumbs-down,
   revision requests per interview, and inspiration-link fallbacks.

## Consent boundaries

- Aggregate ratings and funnel metrics are product analytics and require no
  extra consent beyond the privacy policy.
- Analyzing Creator-authored text (templates, Interview Instructions) requires
  the Creator's explicit, revocable opt-in (`contentAnalysisOptIn`, offered
  during onboarding and in Settings).
- Client answers are never analyzed. Requested-changes texts are
  Client-authored; they are persisted for quality work but must be treated
  accordingly when read.
