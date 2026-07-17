import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const language = v.union(v.literal("en"), v.literal("de"));
const projectPhase = v.union(
  v.literal("setup"),
  v.literal("discovery"),
  v.literal("freelancer_review"),
  v.literal("client_review"),
  v.literal("approved"),
  v.literal("archived"),
);

export default defineSchema({
  freelancerProfiles: defineTable({
    authUserId: v.string(),
    displayName: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_auth_user", ["authUserId"]),

  projectRooms: defineTable({
    freelancerId: v.id("freelancerProfiles"),
    title: v.string(),
    clientLabel: v.string(),
    projectDescription: v.string(),
    briefLanguage: language,
    discoveryProfileId: v.literal("software-project"),
    discoveryProfileVersion: v.string(),
    freelancerGuidance: v.string(),
    phase: projectPhase,
    interviewReadiness: v.union(
      v.literal("waiting_for_material"),
      v.literal("ready"),
    ),
    lastActivityAt: v.number(),
    archivedFromPhase: v.optional(projectPhase),
    deletedAt: v.optional(v.number()),
    purgeAfter: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_freelancer", ["freelancerId", "lastActivityAt"])
    .index("by_freelancer_phase", [
      "freelancerId",
      "phase",
      "lastActivityAt",
    ])
    .index("by_purge_after", ["purgeAfter"])
    .searchIndex("search_rooms", {
      searchField: "title",
      filterFields: ["freelancerId", "phase"],
    }),

  inviteCapabilities: defineTable({
    roomId: v.id("projectRooms"),
    tokenHash: v.string(),
    version: v.number(),
    status: v.union(v.literal("active"), v.literal("revoked")),
    createdAt: v.number(),
    revokedAt: v.optional(v.number()),
  })
    .index("by_token_hash", ["tokenHash"])
    .index("by_room", ["roomId", "version"]),

  clientProfiles: defineTable({
    roomId: v.id("projectRooms"),
    displayName: v.string(),
    interviewLanguage: language,
    acknowledgedAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_room", ["roomId"]),

  respondingDeviceLeases: defineTable({
    roomId: v.id("projectRooms"),
    interviewId: v.optional(v.string()),
    deviceHash: v.string(),
    inviteVersion: v.number(),
    heartbeatAt: v.number(),
    leaseVersion: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_room", ["roomId"]),

  durableOperations: defineTable({
    roomId: v.id("projectRooms"),
    operationType: v.string(),
    idempotencyKey: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("retryable"),
      v.literal("succeeded"),
      v.literal("failed"),
      v.literal("cancelled"),
    ),
    stage: v.string(),
    attemptCount: v.number(),
    model: v.optional(v.string()),
    provider: v.optional(v.string()),
    promptVersion: v.optional(v.string()),
    schemaVersion: v.string(),
    contextPackRevisionId: v.optional(v.string()),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    estimatedCostUsd: v.optional(v.number()),
    latencyMs: v.optional(v.number()),
    errorCode: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_room", ["roomId", "createdAt"])
    .index("by_idempotency", ["roomId", "idempotencyKey"]),

  auditEvents: defineTable({
    roomId: v.id("projectRooms"),
    actorKind: v.union(v.literal("freelancer"), v.literal("client"), v.literal("system")),
    actorId: v.optional(v.string()),
    deviceHash: v.optional(v.string()),
    action: v.string(),
    createdAt: v.number(),
  }).index("by_room", ["roomId", "createdAt"]),
});
