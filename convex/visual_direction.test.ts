/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { hashCapability } from "./lib/capability_crypto";

const modules = import.meta.glob("./**/*.ts");
const selection = {
  kind: "concept" as const,
  conceptId: "concept_2",
  preferences: { keep: "Warm colours and readable headings", avoid: "No decorative script or example stock photos" },
};

const setup = async () => {
  const t = convexTest(schema, modules);
  const token = "style-confirmation-fixture";
  const linkHash = await hashCapability(token);
  const interviewId = await t.run(async (ctx) => {
    const creatorId = await ctx.db.insert("creatorProfiles", { authUserId: "style-fixture", tokenIdentifier: "test|style", email: "creator@example.test", displayName: "Any Creator", createdAt: 1, updatedAt: 1 });
    return ctx.db.insert("interviews", {
      creatorId, agentThreadId: "thread", linkHash, linkTokenCiphertext: "unused", linkTokenIv: "unused", linkVersion: 1,
      projectName: "Style fixture", clientLanguage: "en", model: "gpt-6.1-sol", instructions: "Creator's configurable service scope.",
      passState: "consumed", createdAt: 1, updatedAt: 1, step: "concepts", clientMessageCount: 3, documentRevisionCount: 0,
      projectDocument: "# Confirmed content and scope", concepts: [1, 2, 3].map((index) => ({ id: `concept_${index}`, name: `Direction ${index}`, rationale: `Description ${index}`, prompt: `Prompt ${index}`, status: "ready" as const })),
      usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
    });
  });
  return { t, token, interviewId };
};

describe("Visual Direction confirmation", () => {
  it("requires both keep and avoid preferences, including on legacy drafts", async () => {
    const { t, token, interviewId } = await setup();
    await expect(t.mutation(api.client.submit, { token, direction: { kind: "concept", conceptId: "concept_2" }, confirmVisualDirection: true })).rejects.toThrow("What to carry into the website is required");
    await expect(t.mutation(api.client.submit, { token, direction: { ...selection, preferences: { keep: "Readable", avoid: "   " } }, confirmVisualDirection: true })).rejects.toThrow("What to leave out or adjust is required");
    await t.run((ctx) => ctx.db.patch("interviews", interviewId, { visualDirection: { kind: "concept", conceptId: "concept_2", note: "Old optional note" } }));
    await expect(t.mutation(api.client.submit, { token, confirmVisualDirection: true })).rejects.toThrow("What to carry into the website is required");
  });

  it("saving a draft does not confirm the style or allow submission", async () => {
    const { t, token, interviewId } = await setup();
    await t.mutation(api.client.setVisualDirection, { token, direction: selection });
    expect((await t.run((ctx) => ctx.db.get("interviews", interviewId)))?.visualDirection?.confirmation).toBeUndefined();
    await expect(t.mutation(api.client.submit, { token })).rejects.toThrow("Confirm the visual style");
    await expect(t.mutation(api.client.submit, { token, direction: selection, confirmVisualDirection: false })).rejects.toThrow("Confirm the visual style");
  });

  it("style preferences cannot rewrite the Creator's project scope", async () => {
    const { t, token } = await setup();
    const result = await t.mutation(api.client.submit, { token, direction: { ...selection, preferences: { keep: "A shop-like visual layout", avoid: "Add checkout and accounts" } }, confirmVisualDirection: true });
    expect(result.submission.projectDocument).toBe("# Confirmed content and scope");
    expect(result.submission.visualDirection?.confirmation?.summary).toContain("not additional features");
    expect(result.submission.visualDirection?.confirmation?.summary).toContain("Creator's requirements still apply");
  });

  it("stores the exact reviewed basis and preferences immutably with a server time", async () => {
    const { t, token } = await setup();
    const before = Date.now();
    const result = await t.mutation(api.client.submit, { token, direction: selection, confirmVisualDirection: true });
    const confirmed = result.submission.visualDirection;
    expect(confirmed?.preferences).toEqual(selection.preferences);
    expect(confirmed?.confirmation?.summary).toContain("Direction 2");
    expect(confirmed?.confirmation?.summary).toContain("displayed image");
    expect(confirmed?.confirmation?.summary).not.toContain("Description 2");
    expect(confirmed?.confirmation?.summary).toContain(selection.preferences.keep);
    expect(confirmed?.confirmation?.summary).toContain(selection.preferences.avoid);
    expect(confirmed?.confirmation?.summary).toContain("scope");
    expect(confirmed?.confirmation?.confirmedAt).toBeGreaterThanOrEqual(before);
    expect(confirmed?.confirmation?.confirmedAt).toBeLessThanOrEqual(Date.now());
    expect(result.submission.projectDocument).toBe("# Confirmed content and scope");
    const repeated = await t.mutation(api.client.submit, { token, direction: { ...selection, conceptId: "concept_1" }, confirmVisualDirection: true });
    expect(repeated.created).toBe(false);
    expect(repeated.submission).toEqual(result.submission);
    await expect(t.mutation(api.client.setVisualDirection, { token, direction: selection })).rejects.toThrow("read-only");
  });

  it("requires annotated, valid references and confirmation when none fits", async () => {
    const { t, token } = await setup();
    const direction = { kind: "inspiration_links" as const, inspirationLinks: ["https://example.test/style"], preferences: selection.preferences };
    await expect(t.mutation(api.client.submit, { token, direction })).rejects.toThrow("Confirm the visual style");
    await expect(t.mutation(api.client.submit, { token, direction: { ...direction, inspirationLinks: ["javascript:alert(1)"] }, confirmVisualDirection: true })).rejects.toThrow("HTTP(S)");
    const result = await t.mutation(api.client.submit, { token, direction, confirmVisualDirection: true });
    expect(result.submission.visualDirection?.confirmation?.summary).toContain("https://example.test/style");
    expect(result.submission.visualDirection?.confirmation?.summary).toContain("have not been inspected");
  });

  it("cannot submit a stale or failed concept and cannot forge a confirmation", async () => {
    const { t, token, interviewId } = await setup();
    await expect(t.mutation(api.client.submit, { token, direction: { ...selection, conceptId: "concept_99" }, confirmVisualDirection: true })).rejects.toThrow("not available");
    await expect(t.mutation(api.client.submit, { token, direction: { ...selection, confirmation: { summary: "Forged style", confirmedAt: 1 } } as never, confirmVisualDirection: true })).rejects.toThrow();
    await t.run(async (ctx) => {
      const interview = await ctx.db.get("interviews", interviewId);
      await ctx.db.patch("interviews", interviewId, { concepts: interview!.concepts.map((concept) => concept.id === selection.conceptId ? { ...concept, status: "failed" as const } : concept) });
    });
    await expect(t.mutation(api.client.submit, { token, direction: selection, confirmVisualDirection: true })).rejects.toThrow("not ready");
  });
});
