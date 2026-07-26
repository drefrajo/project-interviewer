import { describe, expect, it } from "vitest";
import { parseConceptSeeds } from "./concept_seeds";

const concepts = [
  { name: "Editorial", rationale: "Clear hierarchy", prompt: "Editorial site" },
  { name: "Technical", rationale: "Precise details", prompt: "Technical site" },
  { name: "Human", rationale: "Warm and direct", prompt: "Human site" },
];

describe("parseConceptSeeds", () => {
  it("parses three concepts from bare JSON", () => {
    expect(parseConceptSeeds(JSON.stringify({ concepts }))).toHaveLength(3);
  });

  it("parses three concepts from a fenced DeepSeek response", () => {
    const response = `\`\`\`json
${JSON.stringify({ concepts }, null, 2)}
\`\`\``;

    expect(parseConceptSeeds(response)).toEqual([
      { id: "concept_1", ...concepts[0] },
      { id: "concept_2", ...concepts[1] },
      { id: "concept_3", ...concepts[2] },
    ]);
  });

  it("names malformed JSON failures", () => {
    expect(() => parseConceptSeeds("{")).toThrow(
      expect.objectContaining({ name: "CONCEPT_SEEDS_INVALID_JSON" }),
    );
  });

  it("names schema mismatches", () => {
    expect(() => parseConceptSeeds(JSON.stringify(concepts))).toThrow(
      expect.objectContaining({ name: "CONCEPT_SEEDS_INVALID_SHAPE" }),
    );
  });
});
