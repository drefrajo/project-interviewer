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
const actorKind = v.union(v.literal("freelancer"), v.literal("client"));
const materialState = v.union(
  v.literal("accepted"),
  v.literal("processing"),
  v.literal("analyzed"),
  v.literal("unsupported"),
  v.literal("failed"),
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

  projectMaterials: defineTable({
    roomId: v.id("projectRooms"),
    storageId: v.id("_storage"),
    uploaderKind: actorKind,
    uploaderId: v.string(),
    name: v.string(),
    size: v.number(),
    declaredContentType: v.string(),
    actualContentType: v.optional(v.string()),
    state: materialState,
    stage: v.string(),
    active: v.boolean(),
    retryAvailable: v.boolean(),
    includeSuspectedSecrets: v.boolean(),
    suspectedSecrets: v.array(v.any()),
    extractionMethod: v.optional(v.string()),
    failureCode: v.optional(v.string()),
    processingVersion: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_room_active", ["roomId", "active", "createdAt"])
    .index("by_room_state", ["roomId", "state", "updatedAt"]),

  fileAnalyses: defineTable({
    roomId: v.id("projectRooms"),
    materialId: v.id("projectMaterials"),
    summary: v.string(),
    summaryLanguage: language,
    analysisVersion: v.number(),
    summarySources: v.array(v.any()),
    primaryCategory: v.string(),
    secondaryCategories: v.array(v.string()),
    confidence: v.number(),
    language: v.string(),
    signals: v.array(v.any()),
    model: v.string(),
    provider: v.string(),
    processingVersion: v.string(),
    schemaVersion: v.string(),
    promptVersion: v.string(),
    extractionMethod: v.string(),
    analyzedAt: v.number(),
  })
    .index("by_material", ["materialId", "analyzedAt"])
    .index("by_room", ["roomId", "analyzedAt"]),

  analysisFeedback: defineTable({
    roomId: v.id("projectRooms"),
    materialId: v.id("projectMaterials"),
    explanation: v.string(),
    actorKind,
    actorId: v.string(),
    locator: v.any(),
    createdAt: v.number(),
  })
    .index("by_material", ["materialId", "createdAt"])
    .index("by_room", ["roomId", "createdAt"]),

  materialChunks: defineTable({
    roomId: v.id("projectRooms"),
    materialId: v.id("projectMaterials"),
    text: v.string(),
    locator: v.any(),
    language: v.string(),
    embedding: v.array(v.float64()),
    active: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_material", ["materialId", "active"])
    .searchIndex("search_text", {
      searchField: "text",
      filterFields: ["roomId", "materialId", "active", "language"],
    })
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["roomId", "materialId", "active", "language"],
    }),

  contextPackRevisions: defineTable({
    roomId: v.id("projectRooms"),
    revision: v.number(),
    reason: v.string(),
    subjectMaterialId: v.optional(v.id("projectMaterials")),
    globalProjectSummary: v.string(),
    likelyProjectType: v.optional(v.string()),
    notableSignals: v.array(v.any()),
    includedMaterialIds: v.array(v.id("projectMaterials")),
    materialSummaries: v.array(v.any()),
    feedback: v.array(v.any()),
    minimalContextWarning: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_room_revision", ["roomId", "revision"])
    .index("by_room_created", ["roomId", "createdAt"]),

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
