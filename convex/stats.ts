import { internalQuery } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";

// Operator-facing quality aggregates over the feedback loop data. Run with
// `bunx convex run stats:aggregateStats` against a deployment; it is internal
// and never exposed to Creators or Clients.

type Rating = "up" | "down";

type Cohort = {
  interviews: number;
  submitted: number;
  revisionRequests: number;
  documentThumbsUp: number;
  documentThumbsDown: number;
  submissionThumbsUp: number;
  submissionThumbsDown: number;
};

const emptyCohort = (): Cohort => ({
  interviews: 0,
  submitted: 0,
  revisionRequests: 0,
  documentThumbsUp: 0,
  documentThumbsDown: 0,
  submissionThumbsUp: 0,
  submissionThumbsDown: 0,
});

const cohortStats = {
  interviews: v.number(),
  submitted: v.number(),
  revisionRequests: v.number(),
  documentThumbsUp: v.number(),
  documentThumbsDown: v.number(),
  submissionThumbsUp: v.number(),
  submissionThumbsDown: v.number(),
};

export const aggregateStats = internalQuery({
  args: {},
  returns: v.object({
    totals: v.object({
      ...cohortStats,
      startedInterviews: v.number(),
      conceptRegenerations: v.number(),
      inspirationDirections: v.number(),
    }),
    byPromptVersion: v.record(v.string(), v.object(cohortStats)),
    byBuiltInTemplateKey: v.record(v.string(), v.object(cohortStats)),
  }),
  handler: async (ctx) => {
    const documentRating = new Map<Id<"interviews">, Rating>();
    const submissionRating = new Map<Id<"interviews">, Rating>();
    for await (const entry of ctx.db.query("interviewFeedback")) {
      const target =
        entry.target === "project_document" ? documentRating : submissionRating;
      target.set(entry.interviewId, entry.rating);
    }

    const byPromptVersion = new Map<string, Cohort>();
    const byTemplate = new Map<string, Cohort>();
    const totals = emptyCohort();
    let startedInterviews = 0;
    let conceptRegenerations = 0;
    let inspirationDirections = 0;

    const apply = (
      cohorts: Map<string, Cohort>,
      key: string,
      interview: Doc<"interviews">,
    ) => {
      const cohort = cohorts.get(key) ?? emptyCohort();
      cohort.interviews += 1;
      if (interview.submission) cohort.submitted += 1;
      cohort.revisionRequests += interview.documentRevisionCount;
      const document = documentRating.get(interview._id);
      if (document === "up") cohort.documentThumbsUp += 1;
      if (document === "down") cohort.documentThumbsDown += 1;
      const submission = submissionRating.get(interview._id);
      if (submission === "up") cohort.submissionThumbsUp += 1;
      if (submission === "down") cohort.submissionThumbsDown += 1;
      cohorts.set(key, cohort);
    };

    for await (const interview of ctx.db.query("interviews")) {
      apply(
        byPromptVersion,
        interview.promptVersion === undefined
          ? "legacy"
          : String(interview.promptVersion),
        interview,
      );
      if (interview.builtInTemplateKey) {
        apply(byTemplate, interview.builtInTemplateKey, interview);
      }
      totals.interviews += 1;
      if (interview.submission) totals.submitted += 1;
      totals.revisionRequests += interview.documentRevisionCount;
      if (interview.startedAt !== undefined || interview.clientMessageCount > 0) {
        startedInterviews += 1;
      }
      if (interview.additionalConceptsUsed) conceptRegenerations += 1;
      if (interview.visualDirection?.kind === "inspiration_links") {
        inspirationDirections += 1;
      }
    }
    // Every Interview belongs to exactly one prompt-version cohort, so the
    // global rating tallies are the sums across cohorts.
    for (const cohort of byPromptVersion.values()) {
      totals.documentThumbsUp += cohort.documentThumbsUp;
      totals.documentThumbsDown += cohort.documentThumbsDown;
      totals.submissionThumbsUp += cohort.submissionThumbsUp;
      totals.submissionThumbsDown += cohort.submissionThumbsDown;
    }
    return {
      totals: {
        ...totals,
        startedInterviews,
        conceptRegenerations,
        inspirationDirections,
      },
      byPromptVersion: Object.fromEntries(byPromptVersion),
      byBuiltInTemplateKey: Object.fromEntries(byTemplate),
    };
  },
});
