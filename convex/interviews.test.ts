/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("Creator Interview access", () => {
  it("returns an unavailable result when another Creator opens the Interview", async () => {
    const t = convexTest(schema, modules);
    const interviewId = await t.run(async (ctx) => {
      const ownerId = await ctx.db.insert("creatorProfiles", {
        authUserId: "owner-auth-id",
        tokenIdentifier: "test|owner",
        email: "owner@example.com",
        displayName: "Owner",
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("creatorProfiles", {
        authUserId: "other-auth-id",
        tokenIdentifier: "test|other",
        email: "other@example.com",
        displayName: "Other",
        createdAt: 1,
        updatedAt: 1,
      });
      return await ctx.db.insert("interviews", {
        creatorId: ownerId,
        agentThreadId: "thread",
        linkHash: "link-hash",
        linkTokenCiphertext: "ciphertext",
        linkTokenIv: "iv",
        linkVersion: 1,
        projectName: "Owner project",
        clientLanguage: "en",
        model: "gpt-5.6-terra",
        instructions: "Interview the Client.",
        passState: "unreserved",
        createdAt: 1,
        updatedAt: 1,
        step: "interview",
        clientMessageCount: 0,
        documentRevisionCount: 0,
        concepts: [],
        usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
      });
    });

    await expect(
      t.withIdentity({ tokenIdentifier: "test|other" }).query(
        api.interviews.get,
        { interviewId },
      ),
    ).resolves.toBeNull();
  });
});
