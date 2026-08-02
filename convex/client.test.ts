/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { hashCapability } from "./lib/capability_crypto";

const modules = import.meta.glob("./**/*.ts");

describe("Client Visual Concept controls", () => {
  it("reuses planned concepts and queues image regeneration", async () => {
    const t = convexTest(schema, modules);
    registerRateLimiter(t);
    const token = "temporary-concept-restart-token";
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
      const storedImage = await ctx.storage.store(
        new Blob(["old image"], { type: "image/png" }),
      );
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
            imageId: storedImage,
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
        visualDirection: { kind: "concept", conceptId: "concept_1" },
        operation: {
          kind: "concept_generation",
          status: "failed",
          attempt: 3,
          errorCode: "CONCEPT_GENERATION_FAILED",
        },
        usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
      });
    });

    await t.mutation(api.client.restartConceptGeneration, {
      token,
      imageModel: "gpt-image-2",
      regeneratePrompts: false,
    });

    const interview = await t.run(async (ctx) => {
      const stored = await ctx.db
        .query("interviews")
        .withIndex("by_linkHash", (q) => q.eq("linkHash", linkHash))
        .unique();
      return stored;
    });
    expect(interview).toMatchObject({
      concepts: [
        {
          id: "concept_1",
          name: "Editorial",
          rationale: "Clear hierarchy",
          prompt: "Editorial portfolio",
          status: "pending",
        },
        {
          id: "concept_2",
          name: "Documentary",
          rationale: "Human texture",
          prompt: "Documentary portfolio",
          status: "pending",
        },
        {
          id: "concept_3",
          name: "Minimal",
          rationale: "Quiet focus",
          prompt: "Minimal portfolio",
          status: "pending",
        },
      ],
      operation: {
        kind: "concept_generation",
        status: "pending",
        attempt: 0,
        imageModel: "gpt-image-2",
        regeneratePrompts: false,
      },
    });
    expect(interview).not.toHaveProperty("visualDirection");
  });

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
        imageModel: "gpt-image-2-low",
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

  it("retries only the second concept batch", async () => {
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

    await t.mutation(api.client.retryAdditionalConcepts, { token });

    const interview = await t.run(async (ctx) =>
      await ctx.db
        .query("interviews")
        .withIndex("by_linkHash", (q) => q.eq("linkHash", linkHash))
        .unique(),
    );
    expect(interview).toMatchObject({
      concepts: [
        { id: "concept_1", status: "ready" },
        { id: "concept_2", status: "ready" },
        { id: "concept_3", status: "ready" },
        { id: "concept_4", status: "pending" },
        { id: "concept_5", status: "pending" },
        { id: "concept_6", status: "pending" },
      ],
      operation: {
        kind: "concept_generation",
        status: "pending",
        imageModel: "gpt-image-2-low",
        additionalConcepts: true,
        regeneratePrompts: true,
      },
    });
  });

  it("removes the second batch and retries only the first concept batch", async () => {
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

    await t.mutation(api.client.retryFirstConcepts, { token });

    const interview = await t.run(async (ctx) =>
      await ctx.db
        .query("interviews")
        .withIndex("by_linkHash", (q) => q.eq("linkHash", linkHash))
        .unique(),
    );
    expect(interview).toMatchObject({
      concepts: [],
      operation: {
        kind: "concept_generation",
        status: "pending",
        imageModel: "gpt-image-2-low",
        regeneratePrompts: true,
      },
    });
  });

  it("requires a note when submitting inspiration links", async () => {
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
    ).rejects.toThrow("Visual Direction note is required.");
  });
});
