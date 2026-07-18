import {
  mutationGeneric,
  queryGeneric,
  type GenericDataModel,
  type GenericMutationCtx,
} from "convex/server";
import { v } from "convex/values";
import {
  requireFreelancerRoom,
  requireRoomActorFromSession,
  requireWritableFreelancerRoom,
} from "./lib/server_authorization";
import { normalizeSafeSharedResource } from "../src/domain/shared-resource-safety";
import { recordAudit } from "./lib/audit";
import { cancelOperationAndRecoverAggregate } from "./lib/operation_cancellation";

const resourceInput = {
  label: v.string(),
  url: v.optional(v.string()),
  note: v.optional(v.string()),
  accountIdentifier: v.optional(v.string()),
};

const normalizeResourceInput = (input: {
  label: string;
  url?: string;
  note?: string;
  accountIdentifier?: string;
}) => {
  const result = normalizeSafeSharedResource(input);
  if (!result.accepted) throw new Error(result.reason);
  return result.value;
};

const audit = async (
  context: GenericMutationCtx<GenericDataModel>,
  roomId: Parameters<typeof requireFreelancerRoom>[1],
  action: string,
) => {
  const identity = await context.auth.getUserIdentity();
  await recordAudit(context, {
    roomId,
    actorKind: "freelancer",
    ...(identity ? { actorId: identity.subject } : {}),
    action,
  });
};

export const listResources = queryGeneric({
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
    return context.db
      .query("sharedResources")
      .withIndex("by_room_order", (query) =>
        query.eq("roomId", args.roomId),
      )
      .collect()
      .then((resources) =>
        resources.map((resource) => ({
          ...resource,
          id: resource._id,
        })),
      );
  },
});

export const createResource = mutationGeneric({
  args: { roomId: v.id("projectRooms"), ...resourceInput },
  handler: async (context, args) => {
    await requireWritableFreelancerRoom(context, args.roomId);
    const current = await context.db
      .query("sharedResources")
      .withIndex("by_room_order", (query) =>
        query.eq("roomId", args.roomId),
      )
      .collect();
    const now = Date.now();
    const id = await context.db.insert("sharedResources", {
      roomId: args.roomId,
      ...normalizeResourceInput(args),
      order: current.length,
      createdAt: now,
      updatedAt: now,
    });
    await audit(context, args.roomId, "shared_resource.created");
    return { ...(await context.db.get(id))!, id };
  },
});

export const updateResource = mutationGeneric({
  args: {
    roomId: v.id("projectRooms"),
    resourceId: v.id("sharedResources"),
    ...resourceInput,
  },
  handler: async (context, args) => {
    await requireWritableFreelancerRoom(context, args.roomId);
    const resource = await context.db.get(args.resourceId);
    if (!resource || resource.roomId !== args.roomId) {
      throw new Error("Shared Resource not found.");
    }
    const normalized = normalizeResourceInput(args);
    await context.db.replace(args.resourceId, {
      ...resource,
      ...normalized,
      url: normalized.url,
      note: normalized.note,
      accountIdentifier: normalized.accountIdentifier,
      updatedAt: Date.now(),
    });
    await audit(context, args.roomId, "shared_resource.updated");
    return { ...(await context.db.get(args.resourceId))!, id: args.resourceId };
  },
});

export const reorderResources = mutationGeneric({
  args: {
    roomId: v.id("projectRooms"),
    resourceIds: v.array(v.id("sharedResources")),
  },
  handler: async (context, args) => {
    await requireWritableFreelancerRoom(context, args.roomId);
    const resources = await context.db
      .query("sharedResources")
      .withIndex("by_room_order", (query) =>
        query.eq("roomId", args.roomId),
      )
      .collect();
    if (
      resources.length !== args.resourceIds.length ||
      new Set(args.resourceIds).size !== resources.length ||
      resources.some(
        (resource) => !args.resourceIds.includes(resource._id),
      )
    ) {
      throw new Error(
        "Reordering requires every Shared Resource exactly once.",
      );
    }
    const now = Date.now();
    await Promise.all(
      resources.map((resource) =>
        context.db.patch(resource._id, {
          order: args.resourceIds.indexOf(resource._id),
          updatedAt: now,
        }),
      ),
    );
    await audit(context, args.roomId, "shared_resource.reordered");
    return resources
      .map((resource) => ({
        ...resource,
        id: resource._id,
        order: args.resourceIds.indexOf(resource._id),
        updatedAt: now,
      }))
      .sort((left, right) => left.order - right.order);
  },
});

export const removeResource = mutationGeneric({
  args: {
    roomId: v.id("projectRooms"),
    resourceId: v.id("sharedResources"),
  },
  handler: async (context, args) => {
    await requireWritableFreelancerRoom(context, args.roomId);
    const resource = await context.db.get(args.resourceId);
    if (!resource || resource.roomId !== args.roomId) {
      throw new Error("Shared Resource not found.");
    }
    await context.db.delete(args.resourceId);
    const remaining = await context.db
      .query("sharedResources")
      .withIndex("by_room_order", (query) =>
        query.eq("roomId", args.roomId),
      )
      .collect();
    await Promise.all(
      remaining.map((item, order) =>
        context.db.patch(item._id, { order, updatedAt: Date.now() }),
      ),
    );
    await audit(context, args.roomId, "shared_resource.removed");
  },
});

export const archiveRoom = mutationGeneric({
  args: { roomId: v.id("projectRooms") },
  handler: async (context, args) => {
    const { room } = await requireFreelancerRoom(context, args.roomId);
    if (room.phase === "archived") throw new Error("Room is already archived.");
    const now = Date.now();
    const activeOperations = await context.db
      .query("durableOperations")
      .withIndex("by_room", (query) => query.eq("roomId", args.roomId))
      .collect()
      .then((operations) =>
        operations.filter(
          (operation) =>
            operation.status === "pending" ||
            operation.status === "running",
        ),
      );
    for (const operation of activeOperations) {
      await cancelOperationAndRecoverAggregate(context, operation, now);
    }
    await context.db.patch(args.roomId, {
      archivedFromPhase: room.phase,
      phase: "archived",
      lastActivityAt: now,
      updatedAt: now,
    });
    await audit(context, args.roomId, "project_room.archived");
  },
});

export const restoreRoom = mutationGeneric({
  args: { roomId: v.id("projectRooms") },
  handler: async (context, args) => {
    const { room } = await requireFreelancerRoom(context, args.roomId);
    if (room.phase !== "archived" || !room.archivedFromPhase) {
      throw new Error("Only an archived room can be restored.");
    }
    const now = Date.now();
    await context.db.patch(args.roomId, {
      phase: room.archivedFromPhase,
      archivedFromPhase: undefined,
      lastActivityAt: now,
      updatedAt: now,
    });
    await audit(context, args.roomId, "project_room.restored_from_archive");
  },
});

export const reopenDiscovery = mutationGeneric({
  args: { roomId: v.id("projectRooms") },
  handler: async (context, args) => {
    const { room } = await requireFreelancerRoom(context, args.roomId);
    if (room.phase === "archived") {
      throw new Error("Restore the room before reopening discovery.");
    }
    const interview = await context.db
      .query("discoveryInterviews")
      .withIndex("by_room", (query) => query.eq("roomId", args.roomId))
      .first();
    if (
      !interview ||
      (interview.status !== "completed" &&
        interview.status !== "completed_early")
    ) {
      throw new Error("Only completed discovery can be reopened.");
    }
    const plan = await context.db
      .query("interviewPlans")
      .withIndex("by_interview", (query) =>
        query.eq("interviewId", interview._id),
      )
      .order("desc")
      .first();
    const area =
      plan?.coverageAreas.find(
        (candidate: { status: string }) =>
          candidate.status === "uncovered" ||
          candidate.status === "partial",
      ) ?? plan?.coverageAreas[0];
    if (!area) throw new Error("The Interview Plan has no coverage areas.");
    const now = Date.now();
    await context.db.patch(interview._id, {
      status: "active",
      operationStatus: "idle",
      currentQuestion: {
        id: crypto.randomUUID(),
        text:
          interview.language === "de"
            ? `Die Klärung wurde wieder geöffnet. Was sollten wir bei „${area.label}“ als Nächstes ergänzen oder korrigieren?`
            : `Discovery was reopened. What should we add or correct next for “${area.label}”?`,
        coverageAreaId: area.id,
        kind: "follow_up",
        reason:
          "The Freelancer reopened discovery to continue the existing Interview Plan.",
        askedAt: now,
      },
      completionRationale: undefined,
      incompleteReason: undefined,
      reviewerBlockers: [],
      updatedAt: now,
    });
    const reviewVersions = await context.db
      .query("reviewVersions")
      .withIndex("by_room_version", (query) =>
        query.eq("roomId", args.roomId),
      )
      .collect();
    await Promise.all(
      reviewVersions
        .filter((version) => version.status !== "approved")
        .map((version) =>
          context.db.patch(version._id, { status: "invalidated" }),
        ),
    );
    await context.db.patch(args.roomId, {
      phase: "discovery",
      lastActivityAt: now,
      updatedAt: now,
    });
    await audit(context, args.roomId, "interview.reopened");
  },
});
