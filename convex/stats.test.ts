/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import schema from "./schema";
import { PROMPT_VERSION } from "./lib/interview_prompts";

const modules = import.meta.glob("./**/*.ts");

const seedCreator = async (t: Awaited<ReturnType<typeof convexTest>>) =>
  await t.run(async (ctx) =>
    await ctx.db.insert("creatorProfiles", {
      authUserId: "stats-auth-id",
      tokenIdentifier: "test|stats-creator",
      email: "stats@example.test",
      displayName: "Stats Creator",
      createdAt: 1,
      updatedAt: 1,
    }),
  );

const seedInterview = async (
  t: Awaited<ReturnType<typeof convexTest>>,
  creatorId: Id<"creatorProfiles">,
  overrides: Partial<Doc<"interviews">>,
): Promise<Id<"interviews">> =>
  await t.run(async (ctx) =>
    await ctx.db.insert("interviews", {
      creatorId,
      agentThreadId: `thread-${Math.random()}`,
      linkHash: `hash-${Math.random()}`,
      linkTokenCiphertext: "ciphertext",
      linkTokenIv: "iv",
      linkVersion: 1,
      projectName: "Portfolio",
      clientLanguage: "en",
      model: "gpt-5.6-terra",
      instructions: "Interview the Client.",
      passState: "consumed",
      createdAt: 1,
      updatedAt: 1,
      step: "review",
      clientMessageCount: 1,
      documentRevisionCount: 0,
      concepts: [],
      usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
      ...overrides,
    } as never),
  );

describe("feedback loop aggregates", () => {
  it("groups quality signals by prompt version and built-in template", async () => {
    const t = convexTest(schema, modules);
    const creatorId = await seedCreator(t);

    const ratedDocument = await seedInterview(t, creatorId, {
      promptVersion: PROMPT_VERSION,
      builtInTemplateKey: "website",
      documentRevisionCount: 2,
      step: "submitted",
      submission: {
        id: "submission-a",
        submittedAt: 2,
        projectDocument: "# A",
        emailDelivery: "sent",
        emailAttempts: 1,
      },
    });
    const ratedSubmission = ratedDocument;
    await t.run(async (ctx) => {
      await ctx.db.insert("interviewFeedback", {
        interviewId: ratedDocument,
        creatorId,
        target: "project_document",
        rating: "up",
        promptVersion: PROMPT_VERSION,
        createdAt: 2,
      });
      await ctx.db.insert("interviewFeedback", {
        interviewId: ratedSubmission,
        creatorId,
        target: "project_submission",
        rating: "down",
        promptVersion: PROMPT_VERSION,
        createdAt: 3,
      });
    });

    await seedInterview(t, creatorId, {
      promptVersion: PROMPT_VERSION + 1,
      clientMessageCount: 4,
    });
    await t.run(async (ctx) => {
      const interview = await ctx.db
        .query("interviews")
        .withIndex("by_creatorId", (q) => q.eq("creatorId", creatorId))
        .collect();
      const unrated = interview.find(
        ({ promptVersion }) => promptVersion === PROMPT_VERSION + 1,
      )!;
      await ctx.db.insert("interviewFeedback", {
        interviewId: unrated._id,
        creatorId,
        target: "project_document",
        rating: "down",
        createdAt: 4,
      });
    });

    await seedInterview(t, creatorId, {
      // No promptVersion: pre-attribution legacy Interview.
      builtInTemplateKey: "website",
      additionalConceptsUsed: true,
      visualDirection: {
        kind: "inspiration_links",
        inspirationLinks: ["https://example.com/inspiration"],
        note: "None of the concepts fit.",
      },
    });

    const stats = await t.query(internal.stats.aggregateStats, {});

    expect(stats.totals).toEqual({
      interviews: 3,
      submitted: 1,
      revisionRequests: 2,
      documentThumbsUp: 1,
      documentThumbsDown: 1,
      submissionThumbsUp: 0,
      submissionThumbsDown: 1,
      startedInterviews: 3,
      conceptRegenerations: 1,
      inspirationDirections: 1,
    });
    expect(stats.byPromptVersion[String(PROMPT_VERSION)]).toEqual({
      interviews: 1,
      submitted: 1,
      revisionRequests: 2,
      documentThumbsUp: 1,
      documentThumbsDown: 0,
      submissionThumbsUp: 0,
      submissionThumbsDown: 1,
    });
    expect(stats.byPromptVersion[String(PROMPT_VERSION + 1)]).toEqual({
      interviews: 1,
      submitted: 0,
      revisionRequests: 0,
      documentThumbsUp: 0,
      documentThumbsDown: 1,
      submissionThumbsUp: 0,
      submissionThumbsDown: 0,
    });
    expect(stats.byPromptVersion.legacy).toEqual({
      interviews: 1,
      submitted: 0,
      revisionRequests: 0,
      documentThumbsUp: 0,
      documentThumbsDown: 0,
      submissionThumbsUp: 0,
      submissionThumbsDown: 0,
    });
    expect(stats.byBuiltInTemplateKey.website).toEqual({
      interviews: 2,
      submitted: 1,
      revisionRequests: 2,
      documentThumbsUp: 1,
      documentThumbsDown: 0,
      submissionThumbsUp: 0,
      submissionThumbsDown: 1,
    });
  });
});
