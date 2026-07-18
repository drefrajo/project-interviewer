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
const sourceLocator = v.union(
  v.object({
    kind: v.literal("page"),
    label: v.string(),
    page: v.number(),
  }),
  v.object({
    kind: v.literal("slide"),
    label: v.string(),
    slide: v.number(),
  }),
  v.object({
    kind: v.literal("sheet"),
    label: v.string(),
    sheet: v.string(),
    range: v.optional(v.string()),
  }),
  v.object({
    kind: v.literal("image"),
    label: v.string(),
    image: v.number(),
  }),
  v.object({
    kind: v.literal("paragraph"),
    label: v.string(),
    paragraph: v.optional(v.number()),
  }),
  v.object({
    kind: v.literal("text_range"),
    label: v.string(),
    start: v.number(),
    end: v.number(),
  }),
);
const evidenceReference = v.union(
  v.object({
    type: v.literal("material"),
    materialId: v.string(),
    locator: sourceLocator,
  }),
  v.object({
    type: v.literal("turn"),
    turnId: v.string(),
  }),
  v.object({
    type: v.literal("correction"),
    correctionId: v.string(),
  }),
  v.object({
    type: v.literal("analysis_feedback"),
    feedbackId: v.string(),
  }),
  v.object({
    type: v.literal("model_inference"),
    description: v.string(),
  }),
);
const interviewQuestion = v.object({
  id: v.string(),
  text: v.string(),
  coverageAreaId: v.string(),
  kind: v.union(
    v.literal("primary"),
    v.literal("follow_up"),
    v.literal("final_anything_else"),
  ),
  reason: v.string(),
  askedAt: v.number(),
});
const coverageArea = v.object({
  id: v.string(),
  label: v.string(),
  rubric: v.string(),
  status: v.union(
    v.literal("uncovered"),
    v.literal("partial"),
    v.literal("sufficient"),
    v.literal("not_applicable"),
  ),
  evidence: v.array(evidenceReference),
  rationale: v.string(),
  openQuestions: v.array(v.string()),
  required: v.boolean(),
  vagueFollowupCount: v.optional(v.number()),
});
const briefSource = v.union(
  evidenceReference,
  v.object({
    type: v.literal("project_description"),
  }),
  v.object({
    type: v.literal("freelancer_edit"),
    editId: v.string(),
    description: v.string(),
  }),
);
const briefItem = v.object({
  id: v.string(),
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
  priority: v.union(v.string(), v.null()),
  sources: v.array(briefSource),
  findingId: v.optional(v.string()),
  authoredBy: v.union(
    v.literal("generator"),
    v.literal("freelancer"),
  ),
  requirementState: v.optional(
    v.union(
      v.literal("candidate"),
      v.literal("proposed"),
      v.literal("agreed"),
      v.literal("excluded"),
    ),
  ),
  order: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
});
const briefSection = v.object({
  id: v.string(),
  title: v.string(),
  content: v.string(),
  sources: v.array(briefSource),
  items: v.array(briefItem),
});
const briefWarning = v.object({
  id: v.string(),
  category: v.union(
    v.literal("feasibility"),
    v.literal("scope"),
    v.literal("budget"),
    v.literal("timeline"),
    v.literal("responsibility"),
    v.literal("critical_gap"),
    v.literal("contradiction"),
  ),
  message: v.string(),
  subjectId: v.string(),
  status: v.union(
    v.literal("unresolved"),
    v.literal("resolved"),
    v.literal("acknowledged"),
  ),
  note: v.optional(v.string()),
  updatedAt: v.number(),
});

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
    .index("by_room", ["roomId", "version"])
    .index("by_room_purge", ["roomId"]),

  clientSessions: defineTable({
    roomId: v.id("projectRooms"),
    sessionHash: v.string(),
    deviceHash: v.string(),
    inviteVersion: v.number(),
    active: v.boolean(),
    createdAt: v.number(),
    lastSeenAt: v.number(),
    revokedAt: v.optional(v.number()),
  })
    .index("by_session_hash", ["sessionHash"])
    .index("by_room", ["roomId", "active", "lastSeenAt"])
    .index("by_room_purge", ["roomId"]),

  clientProfiles: defineTable({
    roomId: v.id("projectRooms"),
    displayName: v.string(),
    interviewLanguage: language,
    acknowledgedAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("by_room_purge", ["roomId"]),

  sharedResources: defineTable({
    roomId: v.id("projectRooms"),
    label: v.string(),
    url: v.optional(v.string()),
    note: v.optional(v.string()),
    accountIdentifier: v.optional(v.string()),
    order: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_room_order", ["roomId", "order"])
    .index("by_room_purge", ["roomId"]),

  respondingDeviceLeases: defineTable({
    roomId: v.id("projectRooms"),
    interviewId: v.optional(v.string()),
    deviceHash: v.string(),
    inviteVersion: v.number(),
    heartbeatAt: v.number(),
    leaseVersion: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("by_room_purge", ["roomId"]),

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
    .index("by_room_state", ["roomId", "state", "updatedAt"])
    .index("by_room_purge", ["roomId"]),

  uploadIntents: defineTable({
    roomId: v.id("projectRooms"),
    uploaderKind: actorKind,
    uploaderId: v.string(),
    name: v.string(),
    expectedBytes: v.number(),
    declaredContentType: v.string(),
    idempotencyKey: v.string(),
    consumed: v.boolean(),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_room", ["roomId", "createdAt"])
    .index("by_idempotency", ["roomId", "idempotencyKey"])
    .index("by_room_purge", ["roomId"]),

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
    .index("by_room", ["roomId", "analyzedAt"])
    .index("by_room_purge", ["roomId"]),

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
    .index("by_room", ["roomId", "createdAt"])
    .index("by_room_purge", ["roomId"]),

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
    .index("by_room_purge", ["roomId"])
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
    .index("by_room_created", ["roomId", "createdAt"])
    .index("by_room_purge", ["roomId"]),

  discoveryInterviews: defineTable({
    roomId: v.id("projectRooms"),
    planId: v.string(),
    language,
    status: v.union(
      v.literal("planning"),
      v.literal("active"),
      v.literal("paused"),
      v.literal("retryable"),
      v.literal("awaiting_confirmation"),
      v.literal("completed"),
      v.literal("completed_early"),
    ),
    currentQuestion: v.optional(interviewQuestion),
    operationStatus: v.union(
      v.literal("idle"),
      v.literal("running"),
      v.literal("retryable"),
    ),
    answerCount: v.number(),
    unresolvedTopics: v.array(v.string()),
    completionRationale: v.optional(v.string()),
    incompleteReason: v.optional(v.string()),
    reviewerBlockers: v.array(v.string()),
    reviewedAnswerCount: v.number(),
    usageReviewTriggered: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("by_room_status", ["roomId", "status"])
    .index("by_room_purge", ["roomId"]),

  interviewPlans: defineTable({
    roomId: v.id("projectRooms"),
    interviewId: v.id("discoveryInterviews"),
    profileId: v.literal("software-project"),
    profileVersion: v.string(),
    language,
    coverageAreas: v.array(coverageArea),
    knownRisks: v.array(v.string()),
    openGoals: v.array(v.string()),
    model: v.string(),
    provider: v.string(),
    promptVersion: v.string(),
    schemaVersion: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_interview", ["interviewId"])
    .index("by_room", ["roomId", "createdAt"])
    .index("by_room_purge", ["roomId"]),

  interviewTurns: defineTable({
    roomId: v.id("projectRooms"),
    interviewId: v.id("discoveryInterviews"),
    sequence: v.number(),
    question: interviewQuestion,
    answer: v.string(),
    answerKind: v.union(v.literal("answer"), v.literal("skip")),
    idempotencyKey: v.string(),
    contextPackRevisionId: v.optional(v.id("contextPackRevisions")),
    contextPackRevision: v.optional(v.number()),
    acceptedAt: v.number(),
  })
    .index("by_interview_sequence", ["interviewId", "sequence"])
    .index("by_interview_idempotency", [
      "interviewId",
      "idempotencyKey",
    ])
    .index("by_room_purge", ["roomId"]),

  interviewCorrections: defineTable({
    roomId: v.id("projectRooms"),
    interviewId: v.id("discoveryInterviews"),
    turnId: v.id("interviewTurns"),
    correctedAnswer: v.string(),
    reason: v.string(),
    deviceHash: v.string(),
    createdAt: v.number(),
  })
    .index("by_turn", ["turnId", "createdAt"])
    .index("by_interview", ["interviewId", "createdAt"])
    .index("by_room_purge", ["roomId"]),

  discoveryFindings: defineTable({
    roomId: v.id("projectRooms"),
    interviewId: v.id("discoveryInterviews"),
    findingType: v.union(
      v.literal("candidate_requirement"),
      v.literal("assumption"),
      v.literal("risk"),
      v.literal("gap"),
      v.literal("contradiction"),
    ),
    statement: v.string(),
    sources: v.array(evidenceReference),
    status: v.union(
      v.literal("active"),
      v.literal("resolved"),
      v.literal("explicitly_open"),
      v.literal("needs_reassessment"),
    ),
    createdAt: v.number(),
  })
    .index("by_interview", ["interviewId", "createdAt"])
    .index("by_room_type", ["roomId", "findingType"])
    .index("by_room_purge", ["roomId"]),

  interviewEvents: defineTable({
    roomId: v.id("projectRooms"),
    interviewId: v.id("discoveryInterviews"),
    eventType: v.literal("project_material_added"),
    materialId: v.id("projectMaterials"),
    contextPackRevisionId: v.id("contextPackRevisions"),
    contextPackRevision: v.number(),
    handledAtTurnId: v.optional(v.id("interviewTurns")),
    createdAt: v.number(),
  })
    .index("by_interview", ["interviewId", "createdAt"])
    .index("by_material_context", [
      "materialId",
      "contextPackRevisionId",
    ])
    .index("by_room_purge", ["roomId"]),

  interviewOperations: defineTable({
    roomId: v.id("projectRooms"),
    interviewId: v.id("discoveryInterviews"),
    turnId: v.optional(v.id("interviewTurns")),
    operationType: v.union(
      v.literal("interview_planning"),
      v.literal("interview_turn"),
      v.literal("interview_review"),
    ),
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
    promptVersion: v.string(),
    schemaVersion: v.string(),
    contextPackRevisionId: v.optional(v.id("contextPackRevisions")),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    estimatedCostUsd: v.optional(v.number()),
    latencyMs: v.optional(v.number()),
    errorCode: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_interview", ["interviewId", "updatedAt"])
    .index("by_interview_idempotency", [
      "interviewId",
      "idempotencyKey",
    ])
    .index("by_room_purge", ["roomId"]),

  briefDrafts: defineTable({
    roomId: v.id("projectRooms"),
    revision: v.number(),
    basedOnReviewVersionId: v.optional(v.string()),
    language,
    status: v.union(v.literal("editing"), v.literal("sent")),
    sections: v.array(briefSection),
    warnings: v.array(briefWarning),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_room_revision", ["roomId", "revision"])
    .index("by_room_status", ["roomId", "status", "updatedAt"])
    .index("by_room_purge", ["roomId"]),

  reviewVersions: defineTable({
    roomId: v.id("projectRooms"),
    sourceDraftId: v.id("briefDrafts"),
    version: v.number(),
    language,
    status: v.union(
      v.literal("awaiting_client"),
      v.literal("change_requested"),
      v.literal("approved"),
      v.literal("invalidated"),
    ),
    sections: v.array(briefSection),
    sentAt: v.number(),
    approval: v.optional(
      v.object({
        displayName: v.string(),
        deviceHash: v.string(),
        approvedAt: v.number(),
        agreedRequirementIds: v.array(v.string()),
      }),
    ),
  })
    .index("by_room_version", ["roomId", "version"])
    .index("by_room_status", ["roomId", "status", "version"])
    .index("by_room_purge", ["roomId"]),

  briefChangeRequests: defineTable({
    roomId: v.id("projectRooms"),
    reviewVersionId: v.id("reviewVersions"),
    status: v.union(
      v.literal("editing"),
      v.literal("acknowledged"),
    ),
    revisions: v.array(
      v.object({
        version: v.number(),
        text: v.string(),
        createdAt: v.number(),
      }),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
    acknowledgedAt: v.optional(v.number()),
  })
    .index("by_review", ["reviewVersionId"])
    .index("by_room_status", ["roomId", "status", "updatedAt"])
    .index("by_room_purge", ["roomId"]),

  briefOperations: defineTable({
    roomId: v.id("projectRooms"),
    operationType: v.literal("brief_generation"),
    idempotencyKey: v.string(),
    status: v.union(
      v.literal("running"),
      v.literal("retryable"),
      v.literal("succeeded"),
      v.literal("cancelled"),
    ),
    stage: v.union(
      v.literal("generating"),
      v.literal("validating"),
      v.literal("complete"),
    ),
    attemptCount: v.number(),
    model: v.optional(v.string()),
    provider: v.optional(v.string()),
    promptVersion: v.string(),
    schemaVersion: v.string(),
    contextPackRevisionId: v.optional(v.id("contextPackRevisions")),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    estimatedCostUsd: v.optional(v.number()),
    errorCode: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_room", ["roomId", "updatedAt"])
    .index("by_idempotency", ["roomId", "idempotencyKey"])
    .index("by_room_purge", ["roomId"]),

  durableOperations: defineTable({
    roomId: v.id("projectRooms"),
    operationType: v.string(),
    subjectId: v.optional(v.string()),
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
    workflowId: v.optional(v.string()),
    cancelRequestedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_room", ["roomId", "createdAt"])
    .index("by_idempotency", ["roomId", "idempotencyKey"])
    .index("by_room_purge", ["roomId"]),

  usageRecords: defineTable({
    roomId: v.id("projectRooms"),
    operationId: v.id("durableOperations"),
    operationType: v.string(),
    model: v.string(),
    provider: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    estimatedCostUsd: v.optional(v.number()),
    latencyMs: v.number(),
    attemptCount: v.number(),
    createdAt: v.number(),
  })
    .index("by_room", ["roomId", "createdAt"])
    .index("by_operation", ["operationId"])
    .index("by_room_purge", ["roomId"]),

  auditEvents: defineTable({
    roomId: v.id("projectRooms"),
    actorKind: v.union(v.literal("freelancer"), v.literal("client"), v.literal("system")),
    actorId: v.optional(v.string()),
    deviceHash: v.optional(v.string()),
    action: v.string(),
    createdAt: v.number(),
  })
    .index("by_room", ["roomId", "createdAt"])
    .index("by_room_purge", ["roomId"]),

  rateLimitBuckets: defineTable({
    roomId: v.optional(v.id("projectRooms")),
    scope: v.string(),
    key: v.string(),
    windowStartedAt: v.number(),
    count: v.number(),
    updatedAt: v.number(),
  })
    .index("by_key", ["key", "scope"])
    .index("by_room_purge", ["roomId"]),

  deletionRecoveryRecords: defineTable({
    roomId: v.id("projectRooms"),
    deletedAt: v.number(),
    purgeAfter: v.number(),
    status: v.union(
      v.literal("recoverable"),
      v.literal("recovered"),
      v.literal("purging"),
    ),
    activeMaterialIds: v.array(v.string()),
    recoveredAt: v.optional(v.number()),
    purgeStartedAt: v.optional(v.number()),
  })
    .index("by_room", ["roomId", "deletedAt"])
    .index("by_purge_after", ["status", "purgeAfter"])
    .index("by_purge_started", ["status", "purgeStartedAt"])
    .index("by_room_purge", ["roomId"]),
});
