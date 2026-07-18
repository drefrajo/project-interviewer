import {
  internalMutationGeneric,
  makeFunctionReference,
  mutationGeneric,
  type GenericDataModel,
  type GenericMutationCtx,
} from "convex/server";
import { v, type GenericId } from "convex/values";
import { DEFAULT_PRODUCTION_LIMITS } from "../src/infrastructure/production-contract";
import {
  PURGE_BATCH_SIZE,
  PURGE_BATCH_TABLES,
  PURGE_STALE_AFTER_MS,
} from "./lib/production_boundaries";
import { requireFreelancerRoom } from "./lib/server_authorization";
import { recordAudit } from "./lib/audit";
import { cancelOperationAndRecoverAggregate } from "./lib/operation_cancellation";

const DAY_MS = 24 * 60 * 60 * 1000;

export const scheduleRoomDeletion = mutationGeneric({
  args: { roomId: v.id("projectRooms") },
  handler: async (context, args) => {
    const authorized = await requireFreelancerRoom(context, args.roomId);
    const now = Date.now();
    const purgeAfter =
      now + DEFAULT_PRODUCTION_LIMITS.deletionRecoveryDays * DAY_MS;
    const materials = await context.db
      .query("projectMaterials")
      .withIndex("by_room_active", (query) =>
        query.eq("roomId", args.roomId),
      )
      .collect();
    await context.db.patch(args.roomId, {
      deletedAt: now,
      purgeAfter,
      updatedAt: now,
    });
    await context.db.insert("deletionRecoveryRecords", {
      roomId: args.roomId,
      deletedAt: now,
      purgeAfter,
      status: "recoverable",
      activeMaterialIds: materials
        .filter((material) => material.active)
        .map((material) => String(material._id)),
    });
    const capabilities = await context.db
      .query("inviteCapabilities")
      .withIndex("by_room", (query) => query.eq("roomId", args.roomId))
      .collect();
    for (const capability of capabilities) {
      await context.db.patch(capability._id, {
        status: "revoked",
        revokedAt: now,
      });
    }
    const sessions = await context.db
      .query("clientSessions")
      .withIndex("by_room", (query) => query.eq("roomId", args.roomId))
      .collect();
    for (const session of sessions.filter((item) => item.active)) {
      await context.db.patch(session._id, {
        active: false,
        revokedAt: now,
      });
    }
    const operations = await context.db
      .query("durableOperations")
      .withIndex("by_room", (query) => query.eq("roomId", args.roomId))
      .collect();
    for (const operation of operations.filter((item) =>
      ["pending", "running", "retryable"].includes(String(item.status)),
    )) {
      await cancelOperationAndRecoverAggregate(context, operation, now);
    }
    await recordAudit(context, {
      roomId: args.roomId,
      actorKind: "freelancer",
      actorId: authorized.actorId,
      action: "project_room.deletion_scheduled",
      now,
    });
    return { roomId: args.roomId, deletedAt: now, purgeAfter };
  },
});

export const recoverRoom = mutationGeneric({
  args: { roomId: v.id("projectRooms") },
  handler: async (context, args) => {
    const identity = await context.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required.");
    }
    const room = await context.db.get(args.roomId);
    if (!room?.deletedAt || !room.purgeAfter || room.purgeAfter <= Date.now()) {
      throw new Error("Room recovery window has expired.");
    }
    const profile = await context.db.get(room.freelancerId);
    if (!profile || profile.authUserId !== identity.subject) {
      throw new Error("Room access denied.");
    }
    const records = await context.db
      .query("deletionRecoveryRecords")
      .withIndex("by_room", (query) => query.eq("roomId", args.roomId))
      .collect();
    const record = records.find((item) => item.status === "recoverable");
    if (!record) {
      throw new Error("Room recovery record not found.");
    }
    const now = Date.now();
    await context.db.patch(args.roomId, {
      deletedAt: undefined,
      purgeAfter: undefined,
      updatedAt: now,
    });
    await context.db.patch(record._id, {
      status: "recovered",
      recoveredAt: now,
    });
    await recordAudit(context, {
      roomId: args.roomId,
      actorKind: "freelancer",
      actorId: identity.subject,
      action: "project_room.recovered",
      now,
    });
  },
});

const purgeRoomBatchReference = makeFunctionReference<
  "mutation",
  {
    recoveryRecordId: GenericId<"deletionRecoveryRecords">;
    tableIndex: number;
  }
>("deletion:purgeRoomBatch");

const schedulePurgeBatch = (
  context: GenericMutationCtx<GenericDataModel>,
  recoveryRecordId: GenericId<"deletionRecoveryRecords">,
  tableIndex: number,
) =>
  context.scheduler.runAfter(0, purgeRoomBatchReference, {
    recoveryRecordId,
    tableIndex,
  });

export const purgeRoomBatch = internalMutationGeneric({
  args: {
    recoveryRecordId: v.id("deletionRecoveryRecords"),
    tableIndex: v.number(),
  },
  handler: async (context, args) => {
    const recovery = await context.db.get(args.recoveryRecordId);
    if (!recovery || recovery.status !== "purging") {
      return { status: "stopped" as const };
    }
    const room = await context.db.get(recovery.roomId);
    if (!room?.deletedAt || !room.purgeAfter) {
      return { status: "stopped" as const };
    }
    const table = PURGE_BATCH_TABLES[args.tableIndex];
    if (!table) {
      await context.db.delete(args.recoveryRecordId);
      await context.db.delete(recovery.roomId);
      return { status: "complete" as const };
    }
    const documents = await context.db
      .query(table)
      .withIndex("by_room_purge", (query) =>
        query.eq("roomId", recovery.roomId),
      )
      .take(PURGE_BATCH_SIZE + 1);
    const batch = documents
      .filter(
        (document) =>
          table !== "deletionRecoveryRecords" ||
          document._id !== args.recoveryRecordId,
      )
      .slice(0, PURGE_BATCH_SIZE);
    for (const document of batch) {
      if (
        table === "projectMaterials" &&
        typeof document.storageId === "string"
      ) {
        await context.storage.delete(
          document.storageId as GenericId<"_storage">,
        );
      }
      await context.db.delete(
        document._id as GenericId<typeof table>,
      );
    }
    await context.db.patch(args.recoveryRecordId, {
      purgeStartedAt: Date.now(),
    });
    await schedulePurgeBatch(
      context,
      args.recoveryRecordId,
      batch.length === PURGE_BATCH_SIZE
        ? args.tableIndex
        : args.tableIndex + 1,
    );
    return {
      status: "continued" as const,
      table,
      deleted: batch.length,
    };
  },
});

export const purgeExpiredRooms = internalMutationGeneric({
  args: {},
  handler: async (context) => {
    const now = Date.now();
    const expired = await context.db
      .query("deletionRecoveryRecords")
      .withIndex("by_purge_after", (query) =>
        query.eq("status", "recoverable"),
      )
      .filter((query) => query.lte(query.field("purgeAfter"), now))
      .take(25);
    const stalled = await context.db
      .query("deletionRecoveryRecords")
      .withIndex("by_purge_started", (query) =>
        query.eq("status", "purging"),
      )
      .filter((query) =>
        query.lte(
          query.field("purgeStartedAt"),
          now - PURGE_STALE_AFTER_MS,
        ),
      )
      .take(25);
    const records = [...expired, ...stalled];
    for (const record of records) {
      await context.db.patch(record._id, {
        status: "purging",
        purgeStartedAt: now,
      });
      await schedulePurgeBatch(context, record._id, 0);
    }
    return { scheduled: records.length };
  },
});
