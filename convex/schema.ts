import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const clientLanguage = v.union(v.literal("en"), v.literal("de"));
export const interviewModel = v.union(
  v.literal("gpt-5.6-terra"),
  v.literal("deepseek-v4-flash"),
);
export const interviewStep = v.union(
  v.literal("interview"),
  v.literal("review"),
  v.literal("concepts"),
  v.literal("submitted"),
);
export const visualConcept = v.object({
  id: v.string(),
  name: v.string(),
  rationale: v.string(),
  prompt: v.string(),
  imageId: v.optional(v.id("_storage")),
  status: v.union(
    v.literal("pending"),
    v.literal("ready"),
    v.literal("failed"),
  ),
  errorCode: v.optional(v.string()),
});
export const visualDirection = v.union(
  v.object({
    kind: v.literal("concept"),
    conceptId: v.string(),
    note: v.optional(v.string()),
  }),
  v.object({
    kind: v.literal("inspiration_links"),
    inspirationLinks: v.array(v.string()),
    note: v.optional(v.string()),
  }),
);
export const operation = v.object({
  kind: v.union(
    v.literal("interview_response"),
    v.literal("document_revision"),
    v.literal("concept_generation"),
    v.literal("email_notification"),
  ),
  status: v.union(
    v.literal("pending"),
    v.literal("running"),
    v.literal("failed"),
  ),
  attempt: v.number(),
  input: v.optional(v.string()),
  startedAt: v.optional(v.number()),
  errorCode: v.optional(v.string()),
});
export const projectSubmission = v.object({
  id: v.string(),
  submittedAt: v.number(),
  projectDocument: v.string(),
  visualDirection,
  emailDelivery: v.union(
    v.literal("pending"),
    v.literal("sent"),
    v.literal("failed"),
    v.literal("unknown"),
  ),
  emailAttempts: v.number(),
});

export default defineSchema({
  creatorProfiles: defineTable({
    authUserId: v.string(),
    tokenIdentifier: v.string(),
    email: v.string(),
    displayName: v.string(),
    provider: v.optional(v.union(v.literal("google"), v.literal("github"))),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_authUserId", ["authUserId"])
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_email", ["email"]),

  interviewTemplates: defineTable({
    kind: v.union(v.literal("built_in"), v.literal("private")),
    ownerId: v.optional(v.id("creatorProfiles")),
    builtInKey: v.optional(v.string()),
    name: v.string(),
    sourceLanguage: clientLanguage,
    instructions: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_kind", ["kind"])
    .index("by_ownerId", ["ownerId"])
    .index("by_builtInKey_and_sourceLanguage", [
      "builtInKey",
      "sourceLanguage",
    ]),

  interviews: defineTable({
    creatorId: v.id("creatorProfiles"),
    agentThreadId: v.string(),
    linkHash: v.string(),
    linkTokenCiphertext: v.string(),
    linkTokenIv: v.string(),
    linkVersion: v.number(),
    projectName: v.string(),
    clientLanguage,
    model: interviewModel,
    instructions: v.string(),
    deepseekPrivacyAcknowledged: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
    startedAt: v.optional(v.number()),
    frozenAt: v.optional(v.number()),
    step: interviewStep,
    clientMessageCount: v.number(),
    documentRevisionCount: v.number(),
    projectDocument: v.optional(v.string()),
    suggestedReplies: v.optional(v.array(v.string())),
    concepts: v.array(visualConcept),
    visualDirection: v.optional(visualDirection),
    submission: v.optional(projectSubmission),
    operation: v.optional(operation),
    usage: v.object({
      inputTokens: v.number(),
      outputTokens: v.number(),
      estimatedCostUsd: v.number(),
    }),
  })
    .index("by_creatorId", ["creatorId"])
    .index("by_creatorId_and_updatedAt", ["creatorId", "updatedAt"])
    .index("by_linkHash", ["linkHash"]),
});
