import { describe, expect, it } from "vitest";
import { buildStagedMaterialEvidence } from "./staged-material-retrieval";

const locator = {
  kind: "paragraph" as const,
  label: "Paragraph 4",
  paragraph: 4,
};

describe("staged Project Material retrieval", () => {
  it("presents the four application-owned retrieval stages in order", () => {
    const evidence = buildStagedMaterialEvidence({
      materials: [
        {
          id: "material-1",
          name: "requirements.pdf",
          state: "analyzed",
          active: true,
        },
      ],
      summaries: [
        {
          materialId: "material-1",
          summary: "A German-language commerce rebuild.",
          sources: [locator],
        },
      ],
      matches: [
        {
          id: "chunk-1",
          materialId: "material-1",
          materialName: "requirements.pdf",
          text: "Checkout must support guest purchases and saved baskets.",
          locator,
        },
      ],
    });

    expect(evidence.stages.map((stage) => stage.tool)).toEqual([
      "list_project_material",
      "get_file_summaries",
      "search_source_excerpts",
      "inspect_bounded_content",
    ]);
    expect(evidence.stages[2]?.results[0]).toMatchObject({
      materialId: "material-1",
      locator,
    });
    expect(evidence.untrustedEvidence).toBe(true);
  });

  it("excludes inactive records and bounds excerpts and inspection", () => {
    const veryLongText = "x".repeat(4_000);
    const evidence = buildStagedMaterialEvidence({
      materials: [
        {
          id: "active",
          name: "active.md",
          state: "analyzed",
          active: true,
        },
        {
          id: "removed",
          name: "removed.md",
          state: "analyzed",
          active: false,
        },
      ],
      summaries: [
        {
          materialId: "active",
          summary: veryLongText,
          sources: [locator],
        },
        {
          materialId: "removed",
          summary: "must not leak",
          sources: [locator],
        },
      ],
      matches: Array.from({ length: 12 }, (_, index) => ({
        id: `chunk-${index}`,
        materialId: index === 11 ? "removed" : "active",
        materialName: index === 11 ? "removed.md" : "active.md",
        text: veryLongText,
        locator,
      })),
    });

    const serialized = JSON.stringify(evidence);
    expect(serialized).not.toContain("must not leak");
    expect(serialized).not.toContain("removed.md");
    expect(evidence.stages[1]?.results[0]?.summary).toHaveLength(1_200);
    expect(evidence.stages[2]?.results).toHaveLength(8);
    expect(evidence.stages[2]?.results[0]?.text).toHaveLength(320);
    expect(evidence.stages[3]?.results).toHaveLength(3);
    expect(evidence.stages[3]?.results[0]?.text).toHaveLength(1_200);
  });
});
