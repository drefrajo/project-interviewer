/// <reference types="vite/client" />
import { readFile } from "node:fs/promises";
import { convexTest } from "convex-test";
import { createThread } from "@convex-dev/agent";
import { register as registerAgent } from "@convex-dev/agent/test";
import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import { afterEach, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { agentComponent } from "../../convex/lib/components";
import { hashCapability } from "../../convex/lib/capability_crypto";
import { PROMPT_VERSION } from "../../convex/lib/interview_prompts";
import * as conceptGeneration from "../../convex/lib/concept_generation";
import type { ProviderMessage } from "../../convex/lib/provider_requests";
import type { ConceptSeed } from "../../convex/lib/concept_seeds";
import type { InterviewTurnKind } from "../../convex/lib/interview_turn";
import { clients } from "./clients";

const modules = import.meta.glob("../../convex/**/*.ts");
const originalEnvironment = process.env;
afterEach(() => {
  process.env = originalEnvironment;
  vi.unstubAllGlobals();
  vi.clearAllTimers();
  vi.useRealTimers();
});

// No network: replay real model recordings through real actions, mutations,
// Agent storage, capability lookup, rate limiter and immutable submission.
it.each(clients)("replays the real Convex pipeline for $id", async (client) => {
  const recording = JSON.parse(await readFile(`.scratch/runtime/interview-evaluation/controlled/improved/${client.id}.json`, "utf8")) as {
    instructions: string;
    transcript: ProviderMessage[];
    turns: Array<{ kind: InterviewTurnKind; content: string; suggestedReplies: string[] }>;
    plan: string;
    document: string;
    revision: string;
    concepts: ConceptSeed[];
  };
  expect(recording.document).toBeTruthy();
  expect(recording.revision).toBeTruthy();
  expect(recording.concepts).toHaveLength(3);
  process.env = { ...originalEnvironment, OPENROUTER_API_KEY: "offline-replay-placeholder" };
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
  const generate = conceptGeneration.generateConceptsInParallel;
  let storageQueue = Promise.resolve();
  // convex-test's action-side storeBlob transaction check races when another
  // store is awaiting its digest ("Write outside of transaction"). Serialize
  // only this replay callback; real parallel generation is exercised live.
  vi.spyOn(conceptGeneration, "generateConceptsInParallel").mockImplementation(
    (seeds, existing, generateAndStore) => generate(seeds, existing, (seed) => {
      const pending = storageQueue.then(() => generateAndStore(seed));
      storageQueue = pending.then(() => undefined, () => undefined);
      return pending;
    }),
  );
  let turnIndex = 0;
  let planCalls = 0;
  let imageCalls = 0;
  const reply = (content: string) => new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 1, completion_tokens: 1, cost: 0 } }), { headers: { "content-type": "application/json" } });
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as { model: string; quality?: string; aspect_ratio?: string; reasoning?: { effort: string }; messages?: ProviderMessage[] };
    if (url === "https://openrouter.ai/api/v1/images") {
      expect(body).toMatchObject({ model: "openai/gpt-image-2.5-flare", quality: "medium", aspect_ratio: "3:2" });
      imageCalls++;
      // Only storage/response-shape testing; real image quality is evaluated separately.
      return new Response(JSON.stringify({ data: [{ b64_json: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==" }] }));
    }
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(body).toMatchObject({ model: "openai/gpt-6.1-sol", reasoning: { effort: "low" } });
    const system = body.messages![0]!.content;
    if (system.includes("short private adaptive Interview Plan")) { planCalls++; return reply(recording.plan); }
    if (system.includes("Revise the Project Document")) return reply(recording.revision);
    if (system.includes("Create the implementation-ready Project Document")) return reply(recording.document);
    if (system.includes('"concepts":[')) return reply(JSON.stringify({ concepts: recording.concepts }));
    const turn = recording.turns[turnIndex++];
    if (!turn) throw new Error("Unexpected additional interview request");
    return reply(JSON.stringify(turn));
  }));

  const t = convexTest(schema, modules);
  registerAgent(t); registerRateLimiter(t);
  const token = `offline-${client.id}`;
  const linkHash = await hashCapability(token);
  const interviewId = await t.run(async (ctx) => {
    const creatorId = await ctx.db.insert("creatorProfiles", { authUserId: `offline-${client.id}`, tokenIdentifier: `offline|${client.id}`, email: "offline@example.test", displayName: "Offline Creator", contactEmail: "creator@example.test", createdAt: Date.now(), updatedAt: Date.now() });
    const agentThreadId = await createThread(ctx, agentComponent, { title: client.name });
    return ctx.db.insert("interviews", { creatorId, agentThreadId, linkHash, linkTokenCiphertext: "unused", linkTokenIv: "unused", linkVersion: 1, projectName: client.name, clientLanguage: client.language, interviewKind: "website", includesVisualConcepts: true, model: "gpt-6.1-sol", instructions: recording.instructions, passState: "consumed", startedAt: Date.now(), passConsumedAt: Date.now(), createdAt: Date.now(), updatedAt: Date.now(), step: "interview", clientMessageCount: 0, documentRevisionCount: 0, concepts: [], operation: { kind: "interview_response", status: "pending", attempt: 0 }, usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 } });
  });
  const read = () => t.run((ctx) => ctx.db.get("interviews", interviewId));
  const run = async () => {
    await t.action(internal.jobs.runPending, { interviewId });
    const interview = await read();
    expect(interview?.operation, JSON.stringify({ operation: interview?.operation, concepts: interview?.concepts })).toBeUndefined();
    expect(interview?.promptVersion).toBe(PROMPT_VERSION);
  };
  await run();
  for (const message of recording.transcript.filter((m) => m.role === "user")) {
    vi.setSystemTime(Date.now() + 61_000);
    await t.mutation(api.client.sendMessage, { token, content: message.content });
    await run();
  }
  expect(turnIndex).toBe(recording.turns.length);
  expect(planCalls).toBe(1);
  expect(await read()).toMatchObject({ step: "review", projectDocument: recording.document });
  await t.mutation(api.client.requestDocumentChanges, { token, changes: client.revision });
  await run();
  expect(await read()).toMatchObject({ projectDocument: recording.revision, documentRevisionCount: 1 });
  vi.setSystemTime(Date.now() + 61_000);
  await t.mutation(api.client.continueToConcepts, { token });
  await run();
  expect(imageCalls).toBe(3);
  const afterConcepts = await read();
  expect(afterConcepts?.concepts.every((c) => c.status === "ready" && c.imageId)).toBe(true);
  const direction = { kind: "concept" as const, conceptId: "concept_1", note: "Use this concept within the confirmed constraints.", preferences: { keep: "Use the chosen concept as the rough style basis", avoid: "Do not change the confirmed constraints" } };
  await t.mutation(api.client.setVisualDirection, { token, direction });
  const submitted = await t.mutation(api.client.submit, { token, confirmVisualDirection: true });
  expect(submitted.created).toBe(true);
  expect(submitted.submission).toMatchObject({ projectDocument: recording.revision, visualDirection: direction });
  expect(await t.mutation(api.client.submit, { token })).toMatchObject({ created: false });
  await expect(t.mutation(api.client.sendMessage, { token, content: "change" })).rejects.toThrow("read-only");
  expect((await read())?.step).toBe("submitted");
}, 20_000);
