import type { ConceptSeed } from "./concept_seeds";

export type GeneratedConcept<ImageId> = ConceptSeed & {
  imageId?: ImageId;
  status: "pending" | "ready" | "failed";
  errorCode?: string;
};

export const generateConceptsInParallel = async <ImageId>(
  seeds: ReadonlyArray<ConceptSeed>,
  existingConcepts: ReadonlyMap<string, GeneratedConcept<ImageId>>,
  generateAndStore: (seed: ConceptSeed) => Promise<ImageId>,
) => {
  const attempts = seeds.map((seed): Promise<GeneratedConcept<ImageId>> => {
    const prior = existingConcepts.get(seed.id);
    if (prior?.status === "ready") return Promise.resolve(prior);
    return generateAndStore(seed).then((imageId) => ({
      ...seed,
      imageId,
      status: "ready" as const,
    }));
  });
  const settled = await Promise.allSettled(attempts);
  const concepts = settled.map<GeneratedConcept<ImageId>>((result, index) => {
    if (result.status === "fulfilled") return result.value;
    const seed = seeds[index];
    if (!seed) throw new Error("Concept generation result has no seed.");
    return {
      ...seed,
      status: "failed",
      errorCode: "IMAGE_GENERATION_FAILED",
    };
  });
  return {
    concepts,
    hasFailure: concepts.some((concept) => concept.status === "failed"),
  };
};
