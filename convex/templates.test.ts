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

  it("stores concrete kind, description, and Visual Concept configuration", async () => {
    const t = convexTest(schema, modules);
    const now = 1;
    await t.run(async (ctx) => {
      await ctx.db.insert("creatorProfiles", {
        authUserId: "creator-auth-id",
        tokenIdentifier: "test|creator",
        email: "creator@example.com",
        displayName: "Creator",
        createdAt: now,
        updatedAt: now,
      });
    });

    const templateId = await t
      .withIdentity({ tokenIdentifier: "test|creator" })
      .mutation(api.templates.create, {
        name: "Privacy mapping",
        sourceLanguage: "en",
        instructions: "Map the organization's data flows.",
        interviewKind: "privacy",
        includesVisualConcepts: false,
        description: "Prepare factual material for qualified review.",
      });

    const templates = await t
      .withIdentity({ tokenIdentifier: "test|creator" })
      .query(api.templates.list, {});
    expect(templates).toEqual([
      expect.objectContaining({
        _id: templateId,
        interviewKind: "privacy",
        includesVisualConcepts: false,
        description: "Prepare factual material for qualified review.",
      }),
    ]);

    await expect(
      t.withIdentity({ tokenIdentifier: "test|creator" }).mutation(
        api.templates.update,
        {
          templateId,
          name: "Privacy mapping",
          sourceLanguage: "en",
          instructions: "Map the organization's data flows.",
          interviewKind: "privacy",
          includesVisualConcepts: true,
          description: "Invalid configuration",
        },
      ),
    ).rejects.toThrow("Privacy Interviews cannot include Visual Concepts.");

    await t.withIdentity({ tokenIdentifier: "test|creator" }).mutation(
      api.templates.update,
      {
        templateId,
        name: "Custom mapping",
        sourceLanguage: "en",
        instructions: "Map the organization's data flows.",
        interviewKind: "custom",
        includesVisualConcepts: true,
        description: "A configurable custom template.",
      },
    );
    const updated = await t
      .withIdentity({ tokenIdentifier: "test|creator" })
      .query(api.templates.list, {});
    expect(updated[0]).toMatchObject({
      interviewKind: "custom",
      includesVisualConcepts: true,
    });
  });

  it("resolves legacy private templates to website with concepts", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const creatorId = await ctx.db.insert("creatorProfiles", {
        authUserId: "creator-auth-id",
        tokenIdentifier: "test|creator",
        email: "creator@example.com",
        displayName: "Creator",
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("interviewTemplates", {
        kind: "private",
        ownerId: creatorId,
        name: "Legacy",
        sourceLanguage: "en",
        instructions: "Legacy instructions",
        createdAt: 1,
        updatedAt: 1,
      });
    });
    const templates = await t
      .withIdentity({ tokenIdentifier: "test|creator" })
      .query(api.templates.list, {});
    expect(templates[0]).toMatchObject({
      interviewKind: "website",
      includesVisualConcepts: true,
    });
  });
});
