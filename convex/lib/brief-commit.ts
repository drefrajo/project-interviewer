import type {
  GenericDataModel,
  GenericMutationCtx,
} from "convex/server";
import type { GenericId } from "convex/values";
import type { AiOperationResult } from "./ai-contract";
import { asRecord, asString } from "./commit-values";
import { validateEvidenceSources } from "./evidence-validation";
import { canCommitBriefSnapshot } from "./production-boundaries";
import { serializeProjectBriefMarkdown } from "../../src/domain/project-brief-markdown";
import type { BriefDraft } from "../../src/domain/project-brief";

export const commitBrief = async (
  context: GenericMutationCtx<GenericDataModel>,
  operation: {
    roomId: GenericId<"projectRooms">;
    contextPackRevisionId?: unknown;
  },
  result: AiOperationResult,
  now: number,
) => {
  const room = await context.db.get(operation.roomId);
  if (!room) throw new Error("Brief room not found.");
  const [interview, contextPack] = await Promise.all([
    context.db
      .query("discoveryInterviews")
      .withIndex("by_room", (query) =>
        query.eq("roomId", operation.roomId),
      )
      .first(),
    context.db
      .query("contextPackRevisions")
      .withIndex("by_room_created", (query) =>
        query.eq("roomId", operation.roomId),
      )
      .order("desc")
      .first(),
  ]);
  if (
    !canCommitBriefSnapshot({
      roomPhase: String(room.phase),
      ...(interview ? { interviewStatus: String(interview.status) } : {}),
      ...(operation.contextPackRevisionId
        ? {
            expectedContextPackId: String(
              operation.contextPackRevisionId,
            ),
          }
        : {}),
      ...(contextPack
        ? { latestContextPackId: String(contextPack._id) }
        : {}),
    })
  ) {
    throw new Error(
      "Brief generation requires the same completed discovery and Context Pack used at start.",
    );
  }
  const prior = await context.db
    .query("briefDrafts")
    .withIndex("by_room_revision", (query) =>
      query.eq("roomId", operation.roomId),
    )
    .collect();
  const validateSources = (raw: unknown) =>
    validateEvidenceSources(context, operation.roomId, raw, {
      allowProjectDescription: true,
    });
  const sections = await Promise.all(
    (Array.isArray(result.value.sections)
      ? result.value.sections
      : []
    ).map(async (item, sectionIndex) => {
      const section = asRecord(item);
      const content = asString(section.content, "");
      const sources = await validateSources(section.sources);
      if (content.trim() && !sources.length) {
        throw new Error("Substantive Brief section content needs a source.");
      }
      const rawItems = Array.isArray(section.items) ? section.items : [];
      return {
        id: asString(section.id, `section_${sectionIndex + 1}`),
        title: asString(section.title, `Section ${sectionIndex + 1}`),
        content,
        sources,
        items: await Promise.all(
          rawItems.map(async (rawItem, itemIndex) => {
            const briefItem = asRecord(rawItem);
            const itemSources = await validateSources(briefItem.sources);
            if (!itemSources.length) {
              throw new Error("Every Brief item needs a source.");
            }
            const kind = [
              "requirement",
              "target",
              "parameter",
              "assumption",
              "risk",
              "gap",
              "contradiction",
              "decision",
            ].includes(String(briefItem.kind))
              ? String(briefItem.kind)
              : "gap";
            return {
              id: asString(
                briefItem.id,
                `item_${sectionIndex + 1}_${itemIndex + 1}`,
              ),
              sectionId: asString(
                section.id,
                `section_${sectionIndex + 1}`,
              ),
              kind,
              text: asString(briefItem.text, ""),
              ...(typeof briefItem.scopeStatus === "string"
                ? { scopeStatus: briefItem.scopeStatus }
                : {}),
              priority:
                typeof briefItem.priority === "string"
                  ? briefItem.priority
                  : null,
              sources: itemSources,
              ...(typeof briefItem.findingId === "string"
                ? { findingId: briefItem.findingId }
                : {}),
              authoredBy: "generator" as const,
              ...(kind === "requirement"
                ? { requirementState: "candidate" as const }
                : {}),
              order: itemIndex,
              createdAt: now,
              updatedAt: now,
            };
          }),
        ),
      };
    }),
  );
  const warnings = (Array.isArray(result.value.warnings)
    ? result.value.warnings
    : []
  ).map((item, index) => {
    const warning = asRecord(item);
    return {
      id: asString(warning.id, `warning_${index + 1}`),
      category: [
        "feasibility",
        "scope",
        "budget",
        "timeline",
        "responsibility",
        "critical_gap",
        "contradiction",
      ].includes(String(warning.category))
        ? String(warning.category)
        : "critical_gap",
      message: asString(warning.message, "Review this unresolved gap."),
      subjectId: asString(warning.subjectId, `warning_${index + 1}`),
      status: "unresolved" as const,
      updatedAt: now,
    };
  });
  const language = room.briefLanguage === "de" ? "de" : "en";
  await context.db.insert("briefDrafts", {
    roomId: operation.roomId,
    revision: prior.length + 1,
    language,
    status: "editing",
    sections,
    markdown: serializeProjectBriefMarkdown({
      language,
      sections: sections as unknown as BriefDraft["sections"],
    }),
    warnings,
    createdAt: now,
    updatedAt: now,
  });
  await context.db.patch(operation.roomId, {
    phase: "freelancer_review",
    updatedAt: now,
    lastActivityAt: now,
  });
};
