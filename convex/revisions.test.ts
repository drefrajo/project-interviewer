/// <reference types="vite/client" />

import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import { register as registerAgent } from "@convex-dev/agent/test";
import { createThread } from "@convex-dev/agent";
import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import schema from "./schema";
import { agentComponent } from "./lib/components";
import { hashCapability } from "./lib/capability_crypto";
import { PROMPT_VERSION } from "./lib/interview_prompts";

const modules = import.meta.glob("./**/*.ts");
type Harness = TestConvex<typeof schema>;

const seedReviewInterview = async (
  t: Harness,
  overrides: Partial<Doc<"interviews">> = {},
) => {
  const token = `revision-token-${Math.random()}`;
  const linkHash = await hashCapability(token);
  const interviewId = await t.run(async (ctx) => {
    const creatorId = await ctx.db.insert("creatorProfiles", {
      authUserId: "revision-auth-id",
      tokenIdentifier: "test|revision-creator",
      email: "revision@example.test",
      displayName: "Revision Creator",
      contactEmail: "hello@studio.example",
      createdAt: 1,
      updatedAt: 1,
    });
    return await ctx.db.insert("interviews", {
      creatorId,
      agentThreadId: `thread-${Math.random()}`,
      linkHash,
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
      clientMessageCount: 3,
      documentRevisionCount: 0,
      concepts: [],
      projectDocument: "# Project Document",
      promptVersion: PROMPT_VERSION,
      usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
      ...overrides,
    } as never);
  });
  return { token, interviewId };
};

describe("Document Review revision persistence", () => {
  it("keeps the requested changes after the transient operation clears", async () => {
    const t = convexTest(schema, modules);
    registerRateLimiter(t);
    const { token, interviewId } = await seedReviewInterview(t);

    await t.mutation(api.client.requestDocumentChanges, {
      token,
      changes: "Make the hero copy concrete.",
    });

    // Simulate job completion clearing the operation.
    await t.run(async (ctx) => {
      await ctx.db.patch("interviews", interviewId, { operation: undefined });
    });

    const rows = await t.run(async (ctx) =>
      await ctx.db.query("documentRevisions").collect(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      interviewId,
      requestedChanges: "Make the hero copy concrete.",
      promptVersion: PROMPT_VERSION,
    });
  });

  it("deletes persisted revisions together with the Interview", async () => {
    const t = convexTest(schema, modules);
    registerRateLimiter(t);
    registerAgent(t);
    const agentThreadId = await t.run(async (ctx) =>
      await createThread(ctx, agentComponent, { title: "Portfolio" }),
    );
    const { token, interviewId } = await seedReviewInterview(t, {
      agentThreadId,
    });

    await t.mutation(api.client.requestDocumentChanges, {
      token,
      changes: "Tighten the pricing section.",
    });
    await t
      .withIdentity({ tokenIdentifier: "test|revision-creator" })
      .mutation(api.interviews.remove, {
        interviewId,
        confirmation: "Portfolio",
      });

    const rows = await t.run(async (ctx) =>
      await ctx.db.query("documentRevisions").collect(),
    );
    expect(rows).toEqual([]);
  });
});
