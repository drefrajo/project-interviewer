/// <reference types="vite/client" />

import { createThread, saveMessage } from "@convex-dev/agent";
import { register as registerAgent } from "@convex-dev/agent/test";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { internal } from "./_generated/api";
import { agentComponent } from "./lib/components";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("whole Interview export data", () => {
  it("exports an incomplete Interview chronologically without OAuth identity", async () => {
    const t = convexTest(schema, modules);
    registerAgent(t);
    const tokenIdentifier = "test|export";
    const { interviewId } = await t.run(async (ctx) => {
      const creatorId = await ctx.db.insert("creatorProfiles", {
        authUserId: "export-auth",
        tokenIdentifier,
        email: "private-oauth@example.test",
        displayName: "Export Studio",
        contactEmail: "public@example.test",
        privacyPolicyUrl: "https://example.test/privacy",
        createdAt: 1,
        updatedAt: 1,
      });
      const threadId = await createThread(ctx, agentComponent, {
        userId: creatorId,
        title: "Incomplete export",
      });
      await saveMessage(ctx, agentComponent, {
        threadId,
        prompt: "First Client message",
      });
      await saveMessage(ctx, agentComponent, {
        threadId,
        message: { role: "assistant", content: "First AI response" },
        agentName: "Interview",
      });
      const interviewId = await ctx.db.insert("interviews", {
        creatorId,
        agentThreadId: threadId,
        linkHash: "export-hash",
        linkTokenCiphertext: "ciphertext",
        linkTokenIv: "iv",
        linkVersion: 1,
        projectName: "Incomplete export",
        clientLanguage: "en",
        model: "gpt-5.6-terra",
        instructions: "Private Interview Instructions",
        passState: "consumed",
        createdAt: 1,
        updatedAt: 2,
        lastActivityAt: 2,
        retentionExpiresAt: 3,
        step: "interview",
        clientMessageCount: 1,
        documentRevisionCount: 0,
        concepts: [],
        usage: { inputTokens: 1, outputTokens: 1, estimatedCostUsd: 0 },
      });
      return { interviewId };
    });

    const manifest = await t.query(internal.downloads_data.get, {
      interviewId,
      tokenIdentifier,
    });

    expect(manifest).not.toBeNull();
    expect(manifest?.projectDocument).toBeUndefined();
    expect(manifest?.transcriptMarkdown.indexOf("First Client message")).toBeLessThan(
      manifest?.transcriptMarkdown.indexOf("First AI response") ?? -1,
    );
    expect(manifest?.interviewJson).toContain("Private Interview Instructions");
    expect(manifest?.interviewJson).toContain("public@example.test");
    expect(manifest?.interviewJson).not.toContain("private-oauth@example.test");

    const [firstStorageId, secondStorageId] = await t.run(async (ctx) => [
      await ctx.storage.store(new Blob(["first"])),
      await ctx.storage.store(new Blob(["second"])),
    ]);
    const firstArchiveId = await t.mutation(
      internal.downloads_data.registerArchive,
      {
        interviewId,
        tokenIdentifier,
        storageId: firstStorageId,
        expiresAt: 100,
      },
    );
    const secondArchiveId = await t.mutation(
      internal.downloads_data.registerArchive,
      {
        interviewId,
        tokenIdentifier,
        storageId: secondStorageId,
        expiresAt: 200,
      },
    );
    expect(firstArchiveId).not.toBeNull();
    expect(secondArchiveId).not.toBeNull();
    await t.run(async (ctx) => {
      expect(
        firstArchiveId
          ? await ctx.db.get("exportArchives", firstArchiveId)
          : null,
      ).toBeNull();
      expect(await ctx.storage.get(firstStorageId)).toBeNull();
      expect(
        secondArchiveId
          ? await ctx.db.get("exportArchives", secondArchiveId)
          : null,
      ).not.toBeNull();
    });
  });
});
