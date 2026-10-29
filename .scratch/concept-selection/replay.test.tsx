/// <reference types="vite/client" />
import { readFile } from "node:fs/promises";
import { webcrypto } from "node:crypto";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { hashCapability } from "../../convex/lib/capability_crypto";
import { ConceptsStep } from "../../src/app/client/concepts-step";
import { CLIENT_COPY } from "../../src/app/client/client-copy";
import type { VisualDirection } from "../../src/domain/visual-direction";
import type { ConceptSeed } from "../../convex/lib/concept_seeds";

const modules = import.meta.glob("../../convex/**/*.ts");
afterEach(() => vi.unstubAllGlobals());

// Offline replay of actual pixel-based choices through the production React
// review component and real Convex capability/immutable-submission mutations.
// Never connects to a hosted deployment or invokes a provider.
it.each(["lina", "theo", "amira"])("replays %s's live choice from review to immutable submission", async (id) => {
  const recording = JSON.parse(await readFile(`.scratch/runtime/concept-selection/${id}.json`, "utf8")) as {
    name: string; language: "en" | "de"; instructions: string; document: string;
    concepts: ConceptSeed[]; direction: VisualDirection; reviewedSummary: string;
    clientConfirmed: boolean; error?: string;
  };
  expect(recording.error).toBeUndefined();
  expect(recording.clientConfirmed).toBe(true);
  expect(recording.direction.kind).toBe("concept");
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Offline replay must not access the network"); }));
  const t = convexTest(schema, modules);
  const token = `offline-style-${id}`;
  const linkHash = await hashCapability(token);
  const interviewId = await t.run(async (ctx) => {
    const creatorId = await ctx.db.insert("creatorProfiles", { authUserId: `style-${id}`, tokenIdentifier: `test|${id}`, email: "creator@example.test", displayName: "Configurable Creator", createdAt: 1, updatedAt: 1 });
    return ctx.db.insert("interviews", {
      creatorId, agentThreadId: "unused", linkHash, linkTokenCiphertext: "unused", linkTokenIv: "unused", linkVersion: 1,
      projectName: recording.name, clientLanguage: recording.language, model: "gpt-6.1-sol", instructions: recording.instructions,
      passState: "consumed", createdAt: 1, updatedAt: 1, step: "concepts", clientMessageCount: 10, documentRevisionCount: 0,
      projectDocument: recording.document, concepts: recording.concepts.map((concept) => ({ ...concept, status: "ready" as const })),
      usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
    });
  });
  await expect(t.mutation(api.client.submit, { token, direction: recording.direction })).rejects.toThrow("Confirm the visual style");
  const concepts = recording.concepts.map((concept) => ({ id: concept.id, name: concept.name, description: concept.rationale, state: "ready" as const, imageUrl: `https://offline.example.test/${id}-${concept.id}.png` }));
  const onSubmit = vi.fn(async (direction: VisualDirection) => {
    await t.mutation(api.client.submit, { token, direction, confirmVisualDirection: true });
  });
  render(<ConceptsStep concepts={concepts} language={recording.language} pending={false} onMoreOptions={async () => true} onRetryMoreOptions={async () => true} onRetryFirstOptions={async () => true} onSubmit={onSubmit} />);
  const copy = CLIENT_COPY[recording.language];
  const user = userEvent.setup();
  const selected = concepts.find((concept) => recording.direction.kind === "concept" && concept.id === recording.direction.conceptId)!;
  await user.click(screen.getByRole("radio", { name: `${selected.name} ${selected.description}` }));
  await user.type(screen.getByLabelText(copy.keepStyle), recording.direction.preferences!.keep);
  await user.type(screen.getByLabelText(copy.avoidStyle), recording.direction.preferences!.avoid);
  await user.click(screen.getByRole("button", { name: copy.reviewDirection }));
  const dialog = screen.getByRole("dialog", { name: copy.confirmStyleTitle });
  expect(dialog.textContent).toContain(recording.reviewedSummary);
  expect(within(dialog).getByRole("img", { name: selected.name })).toHaveAttribute("src", selected.imageUrl);
  expect(onSubmit).not.toHaveBeenCalled();
  await user.click(within(dialog).getByRole("button", { name: copy.confirmStyleSubmit }));
  await waitFor(async () => expect((await t.run((ctx) => ctx.db.get("interviews", interviewId)))?.step).toBe("submitted"));
  const stored = (await t.mutation(api.client.submit, { token })).submission;
  expect(stored.projectDocument).toBe(recording.document);
  expect(stored.visualDirection?.preferences).toEqual(recording.direction.preferences);
  expect(stored.visualDirection?.confirmation?.summary).toBe(recording.reviewedSummary);
  expect(stored.visualDirection?.confirmation?.confirmedAt).toBeGreaterThan(1);
  await expect(t.mutation(api.client.setVisualDirection, { token, direction: recording.direction })).rejects.toThrow("read-only");
}, 20_000);
