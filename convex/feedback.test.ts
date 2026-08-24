/// <reference types="vite/client" />

import { register as registerAgent } from "@convex-dev/agent/test";
import { createThread } from "@convex-dev/agent";
import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import schema from "./schema";
import { agentComponent } from "./lib/components";
import { PROMPT_VERSION } from "./lib/interview_prompts";

const modules = import.meta.glob("./**/*.ts");
type Harness = TestConvex<typeof schema>;

// Test-only encryption material so Interview creation can seal links without a
// deployment secret. No real provider is contacted.
process.env.CAPABILITY_ENCRYPTION_SECRET ??= "test-only-capability-secret";

const creatorIdentity = (tokenIdentifier: string) => ({ tokenIdentifier });

const seedCreator = async (
  t: Harness,
  tokenIdentifier: string,
): Promise<Id<"creatorProfiles">> =>
  await t.run(async (ctx) =>
    await ctx.db.insert("creatorProfiles", {
      authUserId: `${tokenIdentifier}-auth`,
      tokenIdentifier,
      email: `${tokenIdentifier.replaceAll("|", "-")}@example.test`,
      displayName: tokenIdentifier,
      contactEmail: "public-contact@example.test",
      createdAt: 1,
      updatedAt: 1,
    }),
  );

const seedInterview = async (
  t: Harness,
  creatorId: Id<"creatorProfiles">,
  overrides: Partial<Doc<"interviews">> = {},
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
      passState: "unreserved",
      createdAt: 1,
      updatedAt: 1,
      step: "review",
      clientMessageCount: 2,
      documentRevisionCount: 0,
      concepts: [],
      usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
      ...overrides,
    } as never),
  );

describe("Interview Policy attribution", () => {
  it("stamps the current policy version on newly created Interviews", async () => {
    const t = convexTest(schema, modules);
    registerAgent(t);
    await seedCreator(t, "test|creator");

    const created = await t
      .withIdentity(creatorIdentity("test|creator"))
      .mutation(api.interviews.create, {
        projectName: "Launch site",
        clientLanguage: "en",
        instructions: "Interview the Client.",
        interviewKind: "website",
        includesVisualConcepts: true,
        builtInTemplateKey: "website",
      });

    const stored = await t.run(async (ctx) =>
      await ctx.db.get("interviews", created.interviewId),
    );
    expect(stored).toMatchObject({
      promptVersion: PROMPT_VERSION,
      builtInTemplateKey: "website",
    });
  });

  it("omits the built-in origin for self-authored Instructions", async () => {
    const t = convexTest(schema, modules);
    registerAgent(t);
    await seedCreator(t, "test|creator");

    const created = await t
      .withIdentity(creatorIdentity("test|creator"))
      .mutation(api.interviews.create, {
        projectName: "Bespoke",
        clientLanguage: "en",
        instructions: "Interview the Client.",
        interviewKind: "custom",
        includesVisualConcepts: false,
      });

    const stored = await t.run(async (ctx) =>
      await ctx.db.get("interviews", created.interviewId),
    );
    expect(stored?.promptVersion).toBe(PROMPT_VERSION);
    expect(stored?.builtInTemplateKey).toBeUndefined();
  });
});

describe("Creator quality feedback", () => {
  it("keeps exactly one rating per target and copies the policy version", async () => {
    const t = convexTest(schema, modules);
    const creatorId = await seedCreator(t, "test|creator");
    const interviewId = await seedInterview(t, creatorId, {
      promptVersion: PROMPT_VERSION,
      projectDocument: "# Project Document",
      step: "submitted",
      submission: {
        id: "submission-1",
        submittedAt: 2,
        projectDocument: "# Project Document",
        emailDelivery: "sent",
        emailAttempts: 1,
      },
    });

    await t
      .withIdentity(creatorIdentity("test|creator"))
      .mutation(api.feedback.record, {
        interviewId,
        target: "project_document",
        rating: "up",
      });
    await t
      .withIdentity(creatorIdentity("test|creator"))
      .mutation(api.feedback.record, {
        interviewId,
        target: "project_document",
        rating: "down",
      });
    await t
      .withIdentity(creatorIdentity("test|creator"))
      .mutation(api.feedback.record, {
        interviewId,
        target: "project_submission",
        rating: "up",
        comment: "  Saved me a discovery call.  ",
      });

    const entries = await t
      .withIdentity(creatorIdentity("test|creator"))
      .query(api.feedback.getForInterview, { interviewId });
    expect(entries).toHaveLength(2);
    const documentEntry = entries.find(
      ({ target }) => target === "project_document",
    );
    const submissionEntry = entries.find(
      ({ target }) => target === "project_submission",
    );
    expect(documentEntry).toMatchObject({ rating: "down" });
    expect(submissionEntry).toEqual({
      target: "project_submission",
      rating: "up",
      comment: "Saved me a discovery call.",
      createdAt: expect.any(Number),
    });

    const rows = await t.run(async (ctx) =>
      await ctx.db.query("interviewFeedback").collect(),
    );
    expect(
      rows.find(({ target }) => target === "project_document")?.promptVersion,
    ).toBe(PROMPT_VERSION);
  });

  it("rejects non-owners and missing outputs", async () => {
    const t = convexTest(schema, modules);
    const ownerId = await seedCreator(t, "test|owner");
    await seedCreator(t, "test|other");
    const interviewId = await seedInterview(t, ownerId);

    await expect(
      t.withIdentity(creatorIdentity("test|other")).mutation(
        api.feedback.record,
        { interviewId, target: "project_document", rating: "up" },
      ),
    ).rejects.toThrow("Interview not found.");
    await expect(
      t.withIdentity(creatorIdentity("test|owner")).mutation(
        api.feedback.record,
        { interviewId, target: "project_document", rating: "up" },
      ),
    ).rejects.toThrow("Feedback target is not available yet.");
    await expect(
      t.withIdentity(creatorIdentity("test|other")).query(
        api.feedback.getForInterview,
        { interviewId },
      ),
    ).resolves.toEqual([]);
  });

  it("deletes feedback together with the Interview", async () => {
    const t = convexTest(schema, modules);
    registerAgent(t);
    const creatorId = await seedCreator(t, "test|creator");
    const agentThreadId = await t.run(async (ctx) =>
      await createThread(ctx, agentComponent, { title: "Portfolio" }),
    );
    const interviewId = await seedInterview(t, creatorId, {
      agentThreadId,
      promptVersion: PROMPT_VERSION,
      projectDocument: "# Project Document",
    });
    await t
      .withIdentity(creatorIdentity("test|creator"))
      .mutation(api.feedback.record, {
        interviewId,
        target: "project_document",
        rating: "up",
      });

    await t
      .withIdentity(creatorIdentity("test|creator"))
      .mutation(api.interviews.remove, {
        interviewId,
        confirmation: "Portfolio",
      });

    const remaining = await t.run(async (ctx) =>
      await ctx.db.query("interviewFeedback").collect(),
    );
    expect(remaining).toEqual([]);
  });
});

describe("Product-improvement opt-in", () => {
  it("stores the Creator choice and leaves it untouched when omitted", async () => {
    const t = convexTest(schema, modules);
    const identity = creatorIdentity("test|creator");
    await seedCreator(t, "test|creator");

    const optedIn = await t.withIdentity(identity).mutation(
      api.creator_profiles.updateSettings,
      {
        displayName: "Studio Example",
        contactEmail: "hello@studio.example",
        language: "en",
        contentAnalysisOptIn: true,
      },
    );
    expect(optedIn.contentAnalysisOptIn).toBe(true);

    const untouched = await t.withIdentity(identity).mutation(
      api.creator_profiles.updateSettings,
      {
        displayName: "Studio Example",
        contactEmail: "hello@studio.example",
        language: "en",
      },
    );
    expect(untouched.contentAnalysisOptIn).toBe(true);

    const optedOut = await t.withIdentity(identity).mutation(
      api.creator_profiles.updateSettings,
      {
        displayName: "Studio Example",
        contactEmail: "hello@studio.example",
        language: "en",
        contentAnalysisOptIn: false,
      },
    );
    expect(optedOut.contentAnalysisOptIn).toBe(false);

    const current = await t
      .withIdentity(creatorIdentity("test|creator"))
      .query(api.creator_profiles.getCurrent, {});
    expect(current).toMatchObject({ contentAnalysisOptIn: false });
  });
});
