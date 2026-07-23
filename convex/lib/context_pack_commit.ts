import type {
  GenericDataModel,
  GenericMutationCtx,
} from "convex/server";
import type { GenericId, Value } from "convex/values";
import type { ContextPackRevision } from "../../src/domain/project-material";

export type ContextRevisionReason =
  | ContextPackRevision["reason"]
  | "file_analysis_completed";

export const normalizeContextRevisionReason = (
  reason: ContextRevisionReason,
): ContextPackRevision["reason"] =>
  reason === "file_analysis_completed" ? "material_analyzed" : reason;

export const rebuildContextPack = async (
  context: GenericMutationCtx<GenericDataModel>,
  input: {
    roomId: GenericId<"projectRooms">;
    reason: ContextRevisionReason;
    subjectMaterialId?: GenericId<"projectMaterials">;
    now?: number;
  },
): Promise<ContextPackRevision> => {
  const [materials, analyses, feedback, previous] = await Promise.all([
    context.db
      .query("projectMaterials")
      .withIndex("by_room_active", (query) =>
        query.eq("roomId", input.roomId),
      )
      .collect(),
    context.db
      .query("fileAnalyses")
      .withIndex("by_room", (query) => query.eq("roomId", input.roomId))
      .collect(),
    context.db
      .query("analysisFeedback")
      .withIndex("by_room", (query) => query.eq("roomId", input.roomId))
      .collect(),
    context.db
      .query("contextPackRevisions")
      .withIndex("by_room_created", (query) =>
        query.eq("roomId", input.roomId),
      )
      .order("desc")
      .first(),
  ]);
  const activeRecords = materials.filter((material) => material.active);
  const active = activeRecords.filter(
    (material) => material.active && material.state === "analyzed",
  );
  const activeMaterialIds = new Set(
    active.map((material) => String(material._id)),
  );
  const summaries = active.flatMap((material) => {
    const analysis = analyses
      .filter((candidate) => candidate.materialId === material._id)
      .sort(
        (left, right) =>
          Number(right.analysisVersion) - Number(left.analysisVersion),
      )[0];
    return analysis
      ? [
          {
            materialId: String(material._id),
            fileName: String(material.name),
            summary: String(analysis.summary),
            summaryLanguage:
              analysis.summaryLanguage === "de" ? ("de" as const) : ("en" as const),
            summarySources: (Array.isArray(analysis.summarySources)
              ? analysis.summarySources
              : []) as ContextPackRevision["materialSummaries"][number]["summarySources"],
            analysisId: String(analysis._id),
            analysisVersion: Number(analysis.analysisVersion),
            category: String(
              analysis.primaryCategory,
            ) as ContextPackRevision["materialSummaries"][number]["category"],
            confidence: Number(analysis.confidence),
            signals: (Array.isArray(analysis.signals)
              ? analysis.signals
              : []) as ContextPackRevision["materialSummaries"][number]["signals"],
            available: true,
          },
        ]
      : [];
  });
  const normalizedFeedback = feedback
    .filter((item) => activeMaterialIds.has(String(item.materialId)))
    .map((item) => ({
      id: String(item._id),
      roomId: String(item.roomId),
      materialId: String(item.materialId),
      explanation: String(item.explanation),
      actorKind:
        item.actorKind === "client"
          ? ("client" as const)
          : ("freelancer" as const),
      ...(item.deviceHash ? { deviceId: String(item.deviceHash) } : {}),
      ...(item.locator
        ? {
            locator:
              item.locator as ContextPackRevision["feedback"][number]["locator"],
          }
        : {}),
      createdAt: Number(item.createdAt),
    }));
  const now = input.now ?? Date.now();
  const revision =
    (previous && typeof previous.revision === "number"
      ? previous.revision
      : 0) + 1;
  const likelyProjectType =
    summaries[0] && summaries[0].category !== "other"
      ? summaries[0].category
      : null;
  const globalProjectSummary = summaries.length
    ? summaries.map(({ summary }) => summary).join(" ")
    : "No analyzed Project Material is available.";
  const notableSignals = summaries
    .flatMap(({ signals }) => signals)
    .slice(0, 8);
  const id = await context.db.insert("contextPackRevisions", {
    roomId: input.roomId,
    revision,
    reason: normalizeContextRevisionReason(input.reason),
    ...(input.subjectMaterialId
      ? { subjectMaterialId: input.subjectMaterialId }
      : {}),
    globalProjectSummary,
    ...(likelyProjectType ? { likelyProjectType } : {}),
    notableSignals: notableSignals as Value[],
    includedMaterialIds: active.map(
      (material) =>
        String(material._id) as GenericId<"projectMaterials">,
    ),
    materialSummaries: summaries as unknown as Value[],
    feedback: normalizedFeedback as unknown as Value[],
    minimalContextWarning: summaries.length === 0,
    createdAt: now,
  });
  await context.db.patch(input.roomId, {
    interviewReadiness: activeRecords.every(
      (material) =>
        material.state === "analyzed" ||
        material.state === "failed" ||
        material.state === "unsupported",
    )
      ? "ready"
      : "waiting_for_material",
    lastActivityAt: now,
    updatedAt: now,
  });
  return {
    id: String(id),
    roomId: String(input.roomId),
    revision,
    reason: normalizeContextRevisionReason(input.reason),
    ...(input.subjectMaterialId
      ? { subjectMaterialId: String(input.subjectMaterialId) }
      : {}),
    globalProjectSummary,
    likelyProjectType,
    notableSignals,
    includedMaterialIds: active.map((material) => String(material._id)),
    materialSummaries: summaries,
    feedback: normalizedFeedback,
    minimalContextWarning: summaries.length === 0,
    createdAt: now,
  };
};
