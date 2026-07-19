import type {
  GenericDataModel,
  GenericMutationCtx,
} from "convex/server";
import type { GenericId, Value } from "convex/values";
import type { AiOperationResult } from "./ai_contract";
import { asRecord, asString, asStrings } from "./commit_values";
import { rebuildContextPack } from "./context_pack_commit";

type AnalysisExtraction = NonNullable<AiOperationResult["extraction"]>;
type AnalysisLocator = AnalysisExtraction["chunks"][number]["locator"];

const canonicalImageLocator = {
  kind: "image" as const,
  label: "Image 1",
  image: 1,
};

export const authorizedSourceLocators = (
  extraction: Pick<AnalysisExtraction, "actualContentType" | "chunks">,
): string[] => [
  ...extraction.chunks.map(({ locator }) => JSON.stringify(locator)),
  ...(extraction.actualContentType.startsWith("image/")
    ? [JSON.stringify({ kind: "image", label: "Image 1", image: 1 })]
    : []),
];

export const normalizeAuthorizedSourceLocator = (
  raw: unknown,
  extraction: Pick<AnalysisExtraction, "actualContentType" | "chunks">,
): AnalysisLocator | null => {
  const rawJson = JSON.stringify(raw);
  const exactChunk = extraction.chunks.find(
    ({ locator }) => JSON.stringify(locator) === rawJson,
  );
  if (exactChunk) return exactChunk.locator;
  const candidate = asRecord(raw);
  const imageNumber = candidate.image;
  const pageNumber = candidate.page;
  if (
    extraction.actualContentType.startsWith("image/") &&
    ((candidate.kind === "image" &&
      (imageNumber === undefined || imageNumber === 0 || imageNumber === 1)) ||
      (candidate.kind === "page" &&
        (pageNumber === undefined || pageNumber === 0 || pageNumber === 1)))
  ) {
    return canonicalImageLocator;
  }
  const matchingChunk = extraction.chunks.find(({ locator }) => {
    const sourceLocator = asRecord(locator);
    const candidateKind = candidate.kind;
    if (candidateKind !== sourceLocator.kind) return false;
    switch (sourceLocator.kind) {
      case "page":
        return candidate.page === sourceLocator.page;
      case "slide":
        return candidate.slide === sourceLocator.slide;
      case "sheet":
        return (
          candidate.sheet === sourceLocator.sheet &&
          (candidate.range === undefined ||
            candidate.range === sourceLocator.range)
        );
      case "paragraph":
        return (
          candidate.paragraph === sourceLocator.paragraph ||
          (candidate.paragraph === undefined &&
            extraction.chunks.filter(
              ({ locator: candidateLocator }) =>
                asRecord(candidateLocator).kind === "paragraph",
            ).length === 1)
        );
      case "text_range":
        return (
          candidate.start === sourceLocator.start &&
          candidate.end === sourceLocator.end
        );
      case "image":
        return candidate.image === sourceLocator.image;
    }
  });
  if (matchingChunk) return matchingChunk.locator;
  return null;
};

export const commitFileAnalysis = async (
  context: GenericMutationCtx<GenericDataModel>,
  operation: Record<string, unknown> & {
    _id: GenericId<"durableOperations">;
    roomId: GenericId<"projectRooms">;
  },
  subjectId: string,
  result: AiOperationResult,
  now: number,
) => {
  const materialId = context.db.normalizeId("projectMaterials", subjectId);
  if (!materialId) throw new Error("File-analysis subject is invalid.");
  const material = await context.db.get(materialId);
  if (!material || material.roomId !== operation.roomId || !result.extraction) {
    throw new Error("File-analysis subject or extraction is missing.");
  }
  const room = await context.db.get(operation.roomId);
  if (!room) throw new Error("File-analysis Project Room not found.");
  const extraction = result.extraction;
  if (
    result.extraction.chunks.some(
      ({ embedding }) => embedding.length !== 1536,
    )
  ) {
    throw new Error("Embedding dimension does not match the configured index.");
  }
  const priorChunks = await context.db
    .query("materialChunks")
    .withIndex("by_material", (query) => query.eq("materialId", materialId))
    .collect();
  await Promise.all(
    priorChunks
      .filter((chunk) => chunk.active)
      .map((chunk) => {
        const chunkId = context.db.normalizeId(
          "materialChunks",
          String(chunk._id),
        );
        return chunkId
          ? context.db.patch(chunkId, { active: false })
          : Promise.resolve();
      }),
  );
  for (const chunk of result.extraction.chunks) {
    await context.db.insert("materialChunks", {
      roomId: operation.roomId,
      materialId,
      text: chunk.text,
      locator: chunk.locator as Value,
      language: result.extraction.language,
      embedding: chunk.embedding,
      active: true,
      createdAt: now,
    });
  }
  const priorAnalyses = await context.db
    .query("fileAnalyses")
    .withIndex("by_material", (query) => query.eq("materialId", materialId))
    .collect();
  const value = result.value;
  const validateLocator = (raw: unknown): Value => {
    const locator = normalizeAuthorizedSourceLocator(raw, extraction);
    if (!locator) {
      throw new Error("File Analysis returned an unauthorized source locator.");
    }
    return locator as Value;
  };
  const summarySources = Array.isArray(value.summarySources)
    ? value.summarySources.map(validateLocator)
    : [];
  if (!summarySources.length) {
    throw new Error("File Analysis summary requires a source locator.");
  }
  const signals = (Array.isArray(value.signals) ? value.signals : []).map(
    (rawSignal) => {
      const signal = asRecord(rawSignal);
      return {
        text: asString(signal.text, ""),
        locator: validateLocator(signal.locator),
      } as Value;
    },
  );
  const summaryLanguage = value.summaryLanguage === "de" ? "de" : "en";
  if (summaryLanguage !== room.briefLanguage) {
    throw new Error(
      `File Analysis must use the Project Brief Language (${room.briefLanguage}).`,
    );
  }
  await context.db.insert("fileAnalyses", {
    roomId: operation.roomId,
    materialId,
    summary: asString(value.summary, "No reliable summary was produced."),
    summaryLanguage,
    analysisVersion: priorAnalyses.length + 1,
    summarySources,
    primaryCategory: asString(value.primaryCategory, "brief"),
    secondaryCategories: asStrings(value.secondaryCategories),
    confidence:
      typeof value.confidence === "number" ? value.confidence : 0.5,
    language: result.extraction.language,
    signals,
    model: result.metadata.model,
    provider: result.metadata.provider,
    processingVersion: "material-processing-v1",
    schemaVersion: "file-analysis-v1",
    promptVersion: "software-project-file-analysis-v1",
    extractionMethod: result.extraction.method,
    analyzedAt: now,
  });
  await context.db.patch(materialId, {
    state: "analyzed",
    stage: "complete",
    actualContentType: result.extraction.actualContentType,
    extractionMethod: result.extraction.method,
    retryAvailable: false,
    updatedAt: now,
  });
  const contextPack = await rebuildContextPack(context, {
    roomId: operation.roomId,
    reason: "material_analyzed",
    subjectMaterialId: materialId,
    now,
  });
  const interview = await context.db
    .query("discoveryInterviews")
    .withIndex("by_room_purge", (query) =>
      query.eq("roomId", operation.roomId),
    )
    .first();
  if (interview && typeof interview._id === "string") {
    const contextPackId = context.db.normalizeId(
      "contextPackRevisions",
      contextPack.id,
    );
    if (!contextPackId) {
      throw new Error("Context Pack Revision id is invalid.");
    }
    await context.db.insert("interviewEvents", {
      roomId: operation.roomId,
      interviewId: interview._id as GenericId<"discoveryInterviews">,
      eventType: "project_material_added",
      materialId,
      contextPackRevisionId: contextPackId,
      contextPackRevision: contextPack.revision,
      createdAt: now,
    });
  }
};
