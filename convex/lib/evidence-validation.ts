import type {
  GenericDataModel,
  GenericMutationCtx,
} from "convex/server";
import type { GenericId, Value } from "convex/values";
import { asRecord, asString } from "./commit-values";

export const validateEvidenceSources = async (
  context: GenericMutationCtx<GenericDataModel>,
  roomId: GenericId<"projectRooms">,
  raw: unknown,
  options: { allowProjectDescription: boolean },
): Promise<Value[]> => {
  const sources = Array.isArray(raw) ? raw : [];
  for (const item of sources) {
    const source = asRecord(item);
    if (
      source.type === "project_description" &&
      options.allowProjectDescription
    ) {
      continue;
    }
    if (source.type === "model_inference") {
      if (!asString(source.description, "").trim()) {
        throw new Error("Model inference source is empty.");
      }
      continue;
    }
    const tableAndId =
      source.type === "turn"
        ? (["interviewTurns", source.turnId] as const)
        : source.type === "correction"
          ? (["interviewCorrections", source.correctionId] as const)
          : source.type === "analysis_feedback"
            ? (["analysisFeedback", source.feedbackId] as const)
            : source.type === "material"
              ? (["projectMaterials", source.materialId] as const)
              : null;
    if (!tableAndId || typeof tableAndId[1] !== "string") {
      throw new Error("Evidence source type is invalid.");
    }
    const id = context.db.normalizeId(tableAndId[0], tableAndId[1]);
    const document = id ? await context.db.get(id) : null;
    if (!document || document.roomId !== roomId) {
      throw new Error("Evidence source does not belong to the Project Room.");
    }
    if (source.type === "material") {
      if (document.active !== true) {
        throw new Error("Material evidence is no longer active.");
      }
      const chunks = await context.db
        .query("materialChunks")
        .withIndex("by_material", (query) =>
          query.eq(
            "materialId",
            id as GenericId<"projectMaterials">,
          ),
        )
        .collect();
      if (
        !source.locator ||
        !chunks.some(
          (chunk) =>
            chunk.active === true &&
            JSON.stringify(chunk.locator) ===
            JSON.stringify(source.locator),
        )
      ) {
        throw new Error("Material source locator is invalid.");
      }
    }
  }
  return sources as Value[];
};
