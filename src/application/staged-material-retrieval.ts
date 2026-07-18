import type { SourceLocator } from "../domain/project-material";

export interface RetrievalMaterial {
  id: string;
  name: string;
  state: string;
  active: boolean;
}

export interface RetrievalSummary {
  materialId: string;
  summary: string;
  sources: SourceLocator[];
}

export interface RetrievalMatch {
  id: string;
  materialId: string;
  materialName: string;
  text: string;
  locator: SourceLocator;
}

interface ListedMaterial {
  materialId: string;
  name: string;
  state: string;
}

interface BoundedSummary {
  materialId: string;
  summary: string;
  sources: SourceLocator[];
}

interface BoundedMatch {
  chunkId: string;
  materialId: string;
  materialName: string;
  text: string;
  locator: SourceLocator;
}

export interface StagedMaterialEvidence {
  untrustedEvidence: true;
  stages: [
    { tool: "list_project_material"; results: ListedMaterial[] },
    { tool: "get_file_summaries"; results: BoundedSummary[] },
    { tool: "search_source_excerpts"; results: BoundedMatch[] },
    { tool: "inspect_bounded_content"; results: BoundedMatch[] },
  ];
}

const boundedText = (value: string, characters: number) =>
  value.slice(0, characters);

export const decodeSourceLocator = (
  value: unknown,
): SourceLocator | undefined => {
  if (typeof value !== "object" || value === null) return undefined;
  const locator = value as Record<string, unknown>;
  if (typeof locator.label !== "string") return undefined;
  switch (locator.kind) {
    case "page":
      return typeof locator.page === "number"
        ? { kind: "page", label: locator.label, page: locator.page }
        : undefined;
    case "slide":
      return typeof locator.slide === "number"
        ? { kind: "slide", label: locator.label, slide: locator.slide }
        : undefined;
    case "sheet":
      return typeof locator.sheet === "string"
        ? {
            kind: "sheet",
            label: locator.label,
            sheet: locator.sheet,
            ...(typeof locator.range === "string"
              ? { range: locator.range }
              : {}),
          }
        : undefined;
    case "image":
      return typeof locator.image === "number"
        ? { kind: "image", label: locator.label, image: locator.image }
        : undefined;
    case "paragraph":
      return {
        kind: "paragraph",
        label: locator.label,
        ...(typeof locator.paragraph === "number"
          ? { paragraph: locator.paragraph }
          : {}),
      };
    case "text_range":
      return typeof locator.start === "number" &&
        typeof locator.end === "number"
        ? {
            kind: "text_range",
            label: locator.label,
            start: locator.start,
            end: locator.end,
          }
        : undefined;
    default:
      return undefined;
  }
};

/**
 * Shapes database-owned retrieval results for an Interview Agent request.
 *
 * The database query is responsible for room isolation. This seam additionally
 * drops inactive material and enforces prompt-size limits before any material
 * reaches a model.
 */
export const buildStagedMaterialEvidence = (input: {
  materials: RetrievalMaterial[];
  summaries: RetrievalSummary[];
  matches: RetrievalMatch[];
}): StagedMaterialEvidence => {
  const activeIds = new Set(
    input.materials
      .filter((material) => material.active)
      .map((material) => material.id),
  );
  const listed = input.materials
    .filter((material) => material.active)
    .slice(0, 20)
    .map((material) => ({
      materialId: material.id,
      name: material.name,
      state: material.state,
    }));
  const summaries = input.summaries
    .filter((summary) => activeIds.has(summary.materialId))
    .slice(0, 12)
    .map((summary) => ({
      materialId: summary.materialId,
      summary: boundedText(summary.summary, 1_200),
      sources: summary.sources.slice(0, 4),
    }));
  const activeMatches = input.matches.filter((match) =>
    activeIds.has(match.materialId),
  );
  const mapMatch = (match: RetrievalMatch, characters: number) => ({
    chunkId: match.id,
    materialId: match.materialId,
    materialName: match.materialName,
    text: boundedText(match.text, characters),
    locator: match.locator,
  });

  return {
    untrustedEvidence: true,
    stages: [
      { tool: "list_project_material", results: listed },
      { tool: "get_file_summaries", results: summaries },
      {
        tool: "search_source_excerpts",
        results: activeMatches
          .slice(0, 8)
          .map((match) => mapMatch(match, 320)),
      },
      {
        tool: "inspect_bounded_content",
        results: activeMatches
          .slice(0, 3)
          .map((match) => mapMatch(match, 1_200)),
      },
    ],
  };
};
