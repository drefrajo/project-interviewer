import {
  mutationGeneric,
  queryGeneric,
} from "convex/server";
import { v } from "convex/values";
import {
  decideIdempotentOperation,
  enforceOperationConcurrency,
} from "./lib/production-boundaries";
import {
  requireRoomActorFromSession,
  requireWritableRoomActorFromSession,
} from "./lib/server-authorization";
import { cancelOperationAndRecoverAggregate } from "./lib/operation-cancellation";

export const begin = mutationGeneric({
  args: {
    roomId: v.id("projectRooms"),
    operationType: v.literal("file_processing"),
    subjectId: v.string(),
    idempotencyKey: v.string(),
    schemaVersion: v.string(),
    promptVersion: v.optional(v.string()),
    sessionHash: v.optional(v.string()),
  },
  handler: async (context, args) => {
    const actor = await requireWritableRoomActorFromSession(
      context,
      args.roomId,
      args.sessionHash,
    );
    let fileMaterialId:
      | ReturnType<typeof context.db.normalizeId<"projectMaterials">>
      | null = null;
    let fileMaterial: Awaited<
      ReturnType<typeof context.db.get<"projectMaterials">>
    > = null;
    fileMaterialId = context.db.normalizeId(
      "projectMaterials",
      args.subjectId,
    );
    fileMaterial = fileMaterialId
      ? await context.db.get(fileMaterialId)
      : null;
    if (
      !fileMaterial ||
      fileMaterial.roomId !== args.roomId ||
      (actor.kind === "client" &&
        fileMaterial.uploaderId !== actor.actorId)
    ) {
      throw new Error("File-processing subject is invalid.");
    }
    const existing = await context.db
      .query("durableOperations")
      .withIndex("by_idempotency", (query) =>
        query.eq("roomId", args.roomId),
      )
      .collect()
      .then((items) =>
        items.find((item) => item.idempotencyKey === args.idempotencyKey),
      );
    const decision = decideIdempotentOperation(existing ?? undefined);
    if (decision.action === "reuse") {
      return { operationId: existing!._id, reused: true };
    }
    if (
      args.operationType === "file_processing" &&
      (!fileMaterialId ||
        !fileMaterial ||
        fileMaterial.active !== true ||
        !["accepted", "failed", "unsupported"].includes(
          String(fileMaterial.state),
        ) ||
        ((fileMaterial.state === "failed" ||
          fileMaterial.state === "unsupported") &&
          fileMaterial.retryAvailable !== true))
    ) {
      throw new Error("Project Material is not available for processing.");
    }
    const roomOperations = await context.db
      .query("durableOperations")
      .withIndex("by_room", (query) => query.eq("roomId", args.roomId))
      .collect();
    const activeCount = roomOperations.filter((operation) => {
      if (
        operation.status !== "pending" &&
        operation.status !== "running"
      ) {
        return false;
      }
      return operation.operationType === args.operationType;
    }).length;
    enforceOperationConcurrency(args.operationType, activeCount);
    const now = Date.now();
    if (fileMaterialId) {
      await context.db.patch(fileMaterialId, {
        state: "accepted",
        stage: "checking_file",
        retryAvailable: false,
        failureCode: undefined,
        updatedAt: now,
      });
      await context.db.patch(args.roomId, {
        interviewReadiness: "waiting_for_material",
        updatedAt: now,
      });
    }
    if (decision.action === "retry" && existing) {
      await context.db.patch(existing._id, {
        status: "pending",
        stage: "queued",
        attemptCount: decision.attemptCount,
        errorCode: undefined,
        cancelRequestedAt: undefined,
        workflowId: undefined,
        updatedAt: now,
      });
      return { operationId: existing._id, reused: false };
    }
    const operationId = await context.db.insert("durableOperations", {
      roomId: args.roomId,
      operationType: args.operationType,
      subjectId: args.subjectId,
      idempotencyKey: args.idempotencyKey,
      status: "pending",
      stage: "queued",
      attemptCount: decision.attemptCount,
      ...(args.promptVersion
        ? { promptVersion: args.promptVersion }
        : {}),
      schemaVersion: args.schemaVersion,
      createdAt: now,
      updatedAt: now,
    });
    return { operationId, reused: false };
  },
});

export const requestCancellation = mutationGeneric({
  args: {
    roomId: v.id("projectRooms"),
    operationId: v.id("durableOperations"),
    sessionHash: v.optional(v.string()),
  },
  handler: async (context, args) => {
    const actor = await requireRoomActorFromSession(
      context,
      args.roomId,
      args.sessionHash,
    );
    const operation = await context.db.get(args.operationId);
    if (!operation || operation.roomId !== args.roomId) {
      throw new Error("Operation not found.");
    }
    const clientAllowed =
      operation.operationType === "file_processing" ||
      String(operation.operationType).startsWith("interview_");
    const freelancerAllowed =
      operation.operationType === "file_processing" ||
      operation.operationType === "brief_generation";
    if (
      (actor.kind === "client" && !clientAllowed) ||
      (actor.kind === "freelancer" && !freelancerAllowed)
    ) {
      throw new Error("Actor may not cancel this operation type.");
    }
    if (operation.operationType === "file_processing") {
      const materialId = context.db.normalizeId(
        "projectMaterials",
        String(operation.subjectId),
      );
      const material = materialId
        ? await context.db.get(materialId)
        : null;
      if (
        !material ||
        material.roomId !== args.roomId ||
        (actor.kind === "client" &&
          material.uploaderId !== actor.actorId)
      ) {
        throw new Error("Actor may not cancel this file operation.");
      }
    }
    if (
      operation.status === "succeeded" ||
      operation.status === "failed" ||
      operation.status === "cancelled"
    ) {
      return { status: operation.status };
    }
    const now = Date.now();
    await cancelOperationAndRecoverAggregate(context, operation, now);
    return { status: "cancelled" as const };
  },
});

export const get = queryGeneric({
  args: {
    roomId: v.id("projectRooms"),
    operationId: v.id("durableOperations"),
    sessionHash: v.optional(v.string()),
  },
  handler: async (context, args) => {
    await requireRoomActorFromSession(
      context,
      args.roomId,
      args.sessionHash,
    );
    const operation = await context.db.get(args.operationId);
    return operation?.roomId === args.roomId ? operation : null;
  },
});
