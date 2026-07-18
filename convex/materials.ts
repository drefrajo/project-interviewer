import {
  mutationGeneric,
  queryGeneric,
} from "convex/server";
import { v } from "convex/values";
import {
  enforceUploadQuota,
  validateStoredUpload,
} from "./lib/production-boundaries";
import {
  requireFreelancerRoom,
  requireRoomActor,
  requireRoomActorFromSession,
  requireWritableRoomActor,
} from "./lib/server-authorization";
import type { GenericId } from "convex/values";
import { sourceLocatorValidator } from "./lib/value-validators";
import { rebuildContextPack } from "./lib/context-pack-commit";
import { asRecord } from "./lib/commit-values";
import { internal } from "./typed-api";
import { clientMaterialDto } from "./lib/public-dtos";
import { recordAudit } from "./lib/audit";

const actorValidator = v.union(
  v.object({ kind: v.literal("freelancer") }),
  v.object({ kind: v.literal("client"), sessionHash: v.string() }),
);

const materialWasUsedInTurn = async (
  context: Parameters<typeof requireFreelancerRoom>[0],
  roomId: GenericId<"projectRooms">,
  materialId: GenericId<"projectMaterials">,
) => {
  const interview = await context.db
    .query("discoveryInterviews")
    .withIndex("by_room", (query) => query.eq("roomId", roomId))
    .first();
  if (!interview) return false;
  const interviewId = context.db.normalizeId(
    "discoveryInterviews",
    String(interview._id),
  );
  if (!interviewId) return false;
  const turns = await context.db
    .query("interviewTurns")
    .withIndex("by_interview_sequence", (query) =>
      query.eq("interviewId", interviewId),
    )
    .collect();
  const contexts = await Promise.all(
    turns.map((turn) => {
      const revisionId = context.db.normalizeId(
        "contextPackRevisions",
        String(turn.contextPackRevisionId ?? ""),
      );
      return revisionId ? context.db.get(revisionId) : null;
    }),
  );
  return contexts.some((pack) => {
    const included = pack ? asRecord(pack).includedMaterialIds : [];
    return (
      Array.isArray(included) &&
      included.some((id) => String(id) === String(materialId))
    );
  });
};

const materialView = async (
  context: Parameters<typeof requireFreelancerRoom>[0],
  material: Readonly<Record<string, unknown>> & {
    _id: GenericId<"projectMaterials">;
    roomId: GenericId<"projectRooms">;
    uploaderId: string;
  },
  actor: { actorId: string; kind: "freelancer" | "client" },
) => {
  const analyses = await context.db
    .query("fileAnalyses")
    .withIndex("by_material", (query) =>
      query.eq("materialId", material._id),
    )
    .order("desc")
    .collect();
  const versions = analyses.map((analysis) => ({
    id: analysis._id,
    version: analysis.analysisVersion,
    summary: analysis.summary,
    summaryLanguage: analysis.summaryLanguage,
    summarySources: analysis.summarySources,
    primaryCategory: analysis.primaryCategory,
    secondaryCategories: analysis.secondaryCategories,
    confidence: analysis.confidence,
    language: analysis.language,
    signals: analysis.signals,
    model: analysis.model,
    provider: analysis.provider,
    processingVersion: analysis.processingVersion,
    schemaVersion: analysis.schemaVersion,
    promptVersion: analysis.promptVersion,
    extractionMethod: analysis.extractionMethod,
    analyzedAt: analysis.analyzedAt,
  }));
  const latest = versions[0];
  const usedInTurn = await materialWasUsedInTurn(
    context,
    material.roomId,
    material._id,
  );
  return {
    id: material._id,
    roomId: material.roomId,
    name: material.name,
    size: material.size,
    declaredContentType: material.declaredContentType,
    actualContentType: material.actualContentType,
    uploaderKind: material.uploaderKind,
    state: material.state,
    stage: material.stage,
    active: material.active,
    retryAvailable: material.retryAvailable,
    includeSuspectedSecrets: material.includeSuspectedSecrets,
    suspectedSecrets: material.suspectedSecrets,
    ...(material.extractionMethod
      ? {
          extraction: {
            language: latest?.language ?? "unknown",
            method: material.extractionMethod,
          },
        }
      : {}),
    ...(latest ? { analysis: latest } : {}),
    analysisVersions: versions,
    failureCode: material.failureCode,
    createdAt: material.createdAt,
    updatedAt: material.updatedAt,
    canIncludeSuspectedSecrets:
      material.uploaderId === actor.actorId &&
      Array.isArray(material.suspectedSecrets) &&
      material.suspectedSecrets.length > 0 &&
      material.includeSuspectedSecrets !== true,
    canRemove: usedInTurn
      ? actor.kind === "freelancer"
      : material.uploaderId === actor.actorId,
  };
};

const latestContextPack = async (
  context: Parameters<typeof requireFreelancerRoom>[0],
  roomId: GenericId<"projectRooms">,
): Promise<(Record<string, unknown> & { revision: number }) | null> => {
  const revision = await context.db
    .query("contextPackRevisions")
    .withIndex("by_room_created", (query) => query.eq("roomId", roomId))
    .order("desc")
    .first();
  return revision
    ? {
        ...revision,
        id: revision._id,
        subjectMaterialId: revision.subjectMaterialId,
      } as unknown as Record<string, unknown> & { revision: number }
    : null;
};

const roomQuotaState = async (
  context: Parameters<typeof requireFreelancerRoom>[0],
  roomId: Parameters<typeof requireFreelancerRoom>[1],
  incomingFileBytes: number,
) => {
  const materials = await context.db
    .query("projectMaterials")
    .withIndex("by_room_active", (query) => query.eq("roomId", roomId))
    .collect()
    .then((items) => items.filter((item) => item.active === true));
  const operations = await context.db
    .query("durableOperations")
    .withIndex("by_room", (query) => query.eq("roomId", roomId))
    .collect();
  return {
    activeFileCount: materials.length,
    activeRoomBytes: materials.reduce(
      (total, material) =>
        total + (typeof material.size === "number" ? material.size : 0),
      0,
    ),
    incomingFileBytes,
    runningFileWorkflows: operations.filter(
      (operation) =>
        operation.operationType === "file_processing" &&
        (operation.status === "pending" || operation.status === "running"),
    ).length,
  };
};

export const requestUpload = mutationGeneric({
  args: {
    roomId: v.id("projectRooms"),
    actor: actorValidator,
    name: v.string(),
    size: v.number(),
    declaredContentType: v.string(),
    idempotencyKey: v.string(),
  },
  handler: async (context, args) => {
    const authorized = await requireWritableRoomActor(
      context,
      args.roomId,
      args.actor,
    );
    enforceUploadQuota(
      await roomQuotaState(context, args.roomId, args.size),
    );
    const existing = await context.db
      .query("uploadIntents")
      .withIndex("by_idempotency", (query) =>
        query.eq("roomId", args.roomId),
      )
      .collect()
      .then((items) =>
        items.find((item) => item.idempotencyKey === args.idempotencyKey),
      );
    const now = Date.now();
    const intentId =
      existing?._id ??
      (await context.db.insert("uploadIntents", {
        roomId: args.roomId,
        uploaderKind: args.actor.kind,
        uploaderId: authorized.actorId,
        name: args.name,
        expectedBytes: args.size,
        declaredContentType: args.declaredContentType,
        idempotencyKey: args.idempotencyKey,
        consumed: false,
        expiresAt: now + 15 * 60 * 1000,
        createdAt: now,
      }));
    return {
      intentId,
      uploadUrl: await context.storage.generateUploadUrl(),
      maxBytes: args.size,
    };
  },
});

export const commitUpload = mutationGeneric({
  args: {
    roomId: v.id("projectRooms"),
    actor: actorValidator,
    storageId: v.id("_storage"),
    intentId: v.id("uploadIntents"),
  },
  handler: async (context, args) => {
    const authorized = await requireWritableRoomActor(
      context,
      args.roomId,
      args.actor,
    );
    const intent = await context.db.get(args.intentId);
    if (
      !intent ||
      intent.roomId !== args.roomId ||
      intent.uploaderId !== authorized.actorId ||
      intent.uploaderKind !== args.actor.kind
    ) {
      await context.storage.delete(args.storageId);
      throw new Error("Upload intent is invalid.");
    }
    const existingOperation = await context.db
      .query("durableOperations")
      .withIndex("by_idempotency", (query) =>
        query.eq("roomId", args.roomId),
      )
      .collect()
      .then((items) =>
        items.find(
          (item) => item.idempotencyKey === intent.idempotencyKey,
        ),
      );
    if (existingOperation) {
      const materialId = context.db.normalizeId(
        "projectMaterials",
        existingOperation.subjectId,
      );
      const material = materialId
        ? await context.db.get(materialId)
        : null;
      if (material && material.roomId === args.roomId) {
        if (String(material.storageId) !== String(args.storageId)) {
          await context.storage.delete(args.storageId);
        }
        if (!intent.consumed) {
          await context.db.patch(intent._id, { consumed: true });
        }
        return {
          materialId,
          operationId: existingOperation._id,
          reused: true,
        };
      }
    }
    if (intent.expiresAt <= Date.now()) {
      await context.storage.delete(args.storageId);
      throw new Error("Upload intent has expired.");
    }
    if (intent.consumed) {
      await context.storage.delete(args.storageId);
      throw new Error("Upload intent was consumed without a recoverable upload.");
    }
    const stored = await context.db.system.get(args.storageId);
    if (!stored) {
      throw new Error("Uploaded storage object not found.");
    }
    const validation = validateStoredUpload(intent, {
      size: stored.size,
      ...(stored.contentType ? { contentType: stored.contentType } : {}),
    });
    if (!validation.accepted) {
      await context.storage.delete(args.storageId);
      throw new Error(`Uploaded object rejected: ${validation.reason}.`);
    }
    enforceUploadQuota(
      await roomQuotaState(
        context,
        args.roomId,
        stored.size,
      ),
    );
    const now = Date.now();
    const materialId = await context.db.insert("projectMaterials", {
      roomId: args.roomId,
      storageId: args.storageId,
      uploaderKind: args.actor.kind,
      uploaderId: authorized.actorId,
      name: intent.name,
      size: stored.size,
      declaredContentType: intent.declaredContentType,
      ...(stored.contentType
        ? { actualContentType: stored.contentType }
        : {}),
      state: "accepted",
      stage: "checking_file",
      active: true,
      retryAvailable: false,
      includeSuspectedSecrets: false,
      suspectedSecrets: [],
      processingVersion: "file-processing-v1",
      createdAt: now,
      updatedAt: now,
    });
    await context.db.patch(args.roomId, {
      interviewReadiness: "waiting_for_material",
      updatedAt: now,
      lastActivityAt: now,
    });
    const operationId = await context.db.insert("durableOperations", {
      roomId: args.roomId,
      operationType: "file_processing",
      subjectId: String(materialId),
      idempotencyKey: intent.idempotencyKey,
      status: "pending",
      stage: `material:${materialId}`,
      attemptCount: 1,
      schemaVersion: "1",
      createdAt: now,
      updatedAt: now,
    });
    await context.db.patch(intent._id, { consumed: true });
    await context.scheduler.runAfter(
      0,
      internal.workflows.startFileAnalysisInternal,
      {
      roomId: args.roomId,
      materialId,
      operationId,
      },
    );
    await recordAudit(context, {
      roomId: args.roomId,
      actorKind: authorized.kind,
      actorId: authorized.actorId,
      ...(authorized.kind === "client"
        ? { deviceHash: authorized.session.deviceHash }
        : {}),
      action: "project_material.uploaded",
      now,
    });
    return { materialId, operationId, reused: false };
  },
});

export const listForFreelancer = queryGeneric({
  args: { roomId: v.id("projectRooms") },
  handler: async (context, args) => {
    const authorized = await requireFreelancerRoom(context, args.roomId);
    const materials = await context.db
      .query("projectMaterials")
      .withIndex("by_room_active", (query) =>
        query.eq("roomId", args.roomId),
      )
      .collect()
      .then((items) => items.filter((item) => item.active === true));
    const views = await Promise.all(
      materials.map((material) =>
        materialView(context, material, {
          actorId: authorized.actorId,
          kind: authorized.kind,
        }),
      ),
    );
    return views;
  },
});

export const listForClient = queryGeneric({
  args: { roomId: v.id("projectRooms"), sessionHash: v.string() },
  handler: async (context, args) => {
    const authorized = await requireRoomActor(context, args.roomId, {
      kind: "client",
      sessionHash: args.sessionHash,
    });
    const materials = await context.db
      .query("projectMaterials")
      .withIndex("by_room_active", (query) =>
        query.eq("roomId", args.roomId),
      )
      .collect()
      .then((items) => items.filter((item) => item.active === true));
    const views = await Promise.all(
      materials.map((material) =>
        materialView(context, material, {
          actorId: authorized.actorId,
          kind: authorized.kind,
        }),
      ),
    );
    return views.map(clientMaterialDto);
  },
});

export const latestContext = queryGeneric({
  args: {
    roomId: v.id("projectRooms"),
    sessionHash: v.optional(v.string()),
  },
  handler: async (context, args) => {
    await requireRoomActorFromSession(
      context,
      args.roomId,
      args.sessionHash,
    );
    return latestContextPack(context, args.roomId);
  },
});

export const addFeedback = mutationGeneric({
  args: {
    roomId: v.id("projectRooms"),
    materialId: v.id("projectMaterials"),
    actor: actorValidator,
    explanation: v.string(),
    locator: sourceLocatorValidator,
  },
  handler: async (context, args) => {
    const authorized = await requireWritableRoomActor(
      context,
      args.roomId,
      args.actor,
    );
    const material = await context.db.get(args.materialId);
    if (!material || material.roomId !== args.roomId || !material.active) {
      throw new Error("Project Material not found.");
    }
    const explanation = args.explanation.trim();
    if (!explanation) throw new Error("Feedback explanation is required.");
    const createdAt = Date.now();
    const id = await context.db.insert("analysisFeedback", {
      roomId: args.roomId,
      materialId: args.materialId,
      explanation,
      actorKind: args.actor.kind,
      actorId: authorized.actorId,
      ...(args.actor.kind === "client" && authorized.kind === "client"
        ? { deviceHash: authorized.session.deviceHash }
        : {}),
      locator: args.locator,
      createdAt,
    });
    await rebuildContextPack(context, {
      roomId: args.roomId,
      reason: "analysis_feedback_added",
      subjectMaterialId: args.materialId,
    });
    await recordAudit(context, {
      roomId: args.roomId,
      actorKind: authorized.kind,
      actorId: authorized.actorId,
      ...(authorized.kind === "client"
        ? { deviceHash: authorized.session.deviceHash }
        : {}),
      action: "project_material.analysis_feedback_added",
      now: createdAt,
    });
    return {
      id,
      roomId: args.roomId,
      materialId: args.materialId,
      explanation,
      actorKind: args.actor.kind,
      ...(args.actor.kind === "client" && authorized.kind === "client"
        ? { deviceId: authorized.session.deviceHash }
        : {}),
      locator: args.locator,
      createdAt,
    };
  },
});

export const remove = mutationGeneric({
  args: {
    roomId: v.id("projectRooms"),
    materialId: v.id("projectMaterials"),
    actor: actorValidator,
  },
  handler: async (context, args) => {
    const authorized = await requireWritableRoomActor(
      context,
      args.roomId,
      args.actor,
    );
    const material = await context.db.get(args.materialId);
    if (!material || material.roomId !== args.roomId) {
      throw new Error("Project Material not found.");
    }
    const usedInTurn = await materialWasUsedInTurn(
      context,
      args.roomId,
      args.materialId,
    );
    if (
      (!usedInTurn && material.uploaderId !== authorized.actorId) ||
      (usedInTurn && authorized.kind !== "freelancer")
    ) {
      throw new Error(
        usedInTurn
          ? "Only the Freelancer may remove evidence after it informed an Interview Turn."
          : "Only the uploader may remove Project Material before discovery uses it.",
      );
    }
    await context.db.patch(args.materialId, {
      active: false,
      retryAvailable: false,
      updatedAt: Date.now(),
    });
    const chunks = await context.db
      .query("materialChunks")
      .withIndex("by_material", (query) =>
        query.eq("materialId", args.materialId),
      )
      .collect();
    await Promise.all(
      chunks.map((chunk) =>
        context.db.patch(chunk._id, { active: false }),
      ),
    );
    await context.storage.delete(material.storageId);
    const findings = await context.db
      .query("discoveryFindings")
      .withIndex("by_room_type", (query) =>
        query.eq("roomId", args.roomId),
      )
      .collect();
    await Promise.all(
      findings
        .filter((finding) =>
          (Array.isArray(finding.sources) ? finding.sources : []).some(
            (source: unknown) => {
              const evidence = asRecord(source);
              return (
                evidence.type === "material" &&
                evidence.materialId === String(args.materialId)
              );
            },
          ),
        )
        .map((finding) =>
          context.db.patch(finding._id, {
            status: "needs_reassessment",
          }),
        ),
    );
    const revision = await rebuildContextPack(context, {
      roomId: args.roomId,
      reason: "material_removed",
      subjectMaterialId: args.materialId,
    });
    await recordAudit(context, {
      roomId: args.roomId,
      actorKind: authorized.kind,
      actorId: authorized.actorId,
      ...(authorized.kind === "client"
        ? { deviceHash: authorized.session.deviceHash }
        : {}),
      action: "project_material.removed",
    });
    return revision;
  },
});

export const continueWithoutFiles = mutationGeneric({
  args: {
    roomId: v.id("projectRooms"),
    actor: actorValidator,
  },
  handler: async (context, args) => {
    await requireWritableRoomActor(context, args.roomId, args.actor);
    return rebuildContextPack(context, {
      roomId: args.roomId,
      reason: "continued_without_material",
    });
  },
});

export const includeSuspectedSecrets = mutationGeneric({
  args: {
    roomId: v.id("projectRooms"),
    materialId: v.id("projectMaterials"),
    actor: actorValidator,
    acknowledgedProviderDisclosure: v.boolean(),
  },
  handler: async (context, args) => {
    if (!args.acknowledgedProviderDisclosure) {
      throw new Error("Provider disclosure acknowledgement is required.");
    }
    const authorized = await requireWritableRoomActor(
      context,
      args.roomId,
      args.actor,
    );
    const material = await context.db.get(args.materialId);
    if (
      !material ||
      material.roomId !== args.roomId ||
      material.uploaderId !== authorized.actorId
    ) {
      throw new Error("Only the uploader may include suspected secrets.");
    }
    if (!material.suspectedSecrets.length) {
      throw new Error("No suspected secrets are available to include.");
    }
    const idempotencyKey =
      `file_processing:${args.materialId}:include_flagged`;
    const existing = await context.db
      .query("durableOperations")
      .withIndex("by_idempotency", (query) =>
        query.eq("roomId", args.roomId),
      )
      .collect()
      .then((items) =>
        items.find((item) => item.idempotencyKey === idempotencyKey),
      );
    if (
      existing?.status === "succeeded" ||
      existing?.status === "pending" ||
      existing?.status === "running"
    ) {
      return { operationId: existing._id, reused: true };
    }
    if (existing && Number(existing.attemptCount) >= 2) {
      throw new Error("The secret-override reanalysis retry limit was reached.");
    }
    const now = Date.now();
    await context.db.patch(args.materialId, {
      includeSuspectedSecrets: true,
      state: "accepted",
      stage: "checking_file",
      retryAvailable: false,
      updatedAt: now,
    });
    await recordAudit(context, {
      roomId: args.roomId,
      actorKind: authorized.kind,
      actorId: authorized.actorId,
      ...(authorized.kind === "client"
        ? { deviceHash: authorized.session.deviceHash }
        : {}),
      action: "project_material.secret_override",
      now,
    });
    const operationId = existing
      ? existing._id
      : await context.db.insert("durableOperations", {
          roomId: args.roomId,
          operationType: "file_processing",
          subjectId: String(args.materialId),
          idempotencyKey,
          status: "pending",
          stage: "queued",
          attemptCount: 1,
          schemaVersion: "file-analysis-v1",
          createdAt: now,
          updatedAt: now,
        });
    if (existing) {
      await context.db.patch(existing._id, {
        status: "pending",
        stage: "queued",
        attemptCount: Number(existing.attemptCount) + 1,
        errorCode: undefined,
        workflowId: undefined,
        updatedAt: now,
      });
    }
    await context.scheduler.runAfter(
      0,
      internal.workflows.startFileAnalysisInternal,
      {
        roomId: args.roomId,
        materialId: args.materialId,
        operationId,
      },
    );
    return { operationId, reused: false };
  },
});
