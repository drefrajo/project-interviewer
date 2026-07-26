import { parseProviderJson } from "./provider_json";

export type ConceptSeed = {
  id: string;
  name: string;
  rationale: string;
  prompt: string;
};

const invalidConceptSeeds = (name: string) => {
  const error = new Error("Concept prompt generation returned an invalid result.");
  error.name = name;
  return error;
};

export const parseConceptSeeds = (content: string): ConceptSeed[] => {
  let parsed: { concepts?: Array<Partial<ConceptSeed>> };
  try {
    parsed = parseProviderJson(content);
  } catch {
    throw invalidConceptSeeds("CONCEPT_SEEDS_INVALID_JSON");
  }
  if (!Array.isArray(parsed.concepts) || parsed.concepts.length !== 3) {
    throw invalidConceptSeeds("CONCEPT_SEEDS_INVALID_SHAPE");
  }
  return parsed.concepts.map((concept, index) => {
    if (
      typeof concept.name !== "string" ||
      typeof concept.rationale !== "string" ||
      typeof concept.prompt !== "string"
    ) {
      throw invalidConceptSeeds("CONCEPT_SEEDS_INVALID_SHAPE");
    }
    return {
      id: `concept_${index + 1}`,
      name: concept.name,
      rationale: concept.rationale,
      prompt: concept.prompt,
    };
  });
};
