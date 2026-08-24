import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const clientLanguage = v.union(v.literal("en"), v.literal("de"));
export const creatorLanguage = v.union(
  v.literal("en"),
  v.literal("de"),
);
export const interviewKind = v.union(
  v.literal("website"),
  v.literal("privacy"),
  v.literal("custom"),
);
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
  v.literal("price.created"),
  v.literal("price.updated"),
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
  lookupKey: v.optional(v.string()),
  priceId: v.optional(v.string()),
  productId: v.optional(v.string()),
  priceActive: v.optional(v.boolean()),
  priceCurrency: v.optional(v.string()),
  priceUnitAmount: v.optional(v.number()),
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
  visualDirection: v.optional(visualDirection),
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
    // The OAuth address is private account data used for authentication,
    // billing, and Creator notifications. It is never returned to Clients.
    email: v.string(),
    displayName: v.string(),
    contactEmail: v.optional(v.string()),
    privacyPolicyUrl: v.optional(v.string()),
    language: v.optional(creatorLanguage),
    // Kept so profiles created by the previous email-only setting remain valid.
    emailLanguage: v.optional(creatorLanguage),
    provider: v.optional(v.union(v.literal("google"), v.literal("github"))),
    stripeCustomerId: v.optional(v.string()),
    // Creator opt-in to analyze anonymized excerpts of their Creator-authored
    // content (templates, instructions) for product improvement.
    // Client content is never analyzed regardless of this flag.
    contentAnalysisOptIn: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_authUserId", ["authUserId"])
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_email", ["email"]),

  legalAcceptances: defineTable({
    account_id: v.id("creatorProfiles"),
    accepted_at: v.number(),
    terms_version: v.number(),
    dpa_version: v.number(),
    terms_hash: v.string(),
    dpa_hash: v.string(),
  }).index("by_account_id", ["account_id"]),

  interviewTemplates: defineTable({
    kind: v.union(v.literal("built_in"), v.literal("private")),
    ownerId: v.optional(v.id("creatorProfiles")),
    builtInKey: v.optional(v.string()),
    name: v.string(),
    sourceLanguage: clientLanguage,
    instructions: v.string(),
    // Widened for existing built-in/private templates. New private templates
    // write both fields; readers resolve missing values to website + concepts.
    interviewKind: v.optional(interviewKind),
    description: v.optional(v.string()),
    includesVisualConcepts: v.optional(v.boolean()),
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
    localDevSampleKey: v.optional(v.string()),
    clientLanguage,
    // Built-in Interview Template that seeded these Instructions, if any.
    builtInTemplateKey: v.optional(v.string()),
    // Interview Policy generation that produced the stored AI outputs; bumped
    // whenever prompt text changes and refreshed when new outputs are written.
    promptVersion: v.optional(v.number()),
    // Widened for legacy website Interviews. See resolveInterviewConfiguration.
    interviewKind: v.optional(interviewKind),
    includesVisualConcepts: v.optional(v.boolean()),
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
    lastActivityAt: v.optional(v.number()),
    retentionPolicyVersion: v.optional(v.number()),
    retentionExpiresAt: v.optional(v.number()),
    retentionWarningAt: v.optional(v.number()),
    retentionWarningAttemptedAt: v.optional(v.number()),
    retentionWarningSentAt: v.optional(v.number()),
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
    .index("by_linkHash", ["linkHash"])
    .index("by_retentionPolicyVersion", ["retentionPolicyVersion"])
    .index("by_retentionPolicyVersion_and_retentionExpiresAt", [
      "retentionPolicyVersion",
      "retentionExpiresAt",
    ])
    .index("by_retentionExpiresAt", ["retentionExpiresAt"])
    .index("by_retentionWarningAttemptedAt_and_retentionWarningAt", [
      "retentionWarningAttemptedAt",
      "retentionWarningAt",
    ]),

  exportArchives: defineTable({
    interviewId: v.id("interviews"),
    creatorId: v.id("creatorProfiles"),
    storageId: v.id("_storage"),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_interviewId", ["interviewId"])
    .index("by_expiresAt", ["expiresAt"]),

  // One Creator-recorded quality signal per target per Interview. Deleted with
  // the Interview; never contains Client content.
  interviewFeedback: defineTable({
    interviewId: v.id("interviews"),
    creatorId: v.id("creatorProfiles"),
    target: v.union(
      v.literal("project_document"),
      v.literal("project_submission"),
    ),
    rating: v.union(v.literal("up"), v.literal("down")),
    comment: v.optional(v.string()),
    promptVersion: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_interviewId_and_target", ["interviewId", "target"]),

  // Persisted Client change requests from Document Review. The transient
  // operation input is cleared once a revision completes; this row keeps the
  // quality signal until the Interview is deleted.
  documentRevisions: defineTable({
    interviewId: v.id("interviews"),
    requestedChanges: v.string(),
    promptVersion: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_interviewId", ["interviewId"]),

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
    lookupKey: v.optional(v.string()),
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

  stripeCatalog: defineTable({
    packId: purchasePackId,
    lookupKey: v.string(),
    priceId: v.string(),
    productId: v.string(),
    passCount: v.union(v.literal(1), v.literal(5)),
    amountMinor: v.number(),
    currency: v.literal("eur"),
    active: v.boolean(),
    syncedAt: v.number(),
  })
    .index("by_packId", ["packId"])
    .index("by_lookupKey", ["lookupKey"]),

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
