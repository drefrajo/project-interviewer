/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

it("editing a private template cannot change a frozen Interview's instructions or workflow", async () => {
  const t = convexTest(schema, modules);
  const creatorId = await t.run((ctx) => ctx.db.insert("creatorProfiles", {
    authUserId: "configuration-owner", tokenIdentifier: "test|configuration",
    displayName: "Creator", email: "creator@example.test", createdAt: 1, updatedAt: 1,
  }));
  const creator = t.withIdentity({ tokenIdentifier: "test|configuration" });
  const original = "Conduct thorough discovery and retain the detailed document.";
  const templateId = await creator.mutation(api.templates.create, {
    name: "My service", sourceLanguage: "en", instructions: original,
    interviewKind: "website", includesVisualConcepts: true,
  });
  const interviewId = await t.run((ctx) => ctx.db.insert("interviews", {
    creatorId, agentThreadId: "unused", linkHash: "configuration-link",
    linkTokenCiphertext: "unused", linkTokenIv: "unused", linkVersion: 1,
    projectName: "Already running", clientLanguage: "en", instructions: original,
    model: "gpt-6.1-sol", interviewKind: "website", includesVisualConcepts: true,
    frozenAt: 1, startedAt: 1, passState: "consumed", step: "interview",
    clientMessageCount: 1, documentRevisionCount: 0, concepts: [],
    createdAt: 1, updatedAt: 1, usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
  }));
  const before = await t.run((ctx) => ctx.db.get("interviews", interviewId));
  await creator.mutation(api.templates.update, {
    templateId, name: "Short service", sourceLanguage: "en",
    instructions: "Use a short factual briefing and accept delegated design choices.",
    interviewKind: "website", includesVisualConcepts: true,
  });
  await expect(creator.mutation(api.interviews.updateBeforeStart, {
    interviewId, projectName: "Short", clientLanguage: "en",
    instructions: "Use a short briefing", interviewKind: "website", includesVisualConcepts: true,
  })).rejects.toThrow("configuration is frozen");
  expect(await t.run((ctx) => ctx.db.get("interviews", interviewId))).toEqual(before);
});
