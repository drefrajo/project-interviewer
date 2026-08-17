/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const insertRunningInterview = async (
  t: ReturnType<typeof convexTest>,
): Promise<Id<"interviews">> =>
  await t.run(async (ctx) => {
    const creatorId = await ctx.db.insert("creatorProfiles", {
      authUserId: "creator-auth-id",
      tokenIdentifier: "test|creator",
      email: "creator@example.com",
      displayName: "Creator",
      createdAt: 1,
      updatedAt: 1,
    });
    return await ctx.db.insert("interviews", {
      creatorId,
      agentThreadId: "thread",
      linkHash: "hash",
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
      step: "interview",
      clientMessageCount: 3,
      documentRevisionCount: 0,
      concepts: [],
      operation: {
        kind: "interview_response",
        status: "running",
        attempt: 1,
      },
      usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
    });
  });

describe("Interview completion state", () => {
  it("rejects internal concept mutations for document-only Interviews", async () => {
    const t = convexTest(schema, modules);
    const interviewId = await t.run(async (ctx) => {
      const creatorId = await ctx.db.insert("creatorProfiles", {
        authUserId: "creator-auth-id",
        tokenIdentifier: "test|creator",
        email: "creator@example.com",
        displayName: "Creator",
        createdAt: 1,
        updatedAt: 1,
      });
      return await ctx.db.insert("interviews", {
        creatorId,
        agentThreadId: "thread",
        linkHash: "document-only-job-hash",
        linkTokenCiphertext: "ciphertext",
        linkTokenIv: "iv",
        linkVersion: 1,
        projectName: "Privacy map",
        clientLanguage: "en",
        interviewKind: "privacy",
        includesVisualConcepts: false,
        model: "gpt-5.6-terra",
        instructions: "Map data flows.",
        passState: "consumed",
        createdAt: 1,
        updatedAt: 1,
        step: "review",
        clientMessageCount: 3,
        documentRevisionCount: 0,
        projectDocument: "# Data map",
        concepts: [],
        operation: {
          kind: "concept_generation",
          status: "running",
          attempt: 1,
        },
        usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
      });
    });

    await expect(
      t.mutation(internal.jobs.setConceptGenerationPhase, {
        interviewId,
        phase: "concept_creating",
      }),
    ).rejects.toThrow("This Interview does not include Visual Concepts.");
    await expect(
      t.mutation(internal.jobs.completeConcepts, {
        interviewId,
        concepts: [],
        hasFailure: false,
      }),
    ).rejects.toThrow("This Interview does not include Visual Concepts.");
  });

  it("publishes the current Visual Concept generation phase", async () => {
    const t = convexTest(schema, modules);
    const interviewId = await insertRunningInterview(t);
    await t.run(async (ctx) => {
      await ctx.db.patch("interviews", interviewId, {
        operation: {
          kind: "concept_generation",
          status: "running",
          attempt: 1,
          phase: "concept_planning",
        },
      });
    });

    await t.mutation(internal.jobs.setConceptGenerationPhase, {
      interviewId,
      phase: "concept_creating",
    });

    expect(
      await t.run(async (ctx) => await ctx.db.get("interviews", interviewId)),
    ).toMatchObject({
      operation: {
        kind: "concept_generation",
        status: "running",
        phase: "concept_creating",
      },
    });
  });

  it("persists planning before the question request completes", async () => {
    const t = convexTest(schema, modules);
    const interviewId = await insertRunningInterview(t);
    await t.run(async (ctx) => {
      await ctx.db.patch("interviews", interviewId, { clientMessageCount: 1 });
    });

    await t.mutation(internal.jobs.saveInterviewPlan, {
      interviewId,
      interviewPlan: "Known: portfolio. Next: confirm visual tone.",
      inputTokens: 10,
      outputTokens: 5,
      estimatedCostUsd: 0.01,
    });

    expect(
      await t.run(async (ctx) => await ctx.db.get("interviews", interviewId)),
    ).toMatchObject({
      interviewPlan: "Known: portfolio. Next: confirm visual tone.",
      operation: { status: "running" },
      usage: { inputTokens: 10, outputTokens: 5, estimatedCostUsd: 0.01 },
    });
  });

  it("records a distinct alignment turn and clears it when discovery resumes", async () => {
    const t = convexTest(schema, modules);
    const interviewId = await insertRunningInterview(t);

    await t.mutation(internal.jobs.completeText, {
      interviewId,
      kind: "interview_response",
      interviewTurnKind: "alignment",
      suggestedReplies: ["Yes", "I want to change something"],
      inputTokens: 1,
      outputTokens: 1,
      estimatedCostUsd: 0,
    });
    expect(
      await t.run(async (ctx) => await ctx.db.get("interviews", interviewId)),
    ).toMatchObject({
      alignmentAskedAtClientMessageCount: 3,
      suggestedReplies: ["Yes", "I want to change something"],
    });

    await t.run(async (ctx) => {
      await ctx.db.patch("interviews", interviewId, {
        operation: {
          kind: "interview_response",
          status: "running",
          attempt: 1,
        },
      });
    });
    await t.mutation(internal.jobs.completeText, {
      interviewId,
      kind: "interview_response",
      interviewTurnKind: "question",
      suggestedReplies: ["Option A", "Option B"],
      inputTokens: 1,
      outputTokens: 1,
      estimatedCostUsd: 0,
    });
    expect(
      await t.run(async (ctx) => await ctx.db.get("interviews", interviewId)),
    ).not.toHaveProperty("alignmentAskedAtClientMessageCount");
  });

  it("moves to review only when a separately generated Project Document completes", async () => {
    const t = convexTest(schema, modules);
    const interviewId = await insertRunningInterview(t);
    await t.run(async (ctx) => {
      await ctx.db.patch("interviews", interviewId, {
        alignmentAskedAtClientMessageCount: 2,
      });
    });

    await t.mutation(internal.jobs.completeText, {
      interviewId,
      kind: "interview_response",
      interviewTurnKind: "ready",
      projectDocument: "# Confirmed direction",
      inputTokens: 10,
      outputTokens: 20,
      estimatedCostUsd: 0.01,
    });

    const interview = await t.run(
      async (ctx) => await ctx.db.get("interviews", interviewId),
    );
    expect(interview).toMatchObject({
      step: "review",
      projectDocument: "# Confirmed direction",
      suggestedReplies: [],
      usage: {
        inputTokens: 10,
        outputTokens: 20,
        estimatedCostUsd: 0.01,
      },
    });
    expect(interview).not.toHaveProperty(
      "alignmentAskedAtClientMessageCount",
    );
  });
});
