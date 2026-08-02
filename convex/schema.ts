import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const clientLanguage = v.union(v.literal("en"), v.literal("de"));
export const interviewModel = v.literal("gpt-5.6-terra");
// Existing operation documents may still contain retired image-model values.
// They are accepted only for validation; generation always uses GPT Image 2
// medium and never forwards these values to a provider.
const storedConceptImageModel = v.union(
  v.literal("gpt-image-2"),
  v.literal("gpt-image-2-low"),
  v.literal("nano-banana-2"),
  v.literal("nano-banana-2-lite"),
  v.literal("flux-2-pro-1mp"),
  v.literal("flux-2-max-1mp"),
  v.literal("flux-2-flex-1mp"),
  v.literal("flux-2-klein-4b-1mp"),
);
// Existing documents may still contain the retired interview model. New writes
// and all active provider calls use the current model above.
const storedInterviewModel = v.union(
  v.literal("gpt-5.6-terra"),
  v.literal("deepseek-v4-flash"),
);
export const interviewStep = v.union(
  v.literal("interview"),
  v.literal("review"),
  v.literal("concepts"),
  v.literal("submitted"),
);
export const interviewPassState = v.union(
  v.literal("unreserved"),
  v.literal("reserved"),
  v.literal("consumed"),
);
export const purchasePackId = v.union(
  v.literal("one_pass"),
  v.literal("five_passes"),
);
export const purchaseState = v.union(
  v.literal("pending"),
  v.literal("paid"),
  v.literal("failed"),
  v.literal("unpaid"),
  v.literal("refunded"),
  v.literal("partially_refunded"),
  v.literal("disputed"),
);
export const refundState = v.union(
  v.literal("none"),
  v.literal("partial_reconciliation_required"),
  v.literal("full"),
);
export const disputeState = v.union(
  v.literal("none"),
  v.literal("open"),
  v.literal("won"),
  v.literal("lost"),
);
export const passLedgerKind = v.union(
  v.literal("introductory_grant"),
  v.literal("purchase_grant"),
  v.literal("reservation_hold"),
  v.literal("reservation_release"),
  v.literal("reservation_consumption"),
  v.literal("purchase_refund_debit"),
  v.literal("dispute_debit"),
  v.literal("dispute_restoration"),
  v.literal("manual_adjustment"),
);
export const stripeWebhookEventType = v.union(
  v.literal("checkout.session.completed"),
  v.literal("checkout.session.async_payment_succeeded"),
  v.literal("checkout.session.async_payment_failed"),
  v.literal("charge.refunded"),
  v.literal("refund.created"),
  v.literal("charge.dispute.created"),
  v.literal("charge.dispute.closed"),
  v.literal("charge.dispute.funds_reinstated"),
  v.literal("charge.dispute.funds_withdrawn"),
);
export const sanitizedStripeWebhookEvent = v.object({
  eventId: v.string(),
  eventType: stripeWebhookEventType,
  objectId: v.string(),
  livemode: v.optional(v.boolean()),
  purchaseId: v.optional(v.string()),
  paymentStatus: v.optional(v.string()),
  sessionStatus: v.optional(v.string()),
  paymentIntentId: v.optional(v.string()),
  customerId: v.optional(v.string()),
  chargeId: v.optional(v.string()),
  amount: v.optional(v.number()),
  amountRefunded: v.optional(v.number()),
  disputeStatus: v.optional(v.string()),
});
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
  phase: v.optional(
    v.union(
      v.literal("planning"),
      v.literal("responding"),
      v.literal("concept_planning"),
      v.literal("concept_creating"),
    ),
  ),
  imageModel: v.optional(storedConceptImageModel),
  regeneratePrompts: v.optional(v.boolean()),
  additionalConcepts: v.optional(v.boolean()),
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
    stripeCustomerId: v.optional(v.string()),
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
    model: storedInterviewModel,
    instructions: v.string(),
    passState: interviewPassState,
    passReservationKey: v.optional(v.string()),
    passReservationVersion: v.optional(v.number()),
    passConsumedAt: v.optional(v.number()),
    deepseekPrivacyAcknowledged: v.optional(v.boolean()),
    additionalConceptsUsed: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
    startedAt: v.optional(v.number()),
    frozenAt: v.optional(v.number()),
    step: interviewStep,
    clientMessageCount: v.number(),
    interviewPlan: v.optional(v.string()),
    alignmentAskedAtClientMessageCount: v.optional(v.number()),
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

  passAccounts: defineTable({
    creatorId: v.id("creatorProfiles"),
    balance: v.number(),
    introductoryBalance: v.number(),
    purchasedBalance: v.number(),
    reservedBalance: v.number(),
    reservedIntroductoryBalance: v.number(),
    reservedPurchasedBalance: v.number(),
    consumedBalance: v.number(),
    introductoryGranted: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_creatorId", ["creatorId"]),

  passLedger: defineTable({
    creatorId: v.id("creatorProfiles"),
    kind: passLedgerKind,
    amount: v.number(),
    introductoryDelta: v.number(),
    purchasedDelta: v.number(),
    reservedDelta: v.optional(v.number()),
    reservedIntroductoryDelta: v.optional(v.number()),
    reservedPurchasedDelta: v.optional(v.number()),
    consumedDelta: v.optional(v.number()),
    balanceAfter: v.number(),
    introductoryBalanceAfter: v.number(),
    purchasedBalanceAfter: v.number(),
    reservedAfter: v.optional(v.number()),
    reservedIntroductoryBalanceAfter: v.optional(v.number()),
    reservedPurchasedBalanceAfter: v.optional(v.number()),
    consumedAfter: v.optional(v.number()),
    idempotencyKey: v.string(),
    purchaseId: v.optional(v.id("purchases")),
    interviewId: v.optional(v.id("interviews")),
    stripeEventId: v.optional(v.string()),
    note: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_idempotencyKey", ["idempotencyKey"])
    .index("by_creatorId_and_createdAt", ["creatorId", "createdAt"])
    .index("by_purchaseId", ["purchaseId"]),

  purchases: defineTable({
    purchaseId: v.string(),
    creatorId: v.id("creatorProfiles"),
    packId: purchasePackId,
    priceId: v.string(),
    quantity: v.number(),
    passCount: v.number(),
    amountMinor: v.number(),
    currency: v.literal("eur"),
    state: purchaseState,
    refundState,
    disputeState,
    stripeCustomerId: v.optional(v.string()),
    checkoutSessionId: v.optional(v.string()),
    checkoutUrl: v.optional(v.string()),
    paymentIntentId: v.optional(v.string()),
    chargeId: v.optional(v.string()),
    lastStripeEventId: v.optional(v.string()),
    refundedAmountMinor: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_purchaseId", ["purchaseId"])
    .index("by_creatorId_and_state", ["creatorId", "state"])
    .index("by_checkoutSessionId", ["checkoutSessionId"])
    .index("by_paymentIntentId", ["paymentIntentId"])
    .index("by_chargeId", ["chargeId"]),

  stripeEvents: defineTable({
    eventId: v.string(),
    eventType: stripeWebhookEventType,
    objectId: v.string(),
    processingState: v.union(
      v.literal("processed"),
      v.literal("ignored"),
      v.literal("deferred"),
    ),
    purchaseId: v.optional(v.id("purchases")),
    receivedAt: v.number(),
    processedAt: v.optional(v.number()),
  }).index("by_eventId", ["eventId"]),
});
