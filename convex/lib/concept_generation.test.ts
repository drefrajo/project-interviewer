import { describe, expect, it } from "vitest";
import type { ConceptSeed } from "./concept_seeds";
import { generateConceptsInParallel } from "./concept_generation";

const seeds: ConceptSeed[] = [
  { id: "concept_1", name: "One", rationale: "First", prompt: "Prompt 1" },
  { id: "concept_2", name: "Two", rationale: "Second", prompt: "Prompt 2" },
  { id: "concept_3", name: "Three", rationale: "Third", prompt: "Prompt 3" },
];

describe("generateConceptsInParallel", () => {
  it("starts all missing images concurrently and preserves concept order", async () => {
    const started: string[] = [];
    const finish = new Map<string, (imageId: string) => void>();
    const generation = generateConceptsInParallel(
      seeds,
      new Map(),
      (seed) =>
        new Promise<string>((resolve) => {
          started.push(seed.id);
          finish.set(seed.id, resolve);
        }),
    );

    await Promise.resolve();
    expect(started).toEqual(["concept_1", "concept_2", "concept_3"]);

    finish.get("concept_3")?.("image_3");
    finish.get("concept_1")?.("image_1");
    finish.get("concept_2")?.("image_2");

    await expect(generation).resolves.toMatchObject({
      concepts: [
        { id: "concept_1", imageId: "image_1", status: "ready" },
        { id: "concept_2", imageId: "image_2", status: "ready" },
        { id: "concept_3", imageId: "image_3", status: "ready" },
      ],
      hasFailure: false,
    });
  });

  it("reuses ready images and retries only failed concepts", async () => {
    const existing = new Map([
      [
        "concept_1",
        {
          ...seeds[0]!,
          imageId: "image_1",
          status: "ready" as const,
        },
      ],
    ]);
    const firstCalls: string[] = [];
    const first = await generateConceptsInParallel(
      seeds,
      existing,
      async (seed) => {
        firstCalls.push(seed.id);
        if (seed.id === "concept_3") throw new Error("temporary failure");
        return "image_2";
      },
    );

    expect(firstCalls).toEqual(["concept_2", "concept_3"]);
    expect(first).toMatchObject({
      concepts: [
        { id: "concept_1", imageId: "image_1", status: "ready" },
        { id: "concept_2", imageId: "image_2", status: "ready" },
        {
          id: "concept_3",
          status: "failed",
          errorCode: "IMAGE_GENERATION_FAILED",
        },
      ],
      hasFailure: true,
    });

    const retryCalls: string[] = [];
    const retry = await generateConceptsInParallel(
      seeds,
      new Map(first.concepts.map((concept) => [concept.id, concept])),
      async (seed) => {
        retryCalls.push(seed.id);
        return "image_3";
      },
    );

    expect(retryCalls).toEqual(["concept_3"]);
    expect(retry).toMatchObject({
      concepts: [
        { id: "concept_1", imageId: "image_1", status: "ready" },
        { id: "concept_2", imageId: "image_2", status: "ready" },
        { id: "concept_3", imageId: "image_3", status: "ready" },
      ],
      hasFailure: false,
    });
  });
});
