/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { hashCapability } from "./lib/capability_crypto";

const modules = import.meta.glob("./**/*.ts");

describe("Client Visual Concept controls", () => {
  it("allows a second batch whenever only one batch is ready", async () => {
    const t = convexTest(schema, modules);
    registerRateLimiter(t);
    const token = "temporary-more-concepts-token";
    const linkHash = await hashCapability(token);
    await t.run(async (ctx) => {
      const creatorId = await ctx.db.insert("creatorProfiles", {
        authUserId: "creator-auth-id",
        tokenIdentifier: "test|creator",
        email: "creator@example.com",
        displayName: "Creator",
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("interviews", {
        creatorId,
        agentThreadId: "thread",
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
        step: "concepts",
        clientMessageCount: 3,
        documentRevisionCount: 0,
        projectDocument: "# Confirmed direction",
        concepts: [
          {
            id: "concept_1",
            name: "Editorial",
            rationale: "Clear hierarchy",
            prompt: "Editorial portfolio",
            status: "ready",
          },
          {
            id: "concept_2",
            name: "Documentary",
            rationale: "Human texture",
            prompt: "Documentary portfolio",
            status: "ready",
          },
          {
            id: "concept_3",
            name: "Minimal",
            rationale: "Quiet focus",
            prompt: "Minimal portfolio",
            status: "ready",
          },
        ],
        usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
      });
    });

    await t.mutation(api.client.requestMoreConcepts, { token });

    const interview = await t.run(async (ctx) =>
      await ctx.db
        .query("interviews")
        .withIndex("by_linkHash", (q) => q.eq("linkHash", linkHash))
        .unique(),
    );
    expect(interview).toMatchObject({
      operation: {
        kind: "concept_generation",
        status: "pending",
        imageModel: "gpt-image-2.5-flare",
        additionalConcepts: true,
      },
    });
    await t.run(async (ctx) => {
      const stored = await ctx.db
        .query("interviews")
        .withIndex("by_linkHash", (q) => q.eq("linkHash", linkHash))
        .unique();
      if (!stored) throw new Error("Interview fixture was not found.");
      await ctx.db.patch("interviews", stored._id, {
        operation: undefined,
      });
    });

    await t.mutation(api.client.requestMoreConcepts, { token });

    await t.run(async (ctx) => {
      const stored = await ctx.db
        .query("interviews")
        .withIndex("by_linkHash", (q) => q.eq("linkHash", linkHash))
        .unique();
      if (!stored) throw new Error("Interview fixture was not found.");
      await ctx.db.patch("interviews", stored._id, {
        concepts: Array.from({ length: 6 }, (_, index) => ({
          id: `concept_${index + 1}`,
          name: `Concept ${index + 1}`,
          rationale: `Rationale ${index + 1}`,
          prompt: `Prompt ${index + 1}`,
          status: "ready" as const,
        })),
        operation: undefined,
      });
    });

    await expect(
      t.mutation(api.client.requestMoreConcepts, { token }),
    ).rejects.toThrow(
      "A second Visual Concept batch can be requested only while one ready batch exists.",
    );
  });

  it("rejects second-batch retries while the temporary feature is disabled", async () => {
    const t = convexTest(schema, modules);
    registerRateLimiter(t);
    const token = "temporary-retry-more-concepts-token";
    const linkHash = await hashCapability(token);
    await t.run(async (ctx) => {
      const creatorId = await ctx.db.insert("creatorProfiles", {
        authUserId: "creator-auth-id",
        tokenIdentifier: "test|creator",
        email: "creator@example.com",
        displayName: "Creator",
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("interviews", {
        creatorId,
        agentThreadId: "thread",
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
        step: "concepts",
        clientMessageCount: 3,
        documentRevisionCount: 0,
        projectDocument: "# Confirmed direction",
        concepts: Array.from({ length: 6 }, (_, index) => ({
          id: `concept_${index + 1}`,
          name: `Concept ${index + 1}`,
          rationale: `Rationale ${index + 1}`,
          prompt: `Prompt ${index + 1}`,
          status: "ready" as const,
        })),
        usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
      });
    });

    await expect(
      t.mutation(api.client.retryAdditionalConcepts, { token }),
    ).rejects.toThrow("Temporary Visual Concept batch retries are disabled.");
  });

  it("rejects first-batch retries while the temporary feature is disabled", async () => {
    const t = convexTest(schema, modules);
    registerRateLimiter(t);
    const token = "temporary-retry-first-concepts-token";
    const linkHash = await hashCapability(token);
    await t.run(async (ctx) => {
      const creatorId = await ctx.db.insert("creatorProfiles", {
        authUserId: "creator-auth-id",
        tokenIdentifier: "test|creator",
        email: "creator@example.com",
        displayName: "Creator",
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("interviews", {
        creatorId,
        agentThreadId: "thread",
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
        step: "concepts",
        clientMessageCount: 3,
        documentRevisionCount: 0,
        projectDocument: "# Confirmed direction",
        concepts: Array.from({ length: 6 }, (_, index) => ({
          id: `concept_${index + 1}`,
          name: `Concept ${index + 1}`,
          rationale: `Rationale ${index + 1}`,
          prompt: `Prompt ${index + 1}`,
          status: "ready" as const,
        })),
        usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
      });
    });

    await expect(
      t.mutation(api.client.retryFirstConcepts, { token }),
    ).rejects.toThrow("Temporary Visual Concept batch retries are disabled.");
  });

  it("requires style preferences when submitting inspiration links", async () => {
    const t = convexTest(schema, modules);
    registerRateLimiter(t);
    const token = "temporary-required-inspiration-note-token";
    const linkHash = await hashCapability(token);
    await t.run(async (ctx) => {
      const creatorId = await ctx.db.insert("creatorProfiles", {
        authUserId: "creator-auth-id",
        tokenIdentifier: "test|creator",
        email: "creator@example.com",
        displayName: "Creator",
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("interviews", {
        creatorId,
        agentThreadId: "thread",
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
        step: "concepts",
        clientMessageCount: 3,
        documentRevisionCount: 0,
        projectDocument: "# Confirmed direction",
        concepts: Array.from({ length: 3 }, (_, index) => ({
          id: `concept_${index + 1}`,
          name: `Concept ${index + 1}`,
          rationale: `Rationale ${index + 1}`,
          prompt: `Prompt ${index + 1}`,
          status: "ready" as const,
        })),
        usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
      });
    });

    await expect(
      t.mutation(api.client.submit, {
        token,
        direction: {
          kind: "inspiration_links",
          inspirationLinks: ["https://example.com"],
        },
      }),
    ).rejects.toThrow("What to carry into the website is required.");
  });

  it("submits a document-only Interview directly from Document Review", async () => {
    const t = convexTest(schema, modules);
    const token = "document-only-submit-token";
    const linkHash = await hashCapability(token);
    await t.run(async (ctx) => {
      const creatorId = await ctx.db.insert("creatorProfiles", {
        authUserId: "creator-auth-id",
        tokenIdentifier: "test|creator",
        email: "creator@example.com",
        displayName: "Creator",
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("interviews", {
        creatorId,
        agentThreadId: "thread",
        linkHash,
        linkTokenCiphertext: "ciphertext",
        linkTokenIv: "iv",
        linkVersion: 1,
        projectName: "Privacy map",
        clientLanguage: "en",
        interviewKind: "privacy",
        includesVisualConcepts: false,
        model: "gpt-5.6-terra",
        instructions: "Map the organization's data flows.",
        passState: "consumed",
        createdAt: 1,
        updatedAt: 1,
        step: "review",
        clientMessageCount: 3,
        documentRevisionCount: 0,
        projectDocument: "# Privacy data map\n\n[UNKNOWN: retention]",
        concepts: [],
        usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
      });
    });

    const result = await t.mutation(api.client.submit, { token });
    expect(result.created).toBe(true);
    expect(result.submission).not.toHaveProperty("visualDirection");
    const interview = await t.run(async (ctx) =>
      await ctx.db
        .query("interviews")
        .withIndex("by_linkHash", (q) => q.eq("linkHash", linkHash))
        .unique(),
    );
    expect(interview).toMatchObject({
      interviewKind: "privacy",
      includesVisualConcepts: false,
      step: "submitted",
      submission: { projectDocument: "# Privacy data map\n\n[UNKNOWN: retention]" },
    });
    expect(interview?.submission?.visualDirection).toBeUndefined();
  });

  it("rejects Visual Concept entry for a document-only Interview", async () => {
    const t = convexTest(schema, modules);
    const token = "document-only-concepts-token";
    const linkHash = await hashCapability(token);
    await t.run(async (ctx) => {
      const creatorId = await ctx.db.insert("creatorProfiles", {
        authUserId: "creator-auth-id",
        tokenIdentifier: "test|creator",
        email: "creator@example.com",
        displayName: "Creator",
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("interviews", {
        creatorId,
        agentThreadId: "thread",
        linkHash,
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
        projectDocument: "# Privacy data map",
        concepts: [],
        usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
      });
    });

    await expect(
      t.mutation(api.client.continueToConcepts, { token }),
    ).rejects.toThrow("This Interview does not include Visual Concepts.");
  });
});
