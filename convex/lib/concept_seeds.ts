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

export const parseConceptSeeds = (content: string, idOffset = 0): ConceptSeed[] => {
  let parsed: unknown;
  try {
    parsed = parseProviderJson(content);
  } catch {
    throw invalidConceptSeeds("CONCEPT_SEEDS_INVALID_JSON");
  }
  const concepts =
    Array.isArray(parsed)
      ? parsed
      : typeof parsed === "object" &&
          parsed !== null &&
          "concepts" in parsed &&
          Array.isArray(parsed.concepts)
        ? parsed.concepts
        : null;
  if (!concepts || concepts.length !== 3) {
    throw invalidConceptSeeds("CONCEPT_SEEDS_INVALID_SHAPE");
  }
  return concepts.map((value: unknown, index) => {
    if (typeof value !== "object" || value === null) {
      throw invalidConceptSeeds("CONCEPT_SEEDS_INVALID_SHAPE");
    }
    const concept = value as Record<string, unknown>;
    const name =
      typeof concept.name === "string"
        ? concept.name.trim()
        : typeof concept.title === "string"
          ? concept.title.trim()
          : "";
    const rationale =
      typeof concept.rationale === "string"
        ? concept.rationale.trim()
        : typeof concept.description === "string"
          ? concept.description.trim()
          : "";
    const prompt =
      typeof concept.prompt === "string"
        ? concept.prompt.trim()
        : typeof concept.imagePrompt === "string"
          ? concept.imagePrompt.trim()
          : typeof concept.image_prompt === "string"
            ? concept.image_prompt.trim()
            : "";
    if (!name || !rationale || !prompt) {
      throw invalidConceptSeeds("CONCEPT_SEEDS_INVALID_SHAPE");
    }
    return {
      id: `concept_${index + 1 + idOffset}`,
      name,
      rationale,
      prompt,
    };
  });
};
