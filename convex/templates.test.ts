/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("Private Interview Templates", () => {
  it("returns only templates owned by the authenticated Creator", async () => {
    const t = convexTest(schema, modules);
    const now = 1;
    await t.run(async (ctx) => {
      const creatorId = await ctx.db.insert("creatorProfiles", {
        authUserId: "creator-auth-id",
        tokenIdentifier: "test|creator",
        email: "creator@example.com",
        displayName: "Creator",
        createdAt: now,
        updatedAt: now,
      });
      const otherCreatorId = await ctx.db.insert("creatorProfiles", {
        authUserId: "other-auth-id",
        tokenIdentifier: "test|other",
        email: "other@example.com",
        displayName: "Other",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("interviewTemplates", {
        kind: "built_in",
        builtInKey: "single-page-business",
        name: "Legacy built-in",
        sourceLanguage: "en",
        instructions: "Persisted legacy instructions",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("interviewTemplates", {
        kind: "private",
        ownerId: creatorId,
        name: "Creator template",
        sourceLanguage: "de",
        instructions: "Private Creator instructions",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("interviewTemplates", {
        kind: "private",
        ownerId: otherCreatorId,
        name: "Other template",
        sourceLanguage: "en",
        instructions: "Other instructions",
        createdAt: now,
        updatedAt: now,
      });
    });

    const templates = await t
      .withIdentity({ tokenIdentifier: "test|creator" })
      .query(api.templates.list, {});

    expect(templates).toEqual([
      expect.objectContaining({
        kind: "private",
        name: "Creator template",
        sourceLanguage: "de",
        instructions: "Private Creator instructions",
      }),
    ]);
    expect(templates[0]?._id).toBeDefined();
  });
});
