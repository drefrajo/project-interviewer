import {
  mutationGeneric,
  queryGeneric,
  type GenericDataModel,
  type GenericMutationCtx,
} from "convex/server";
import { v, type GenericId, type Value } from "convex/values";
import type {
  BriefChangeRequest,
  BriefDraft,
  BriefSectionId,
  BriefSource,
  ReviewVersion,
} from "../src/domain/project-brief";
import { briefSourceKey } from "../src/domain/project-brief";
import {
  replaceProjectBriefMarkdown,
  serializeProjectBriefMarkdown,
} from "../src/domain/project-brief-markdown";
import { briefSourceValidator } from "./lib/value_validators";
import {
  requireFreelancerRoom,
  requireRoomActorFromSession,
  requireWritableClientRoom,
  requireWritableFreelancerRoom,
} from "./lib/server_authorization";
import { recordAudit } from "./lib/audit";
import { canCommitBriefSnapshot } from "./lib/production_boundaries";

const roomActorArgs = {
  roomId: v.id("projectRooms"),
  sessionHash: v.optional(v.string()),
};

type StoredDraft = Omit<BriefDraft, "id" | "roomId" | "markdown"> & {
  _id: GenericId<"briefDrafts">;
  roomId: GenericId<"projectRooms">;
  markdown?: string;
};
type StoredReview = Omit<
  ReviewVersion,
  "id" | "roomId" | "sourceDraftId" | "approval" | "markdown"
> & {
  _id: GenericId<"reviewVersions">;
  roomId: GenericId<"projectRooms">;
  sourceDraftId: GenericId<"briefDrafts">;
  markdown?: string;
  approval?: {
    displayName: string;
    deviceHash: string;
    approvedAt: number;
    agreedRequirementIds: string[];
  };
};
type StoredChangeRequest = Omit<
  BriefChangeRequest,
  "id" | "roomId" | "reviewVersionId"
> & {
  _id: GenericId<"briefChangeRequests">;
  roomId: GenericId<"projectRooms">;
  reviewVersionId: GenericId<"reviewVersions">;
};
type StoredOperation = {
  _id: GenericId<"durableOperations">;
  roomId: GenericId<"projectRooms">;
  operationType: string;
  idempotencyKey: string;
  status: string;
  stage: string;
  attemptCount: number;
  model?: string;
  provider?: string;
  promptVersion?: string;
  schemaVersion: string;
  contextPackRevisionId?: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
  latencyMs?: number;
  errorCode?: string;
  createdAt: number;
  updatedAt: number;
};

const briefEvidenceDetail = async (
  context: Parameters<typeof requireRoomActorFromSession>[0],
  roomId: GenericId<"projectRooms">,
  source: BriefSource,
) => {
  const room = await context.db.get(roomId);
  if (!room) return null;
  if (source.type === "project_description") {
    return { label: "Project Description", text: room.projectDescription };
  }
  if (source.type === "model_inference") {
    return { label: "Model inference", text: source.description };
  }
  if (source.type === "freelancer_edit") {
    return { label: "Freelancer-authored edit", text: source.description };
  }
  if (source.type === "turn") {
    const id = context.db.normalizeId("interviewTurns", source.turnId);
    const turn = id ? await context.db.get(id) : null;
    return turn?.roomId === roomId
      ? {
          label: `Interview Turn ${turn.sequence}`,
          text: turn.answer,
          sequence: turn.sequence,
        }
      : null;
  }
  if (source.type === "correction") {
    const id = context.db.normalizeId(
      "interviewCorrections",
      source.correctionId,
    );
    const correction = id ? await context.db.get(id) : null;
    return correction?.roomId === roomId
      ? {
          label: "Interview Correction",
          text: correction.correctedAnswer,
          reason: correction.reason,
        }
      : null;
  }
  if (source.type === "analysis_feedback") {
    const id = context.db.normalizeId(
      "analysisFeedback",
      source.feedbackId,
    );
    const feedback = id ? await context.db.get(id) : null;
    return feedback?.roomId === roomId
      ? {
          label: "Analysis Feedback",
          text: feedback.explanation,
          locator: JSON.stringify(feedback.locator),
        }
      : null;
  }
  const materialId = context.db.normalizeId(
    "projectMaterials",
    source.materialId,
  );
  const material = materialId ? await context.db.get(materialId) : null;
  if (
    !materialId ||
    !material ||
    material.roomId !== roomId ||
    !material.active
  ) {
    return null;
  }
  const chunks = await context.db
    .query("materialChunks")
    .withIndex("by_material", (query) =>
      query.eq("materialId", materialId),
    )
    .collect();
  const chunk = chunks.find(
    (candidate) =>
      candidate.active &&
      JSON.stringify(candidate.locator) === JSON.stringify(source.locator),
  );
  return chunk && typeof chunk.text === "string"
    ? {
        label: material.name,
        text: chunk.text.slice(0, 1_200),
        locator: source.locator.label,
      }
    : null;
};

const latestDraft = async (
  context: Parameters<typeof requireRoomActorFromSession>[0],
  roomId: Parameters<typeof requireRoomActorFromSession>[1],
): Promise<StoredDraft | null> =>
  context.db
    .query("briefDrafts")
    .withIndex("by_room_revision", (query) => query.eq("roomId", roomId))
    .order("desc")
    .first()
    .then((value) => value as unknown as StoredDraft | null);

const documentFor = (
  artifact: Pick<BriefDraft, "language" | "sections"> & {
    markdown?: string;
  },
) =>
  artifact.markdown?.trim() || serializeProjectBriefMarkdown(artifact);

const briefView = async (
  context: Parameters<typeof requireRoomActorFromSession>[0],
  roomId: Parameters<typeof requireRoomActorFromSession>[1],
  client: boolean,
) => {
  const [draft, reviewVersionValues, changeRequestValues, operationValues] =
    await Promise.all([
      latestDraft(context, roomId),
      context.db
        .query("reviewVersions")
        .withIndex("by_room_version", (query) => query.eq("roomId", roomId))
        .order("desc")
        .collect(),
      context.db
        .query("briefChangeRequests")
        .withIndex("by_room_status", (query) => query.eq("roomId", roomId))
        .order("desc")
        .collect(),
      context.db
        .query("durableOperations")
        .withIndex("by_room", (query) => query.eq("roomId", roomId))
        .order("desc")
        .collect(),
    ]);
  const reviewVersions =
    reviewVersionValues as unknown as StoredReview[];
  const changeRequests =
    changeRequestValues as unknown as StoredChangeRequest[];
  const operations = operationValues as unknown as StoredOperation[];
  const operation = operations.find(
    (candidate) => candidate.operationType === "brief_generation",
  );
  const mapDraft = (item: NonNullable<typeof draft>) => ({
    ...item,
    id: item._id,
    markdown: documentFor(item),
  });
  const reviews = reviewVersions.map((item) => ({
    ...item,
    id: item._id,
    sourceDraftId: String(item.sourceDraftId),
    markdown: documentFor(item),
    ...(item.approval
      ? {
          approval: {
            ...item.approval,
            deviceId: item.approval.deviceHash,
          },
        }
      : {}),
  }));
  const changes = changeRequests.map((item) => ({
    ...item,
    id: item._id,
    reviewVersionId: String(item.reviewVersionId),
  }));
  return {
    draft: client || !draft ? null : mapDraft(draft),
    visibleReviewVersion: reviews[0] ?? null,
    reviewVersions: reviews,
    changeRequests: changes,
    activeChangeRequest:
      changes.find((request) => request.status === "editing") ?? null,
    operation: operation
      ? {
          id: operation._id,
          roomId,
          operationType: "brief_generation",
          idempotencyKey: operation.idempotencyKey,
          status:
            operation.status === "failed"
              ? "retryable"
              : operation.status,
          stage:
            operation.status === "succeeded"
              ? "complete"
              : operation.stage === "validating"
                ? "validating"
                : "generating",
          attemptCount: operation.attemptCount,
          model: operation.model,
          provider: operation.provider,
          promptVersion:
            operation.promptVersion ??
            "software-project-brief-generator-v1",
          schemaVersion: operation.schemaVersion,
          contextPackRevisionId: operation.contextPackRevisionId,
          inputTokens: operation.inputTokens,
          outputTokens: operation.outputTokens,
          estimatedCostUsd: operation.estimatedCostUsd,
          errorCode: operation.errorCode,
          createdAt: operation.createdAt,
          updatedAt: operation.updatedAt,
        }
      : null,
  };
};

export const get = queryGeneric({
  args: roomActorArgs,
  handler: async (context, args) => {
    const actor = await requireRoomActorFromSession(
      context,
      args.roomId,
      args.sessionHash,
    );
    return briefView(context, args.roomId, actor.kind === "client");
  },
});

export const beginGeneration = mutationGeneric({
  args: {
    roomId: v.id("projectRooms"),
    idempotencyKey: v.string(),
  },
  handler: async (context, args) => {
    const { room } = await requireWritableFreelancerRoom(
      context,
      args.roomId,
    );
    const [interview, contextPack, draft, latestReview, operations] =
      await Promise.all([
        context.db
          .query("discoveryInterviews")
          .withIndex("by_room_purge", (query) =>
            query.eq("roomId", args.roomId),
          )
          .first(),
        context.db
          .query("contextPackRevisions")
          .withIndex("by_room_created", (query) =>
            query.eq("roomId", args.roomId),
          )
          .order("desc")
          .first(),
        latestDraft(context, args.roomId),
        context.db
          .query("reviewVersions")
          .withIndex("by_room_version", (query) =>
            query.eq("roomId", args.roomId),
          )
          .order("desc")
          .first(),
        context.db
          .query("durableOperations")
          .withIndex("by_room", (query) =>
            query.eq("roomId", args.roomId),
          )
          .collect(),
      ]);
    const existing = operations.find(
      (item) =>
        item.operationType === "brief_generation" &&
        item.idempotencyKey === args.idempotencyKey,
    );
    if (existing?.status === "succeeded") {
      return { operationId: existing._id, reused: true };
    }
    const contextPackId = contextPack ? String(contextPack._id) : undefined;
    if (
      !contextPackId ||
      !canCommitBriefSnapshot({
        roomPhase: room.phase,
        ...(interview
          ? { interviewStatus: String(interview.status) }
          : {}),
        expectedContextPackId: contextPackId,
        latestContextPackId: contextPackId,
      })
    ) {
      throw new Error("Complete discovery before generating a brief.");
    }
    const competingOperation = operations.find(
      (item) =>
        item.operationType === "brief_generation" &&
        item.idempotencyKey !== args.idempotencyKey &&
        (item.status === "pending" || item.status === "running"),
    );
    if (competingOperation) {
      throw new Error("Project Brief generation is already running.");
    }
    if (
      latestReview &&
      (latestReview.status === "awaiting_client" ||
        latestReview.status === "change_requested")
    ) {
      throw new Error(
        "Resolve the current Client review before generating another Project Brief.",
      );
    }
    if (draft?.status === "editing" && !existing) {
      throw new Error("An editable Project Brief Draft already exists.");
    }
    if (
      existing &&
      (existing.status === "pending" ||
        existing.status === "running" ||
        existing.status === "succeeded")
    ) {
      return { operationId: existing._id, reused: true };
    }
    const now = Date.now();
    if (existing) {
      if (Number(existing.attemptCount) >= 2) {
        throw new Error("The Brief generation retry limit has been reached.");
      }
      await context.db.patch(existing._id, {
        status: "pending",
        stage: "queued",
        attemptCount: existing.attemptCount + 1,
        workflowId: undefined,
        errorCode: undefined,
        contextPackRevisionId: contextPackId,
        updatedAt: now,
      });
      return { operationId: existing._id, reused: false };
    }
    const operationId = await context.db.insert("durableOperations", {
      roomId: args.roomId,
      operationType: "brief_generation",
      subjectId: String(args.roomId),
      idempotencyKey: args.idempotencyKey,
      status: "pending",
      stage: "queued",
      attemptCount: 1,
      promptVersion: "software-project-brief-generator-v1",
      schemaVersion: "project-brief-v1",
      contextPackRevisionId: contextPackId,
      createdAt: now,
      updatedAt: now,
    });
    return { operationId, reused: false };
  },
});

const requireEditableDraft = async (
  context: GenericMutationCtx<GenericDataModel>,
  roomId: Parameters<typeof requireFreelancerRoom>[1],
) => {
  await requireWritableFreelancerRoom(context, roomId);
  const draft = await latestDraft(context, roomId);
  if (!draft || draft.status !== "editing") {
    throw new Error("No editable Brief Draft is available.");
  }
  return draft;
};

const saveStructuredDraft = async (
  context: GenericMutationCtx<GenericDataModel>,
  draft: StoredDraft,
  sections: StoredDraft["sections"],
  updatedAt = Date.now(),
) => {
  await context.db.patch(draft._id, {
    sections: sections as unknown as Value,
    markdown: serializeProjectBriefMarkdown({
      language: draft.language,
      sections,
    }),
    updatedAt,
  });
};

const createDraftFromReview = async (
  context: GenericMutationCtx<GenericDataModel>,
  input: {
    roomId: GenericId<"projectRooms">;
    review: StoredReview;
    revision: number;
    now: number;
  },
) => {
  const sections = structuredClone(input.review.sections).map((section) => ({
    ...section,
    items: section.items.map((item) => ({
      ...item,
      ...(item.kind === "requirement"
        ? { requirementState: "candidate" as const }
        : {}),
    })),
  }));
  await context.db.insert("briefDrafts", {
    roomId: input.roomId,
    revision: input.revision,
    basedOnReviewVersionId: String(input.review._id),
    language: input.review.language,
    status: "editing",
    sections: sections as unknown as Value,
    markdown: serializeProjectBriefMarkdown({
      language: input.review.language,
      sections,
    }),
    warnings: [],
    createdAt: input.now,
    updatedAt: input.now,
  });
};

export const updateSection = mutationGeneric({
  args: {
    roomId: v.id("projectRooms"),
    sectionId: v.string(),
    content: v.string(),
    retainSourceKeys: v.optional(v.array(v.string())),
  },
  handler: async (context, args) => {
    const draft = await requireEditableDraft(context, args.roomId);
    const sections = structuredClone(draft.sections);
    const section = sections.find((item) => item.id === args.sectionId);
    if (!section) throw new Error("Brief section not found.");
    const content = args.content.trim();
    if (args.retainSourceKeys) {
      section.sources = section.sources.filter((source) =>
        args.retainSourceKeys!.includes(briefSourceKey(source)),
      );
    }
    if (content !== section.content) {
      section.sources.push({
        type: "freelancer_edit",
        editId: `edit_${crypto.randomUUID()}`,
        description: "Freelancer-authored section edit.",
      });
    }
    section.content = content;
    await saveStructuredDraft(context, draft, sections);
  },
});

export const updateMarkdown = mutationGeneric({
  args: { roomId: v.id("projectRooms"), markdown: v.string() },
  handler: async (context, args) => {
    const draft = await requireEditableDraft(context, args.roomId);
    const now = Date.now();
    const replacement = replaceProjectBriefMarkdown(draft, args.markdown, {
      nextId: (prefix) => `${prefix}_${crypto.randomUUID()}`,
      now,
    });
    await context.db.patch(draft._id, {
      sections: replacement.sections,
      markdown: replacement.markdown,
      updatedAt: now,
    });
  },
});

const itemInput = {
  sectionId: v.string(),
  kind: v.union(
    v.literal("requirement"),
    v.literal("target"),
    v.literal("parameter"),
    v.literal("assumption"),
    v.literal("risk"),
    v.literal("gap"),
    v.literal("contradiction"),
    v.literal("decision"),
  ),
  text: v.string(),
  scopeStatus: v.optional(
    v.union(
      v.literal("in_scope"),
      v.literal("out_of_scope"),
      v.literal("open"),
    ),
  ),
  priority: v.optional(v.union(v.string(), v.null())),
};

export const addItem = mutationGeneric({
  args: { roomId: v.id("projectRooms"), ...itemInput },
  handler: async (context, args) => {
    const draft = await requireEditableDraft(context, args.roomId);
    const sections = structuredClone(draft.sections);
    const section = sections.find((item) => item.id === args.sectionId);
    if (!section) throw new Error("Brief section not found.");
    if (!args.text.trim()) throw new Error("Brief item text is required.");
    const now = Date.now();
    section.items.push({
      id: `item_${crypto.randomUUID()}`,
      sectionId: args.sectionId as BriefSectionId,
      kind: args.kind,
      text: args.text.trim(),
      ...(args.scopeStatus ? { scopeStatus: args.scopeStatus } : {}),
      priority: args.priority ?? null,
      sources: [
        {
          type: "freelancer_edit",
          editId: `edit_${crypto.randomUUID()}`,
          description: "Freelancer-authored brief item.",
        },
      ],
      authoredBy: "freelancer",
      ...(args.kind === "requirement"
        ? { requirementState: "proposed" as const }
        : {}),
      order: section.items.length,
      createdAt: now,
      updatedAt: now,
    });
    await saveStructuredDraft(context, draft, sections, now);
  },
});

export const updateItem = mutationGeneric({
  args: {
    roomId: v.id("projectRooms"),
    itemId: v.string(),
    ...itemInput,
    retainSourceKeys: v.optional(v.array(v.string())),
  },
  handler: async (context, args) => {
    const draft = await requireEditableDraft(context, args.roomId);
    const sections = structuredClone(draft.sections);
    const priorSection = sections.find((section) =>
      section.items.some((item) => item.id === args.itemId),
    );
    const item = priorSection?.items.find(
      (candidate) => candidate.id === args.itemId,
    );
    const destination = sections.find(
      (section) => section.id === args.sectionId,
    );
    if (!priorSection || !item || !destination) {
      throw new Error("Brief item not found.");
    }
    if (!args.text.trim()) throw new Error("Brief item text is required.");
    priorSection.items = priorSection.items.filter(
      (candidate) => candidate.id !== args.itemId,
    );
    item.sectionId = args.sectionId as BriefSectionId;
    item.kind = args.kind;
    const text = args.text.trim();
    if (args.scopeStatus) item.scopeStatus = args.scopeStatus;
    else delete item.scopeStatus;
    item.priority = args.priority ?? null;
    item.updatedAt = Date.now();
    if (args.retainSourceKeys) {
      item.sources = item.sources.filter((source) =>
        args.retainSourceKeys!.includes(briefSourceKey(source)),
      );
    }
    if (text !== item.text) {
      item.sources.push({
        type: "freelancer_edit",
        editId: `edit_${crypto.randomUUID()}`,
        description: "Freelancer-authored brief item edit.",
      });
    }
    item.text = text;
    destination.items.push(item);
    for (const section of sections) {
      section.items.forEach((candidate, order) => {
        candidate.order = order;
      });
    }
    await saveStructuredDraft(context, draft, sections);
  },
});

export const moveItem = mutationGeneric({
  args: {
    roomId: v.id("projectRooms"),
    itemId: v.string(),
    direction: v.union(v.literal("up"), v.literal("down")),
  },
  handler: async (context, args) => {
    const draft = await requireEditableDraft(context, args.roomId);
    const sections = structuredClone(draft.sections);
    const section = sections.find((candidate) =>
      candidate.items.some((item) => item.id === args.itemId),
    );
    if (!section) throw new Error("Brief item not found.");
    const index = section.items.findIndex((item) => item.id === args.itemId);
    const target = args.direction === "up" ? index - 1 : index + 1;
    if (target >= 0 && target < section.items.length) {
      [section.items[index], section.items[target]] = [
        section.items[target]!,
        section.items[index]!,
      ];
      section.items.forEach((item, order) => {
        item.order = order;
      });
    }
    await saveStructuredDraft(context, draft, sections);
  },
});

export const removeItem = mutationGeneric({
  args: { roomId: v.id("projectRooms"), itemId: v.string() },
  handler: async (context, args) => {
    const draft = await requireEditableDraft(context, args.roomId);
    const sections = structuredClone(draft.sections);
    for (const section of sections) {
      section.items = section.items.filter((item) => item.id !== args.itemId);
      section.items.forEach((item, order) => {
        item.order = order;
      });
    }
    await saveStructuredDraft(context, draft, sections);
  },
});

export const resolveWarning = mutationGeneric({
  args: {
    roomId: v.id("projectRooms"),
    warningId: v.string(),
    resolution: v.union(v.literal("resolved"), v.literal("acknowledged")),
    note: v.string(),
  },
  handler: async (context, args) => {
    const draft = await requireEditableDraft(context, args.roomId);
    const warnings = structuredClone(draft.warnings);
    const warning = warnings.find((item) => item.id === args.warningId);
    if (!warning) throw new Error("Brief warning not found.");
    warning.status = args.resolution;
    warning.note = args.note.trim();
    warning.updatedAt = Date.now();
    await context.db.patch(draft._id, {
      warnings,
      updatedAt: Date.now(),
    });
  },
});

export const sendForReview = mutationGeneric({
  args: { roomId: v.id("projectRooms") },
  handler: async (context, args) => {
    const draft = await requireEditableDraft(context, args.roomId);
    const authorized = await requireFreelancerRoom(context, args.roomId);
    if (draft.warnings.some((warning) => warning.status === "unresolved")) {
      throw new Error("Resolve or acknowledge every warning first.");
    }
    const existing = await context.db
      .query("reviewVersions")
      .withIndex("by_room_version", (query) =>
        query.eq("roomId", args.roomId),
      )
      .collect();
    const sections = structuredClone(draft.sections).map((section) => ({
      ...section,
      items: section.items.map((item) => ({
        ...item,
        ...(item.kind === "requirement" &&
        item.requirementState === "candidate"
          ? { requirementState: "proposed" as const }
          : {}),
      })),
    }));
    const now = Date.now();
    await context.db.insert("reviewVersions", {
      roomId: args.roomId,
      sourceDraftId: draft._id,
      version: existing.length + 1,
      language: draft.language,
      status: "awaiting_client",
      markdown: documentFor(draft),
      sections,
      sentAt: now,
    });
    await context.db.patch(draft._id, {
      status: "sent",
      sections,
      updatedAt: now,
    });
    await context.db.patch(args.roomId, {
      phase: "client_review",
      updatedAt: now,
      lastActivityAt: now,
    });
    await recordAudit(context, {
      roomId: args.roomId,
      actorKind: "freelancer",
      actorId: authorized.actorId,
      action: "project_brief.sent_for_review",
      now,
    });
  },
});

export const submitChangeRequest = mutationGeneric({
  args: {
    roomId: v.id("projectRooms"),
    sessionHash: v.string(),
    text: v.string(),
  },
  handler: async (context, args) => {
    const actor = await requireWritableClientRoom(
      context,
      args.roomId,
      args.sessionHash,
    );
    const review = await context.db
      .query("reviewVersions")
      .withIndex("by_room_version", (query) =>
        query.eq("roomId", args.roomId),
      )
      .order("desc")
      .first();
    if (
      !review ||
      !["awaiting_client", "change_requested"].includes(review.status)
    ) {
      throw new Error("No editable Review Version is available for a Change Request.");
    }
    const text = args.text.trim();
    if (!text) throw new Error("A Change Request is required.");
    const existing = await context.db
      .query("briefChangeRequests")
      .withIndex("by_review", (query) =>
        query.eq("reviewVersionId", review._id),
      )
      .unique();
    const now = Date.now();
    if (existing) {
      if (existing.status !== "editing") {
        throw new Error("The Change Request is already acknowledged.");
      }
      await context.db.patch(existing._id, {
        revisions: [
          ...existing.revisions,
          {
            version: existing.revisions.length + 1,
            text,
            createdAt: now,
          },
        ],
        updatedAt: now,
      });
    } else {
      await context.db.insert("briefChangeRequests", {
        roomId: args.roomId,
        reviewVersionId: review._id,
        status: "editing",
        revisions: [{ version: 1, text, createdAt: now }],
        createdAt: now,
        updatedAt: now,
      });
    }
    await context.db.patch(review._id, { status: "change_requested" });
    await context.db.patch(args.roomId, {
      phase: "freelancer_review",
      updatedAt: now,
      lastActivityAt: now,
    });
    await recordAudit(context, {
      roomId: args.roomId,
      actorKind: "client",
      actorId: actor.actorId,
      deviceHash: actor.session.deviceHash,
      action: "project_brief.change_requested",
      now,
    });
  },
});

export const acknowledgeChangeRequest = mutationGeneric({
  args: { roomId: v.id("projectRooms") },
  handler: async (context, args) => {
    const authorized = await requireWritableFreelancerRoom(
      context,
      args.roomId,
    );
    const request = await context.db
      .query("briefChangeRequests")
      .withIndex("by_room_status", (query) =>
        query.eq("roomId", args.roomId),
      )
      .order("desc")
      .collect()
      .then((items) => items.find((item) => item.status === "editing"));
    if (!request) throw new Error("No editable Change Request is available.");
    const review = (await context.db.get(
      request.reviewVersionId,
    )) as unknown as StoredReview | null;
    if (!review) throw new Error("Review Version not found.");
    const prior = await context.db
      .query("briefDrafts")
      .withIndex("by_room_revision", (query) =>
        query.eq("roomId", args.roomId),
      )
      .collect();
    const now = Date.now();
    await context.db.patch(request._id, {
      status: "acknowledged",
      acknowledgedAt: now,
      updatedAt: now,
    });
    await createDraftFromReview(context, {
      roomId: args.roomId,
      revision: prior.length + 1,
      review,
      now,
    });
    await context.db.patch(args.roomId, {
      phase: "freelancer_review",
      updatedAt: now,
      lastActivityAt: now,
    });
    await recordAudit(context, {
      roomId: args.roomId,
      actorKind: "freelancer",
      actorId: authorized.actorId,
      action: "project_brief.change_request_acknowledged",
      now,
    });
  },
});

export const approve = mutationGeneric({
  args: { roomId: v.id("projectRooms"), sessionHash: v.string() },
  handler: async (context, args) => {
    const actor = await requireWritableClientRoom(
      context,
      args.roomId,
      args.sessionHash,
    );
    const profile = await context.db
      .query("clientProfiles")
      .withIndex("by_room_purge", (query) => query.eq("roomId", args.roomId))
      .unique();
    const review = (await context.db
      .query("reviewVersions")
      .withIndex("by_room_version", (query) =>
        query.eq("roomId", args.roomId),
      )
      .order("desc")
      .first()) as unknown as StoredReview | null;
    if (!profile || !review || review.status !== "awaiting_client") {
      throw new Error("No Review Version can be approved.");
    }
    const sections = structuredClone(review.sections).map((section) => ({
      ...section,
      items: section.items.map((item) => ({
        ...item,
        ...(item.kind === "requirement" &&
        item.requirementState === "proposed"
          ? { requirementState: "agreed" as const }
          : {}),
      })),
    }));
    const agreedRequirementIds = sections.flatMap((section) =>
      section.items
        .filter((item) => item.requirementState === "agreed")
        .map((item) => item.id),
    );
    const now = Date.now();
    await context.db.patch(review._id, {
      status: "approved",
      sections,
      approval: {
        displayName: profile.displayName,
        deviceHash: actor.session.deviceHash,
        approvedAt: now,
        agreedRequirementIds,
      },
    });
    await context.db.patch(args.roomId, {
      phase: "approved",
      updatedAt: now,
      lastActivityAt: now,
    });
    await recordAudit(context, {
      roomId: args.roomId,
      actorKind: "client",
      actorId: actor.actorId,
      deviceHash: actor.session.deviceHash,
      action: "project_brief.approved",
      now,
    });
  },
});

export const reopen = mutationGeneric({
  args: { roomId: v.id("projectRooms") },
  handler: async (context, args) => {
    const authorized = await requireFreelancerRoom(
      context,
      args.roomId,
    );
    const { room } = authorized;
    if (room.phase !== "approved") {
      throw new Error("Only an approved Review Version can be reopened.");
    }
    const review = await context.db
      .query("reviewVersions")
      .withIndex("by_room_version", (query) =>
        query.eq("roomId", args.roomId),
      )
      .order("desc")
      .first();
    if (!review || review.status !== "approved") {
      throw new Error("Approved Review Version not found.");
    }
    const prior = await context.db
      .query("briefDrafts")
      .withIndex("by_room_revision", (query) =>
        query.eq("roomId", args.roomId),
      )
      .collect();
    const now = Date.now();
    await createDraftFromReview(context, {
      roomId: args.roomId,
      revision: prior.length + 1,
      review: review as unknown as StoredReview,
      now,
    });
    await context.db.patch(args.roomId, {
      phase: "freelancer_review",
      updatedAt: now,
      lastActivityAt: now,
    });
    await recordAudit(context, {
      roomId: args.roomId,
      actorKind: "freelancer",
      actorId: authorized.actorId,
      action: "project_brief.reopened",
      now,
    });
  },
});

export const exportMarkdown = queryGeneric({
  args: {
    ...roomActorArgs,
    artifactId: v.string(),
  },
  handler: async (context, args) => {
    const actor = await requireRoomActorFromSession(
      context,
      args.roomId,
      args.sessionHash,
    );
    const draftId = context.db.normalizeId("briefDrafts", args.artifactId);
    const reviewId = context.db.normalizeId(
      "reviewVersions",
      args.artifactId,
    );
    const artifact = (draftId
      ? await context.db.get(draftId)
      : reviewId
        ? await context.db.get(reviewId)
        : null) as unknown as StoredDraft | StoredReview | null;
    if (!artifact || artifact.roomId !== args.roomId) {
      throw new Error("Brief artifact not found.");
    }
    if (actor.kind === "client" && draftId) {
      throw new Error("Clients may export only immutable Review Versions.");
    }
    const sources = new Map<string, BriefSource>();
    for (const section of artifact.sections) {
      for (const source of section.sources) {
        sources.set(briefSourceKey(source), source);
      }
      for (const item of section.items) {
        for (const source of item.sources) {
          sources.set(briefSourceKey(source), source);
        }
      }
    }
    const sourceNumbers = new Map(
      [...sources.keys()].map((key, index) => [key, index + 1]),
    );
    const citation = (items: BriefSource[]) => {
      const numbers = items.flatMap((source) => {
        const number = sourceNumbers.get(briefSourceKey(source));
        return number ? [number] : [];
      });
      return numbers.length
        ? ` [${numbers.map((number) => `E${number}`).join(", ")}]`
        : "";
    };
    const lines: string[] = [];
    for (const section of artifact.sections) {
      lines.push(
        `## ${section.title}`,
        "",
        `${section.content}${citation(section.sources)}`,
        "",
      );
      for (const item of section.items) {
        lines.push(`- ${item.text}${citation(item.sources)}`);
      }
      if (section.items.length) lines.push("");
    }
    lines.push(
      artifact.language === "de"
        ? "## Quellenanhang"
        : "## Evidence appendix",
      "",
    );
    let index = 0;
    for (const source of sources.values()) {
      index += 1;
      const detail = await briefEvidenceDetail(
        context,
        args.roomId,
        source,
      );
      const label = detail?.label ?? "Unavailable evidence";
      const locator = detail?.locator ? ` · ${detail.locator}` : "";
      const excerpt = (
        typeof detail?.text === "string"
          ? detail.text
          : "The cited source is unavailable."
      )
        .replaceAll(/\s+/g, " ")
        .trim()
        .slice(0, 800);
      lines.push(`${index}. [E${index}] ${label}${locator} — ${excerpt}`);
    }
    return lines.join("\n").trim();
  },
});

export const inspectSource = queryGeneric({
  args: {
    ...roomActorArgs,
    source: briefSourceValidator,
  },
  handler: async (context, args) => {
    await requireRoomActorFromSession(
      context,
      args.roomId,
      args.sessionHash,
    );
    const detail = await briefEvidenceDetail(
      context,
      args.roomId,
      args.source as BriefSource,
    );
    return (
      detail ?? {
        label: "Evidence",
        text: "This source is no longer available.",
        unavailable: true as const,
      }
    );
  },
});
