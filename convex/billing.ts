import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import {
  action,
  env,
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireCreatorProfile } from "./lib/auth";
import {
  adjustPassBalance,
  ensureIntroductoryPass,
  grantPurchasePasses,
  hasLedgerEntry,
  restoreDisputedPurchasePasses,
  revokePurchasePasses,
} from "./lib/pass_accounting";
import {
  packForId,
  packsFor,
  readStripeConfiguration,
  type InterviewPassPack,
} from "./lib/stripe_catalog";
import { createStripeGateway, StripeProviderError } from "./lib/stripe_provider";
import type { StripeWebhookEvent } from "./lib/stripe_webhook";
import { sanitizedStripeWebhookEvent, purchasePackId } from "./schema";
import { internalRefs } from "./internal_refs";

const PURCHASE_REUSE_WINDOW_MS = 30 * 60 * 1000;

const passBalanceFor = async (
  ctx: QueryCtx,
  creatorId: Id<"creatorProfiles">,
) =>
  await ctx.db
    .query("passAccounts")
    .withIndex("by_creatorId", (q) => q.eq("creatorId", creatorId))
    .unique();

const catalogRowFor = async (
  ctx: QueryCtx | MutationCtx,
  packId: "one_pass" | "five_passes",
) =>
  await ctx.db
    .query("stripeCatalog")
    .withIndex("by_packId", (q) => q.eq("packId", packId))
    .unique();

const resolvedPackFromCatalogRow = (
  definition: ReturnType<typeof packForId>,
  row: Doc<"stripeCatalog">,
): InterviewPassPack => {
  if (
    row.lookupKey !== definition.lookupKey ||
    row.passCount !== definition.passCount ||
    row.currency !== definition.currency ||
    !row.active
  ) {
    throw new Error("Stripe Interview Pass catalog is unavailable.");
  }
  return {
    ...definition,
    priceId: row.priceId,
    productId: row.productId,
    amountMinor: row.amountMinor,
  };
};

const catalogUnavailable = () =>
  new Error("Stripe Interview Pass catalog is unavailable.");

const publicCatalogFor = async (ctx: QueryCtx) => {
  const rows = await Promise.all(
    (["one_pass", "five_passes"] as const).map((packId) =>
      catalogRowFor(ctx, packId),
    ),
  );
  if (rows.some((row) => !row)) return null;
  const items = rows.map((row) => {
    if (
      !row ||
      !row.active ||
      (row.passCount !== 1 && row.passCount !== 5) ||
      row.currency !== "eur"
    ) {
      return null;
    }
    return {
      packId: row.packId,
      passCount: row.passCount,
      amountMinor: row.amountMinor,
      currency: row.currency,
    };
  });
  return items.every(
    (item): item is NonNullable<typeof item> => item !== null,
  )
    ? items
    : null;
};

const purchaseStatus = (purchase: Doc<"purchases">) => {
  if (purchase.state === "paid") return "confirmed" as const;
  if (purchase.state === "refunded") return "refunded" as const;
  if (purchase.state === "failed") return "failed" as const;
  if (purchase.state === "partially_refunded") {
    return "partial_refund" as const;
  }
  return "pending" as const;
};

export const getBalance = query({
  args: {},
  handler: async (ctx) => {
    const creator = await requireCreatorProfile(ctx);
    const account = await passBalanceFor(ctx, creator._id);
    if (!account) return null;
    return {
      availablePasses: account.balance,
      reservedPasses: account.reservedBalance,
      introductoryPasses: account.introductoryBalance,
      purchasedPasses: account.purchasedBalance,
    };
  },
});

/**
 * Public, read-only catalog for marketing sites. It reads only the
 * server-synchronized catalog snapshot and never contacts Stripe.
 */
export const getPublicCatalog = query({
  args: {},
  handler: async (ctx) => await publicCatalogFor(ctx),
});

export const getCatalog = query({
  args: {},
  handler: async (ctx) => {
    await requireCreatorProfile(ctx);
    let configuration;
    try {
      configuration = readStripeConfiguration(env);
    } catch {
      return null;
    }
    const definitions = packsFor(configuration);
    const rows = await Promise.all(
      definitions.map((definition) => catalogRowFor(ctx, definition.id)),
    );
    if (rows.some((row) => !row)) return null;
    const items = rows.map((row, index) => {
      const definition = definitions[index]!;
      const catalogRow = row!;
      if (
        catalogRow.lookupKey !== definition.lookupKey ||
        catalogRow.passCount !== definition.passCount ||
        catalogRow.currency !== definition.currency ||
        !catalogRow.active
      ) {
        return null;
      }
      return {
        packId: definition.id,
        passCount: definition.passCount,
        amountMinor: catalogRow.amountMinor,
        currency: catalogRow.currency,
      };
    });
    return items.every(
      (item): item is NonNullable<typeof item> => item !== null,
    )
      ? items
      : null;
  },
});

export const getPurchaseStatus = query({
  args: { purchaseId: v.string() },
  handler: async (ctx, args) => {
    const creator = await requireCreatorProfile(ctx);
    const purchase = await ctx.db
      .query("purchases")
      .withIndex("by_purchaseId", (q) => q.eq("purchaseId", args.purchaseId))
      .unique();
    if (!purchase || purchase.creatorId !== creator._id) return null;
    return {
      purchaseId: purchase.purchaseId,
      packId: purchase.packId,
      passCount: purchase.passCount,
      amountMinor: purchase.amountMinor,
      currency: purchase.currency,
      status: purchaseStatus(purchase),
    };
  },
});

type PreparedPurchase = {
  purchaseId: string;
  purchaseDocId: Id<"purchases">;
  creatorId: Id<"creatorProfiles">;
  creatorEmail: string;
  creatorName: string;
  pack: InterviewPassPack;
  stripeCustomerId?: string;
  checkoutUrl?: string;
};

export const replaceCatalog = internalMutation({
  args: {
    items: v.array(
      v.object({
        packId: purchasePackId,
        lookupKey: v.string(),
        priceId: v.string(),
        productId: v.string(),
        passCount: v.union(v.literal(1), v.literal(5)),
        amountMinor: v.number(),
        currency: v.literal("eur"),
        active: v.boolean(),
        syncedAt: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const item of args.items) {
      const existing = await catalogRowFor(ctx, item.packId);
      if (existing) {
        await ctx.db.patch("stripeCatalog", existing._id, item);
      } else {
        await ctx.db.insert("stripeCatalog", item);
      }
    }
    return null;
  },
});

export const syncCatalog = internalAction({
  args: {},
  handler: async (ctx) => {
    const configuration = readStripeConfiguration(env);
    const gateway = createStripeGateway(configuration);
    await gateway.getAccount();
    const items = await Promise.all(
      packsFor(configuration).map((definition) =>
        gateway.resolveApprovedCatalogItem(definition),
      ),
    );
    const syncedAt = Date.now();
    await ctx.runMutation(internalRefs.billing.replaceCatalog, {
      items: items.map((item) => ({
        packId: item.id,
        lookupKey: item.lookupKey,
        priceId: item.priceId,
        productId: item.productId,
        passCount: item.passCount,
        amountMinor: item.amountMinor,
        currency: item.currency,
        active: true,
        syncedAt,
      })),
    });
    return { syncedAt, packCount: items.length };
  },
});

const prepared = (
  purchase: Doc<"purchases">,
  creator: Doc<"creatorProfiles">,
  pack: InterviewPassPack,
): PreparedPurchase => ({
  purchaseId: purchase.purchaseId,
  purchaseDocId: purchase._id,
  creatorId: creator._id,
  creatorEmail: creator.email,
  creatorName: creator.displayName,
  pack,
  ...(purchase.stripeCustomerId
    ? { stripeCustomerId: purchase.stripeCustomerId }
    : {}),
  ...(purchase.checkoutUrl ? { checkoutUrl: purchase.checkoutUrl } : {}),
});

export const preparePurchase = internalMutation({
  args: { packId: purchasePackId },
  handler: async (ctx, args): Promise<PreparedPurchase> => {
    const creator = await requireCreatorProfile(ctx);
    await ensureIntroductoryPass(ctx, creator._id);
    const configuration = readStripeConfiguration(env);
    const definition = packForId(configuration, args.packId);
    const catalogRow = await catalogRowFor(ctx, definition.id);
    if (!catalogRow) throw catalogUnavailable();
    const pack = resolvedPackFromCatalogRow(definition, catalogRow);
    const now = Date.now();
    const candidates = await ctx.db
      .query("purchases")
      .withIndex("by_creatorId_and_state", (q) =>
        q.eq("creatorId", creator._id).eq("state", "pending"),
      )
      .order("desc")
      .take(10);
    const reusable = candidates.find(
      (candidate) =>
        candidate.packId === pack.id &&
        candidate.lookupKey === pack.lookupKey &&
        candidate.priceId === pack.priceId &&
        candidate.amountMinor === pack.amountMinor &&
        !candidate.checkoutSessionId &&
        now - candidate.createdAt < PURCHASE_REUSE_WINDOW_MS,
    );
    if (reusable) return prepared(reusable, creator, pack);
    const purchaseId = `purchase_${crypto.randomUUID()}`;
    const purchaseDocId = await ctx.db.insert("purchases", {
      purchaseId,
      creatorId: creator._id,
      packId: pack.id,
      priceId: pack.priceId,
      lookupKey: pack.lookupKey,
      quantity: 1,
      passCount: pack.passCount,
      amountMinor: pack.amountMinor,
      currency: pack.currency,
      state: "pending",
      refundState: "none",
      disputeState: "none",
      createdAt: now,
      updatedAt: now,
    });
    const purchase = await ctx.db.get("purchases", purchaseDocId);
    if (!purchase) throw new Error("Purchase could not be initialized.");
    return prepared(purchase, creator, pack);
  },
});

export const refreshPendingPurchaseCatalog = internalMutation({
  args: {
    purchaseId: v.id("purchases"),
    lookupKey: v.string(),
    priceId: v.string(),
    amountMinor: v.number(),
  },
  handler: async (ctx, args) => {
    const purchase = await ctx.db.get("purchases", args.purchaseId);
    if (
      !purchase ||
      purchase.state !== "pending" ||
      purchase.checkoutSessionId
    ) {
      return null;
    }
    await ctx.db.patch("purchases", purchase._id, {
      lookupKey: args.lookupKey,
      priceId: args.priceId,
      amountMinor: args.amountMinor,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const attachCustomer = internalMutation({
  args: { purchaseId: v.id("purchases"), customerId: v.string() },
  handler: async (ctx, args) => {
    const purchase = await ctx.db.get("purchases", args.purchaseId);
    if (!purchase || purchase.state !== "pending") return null;
    const creator = await ctx.db.get("creatorProfiles", purchase.creatorId);
    if (!creator) throw new Error("Purchase Creator not found.");
    await ctx.db.patch("creatorProfiles", creator._id, {
      stripeCustomerId: args.customerId,
      updatedAt: Date.now(),
    });
    await ctx.db.patch("purchases", purchase._id, {
      stripeCustomerId: args.customerId,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const attachCheckoutSession = internalMutation({
  args: {
    purchaseId: v.id("purchases"),
    checkoutSessionId: v.string(),
    checkoutUrl: v.string(),
    paymentIntentId: v.optional(v.string()),
    customerId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const purchase = await ctx.db.get("purchases", args.purchaseId);
    if (!purchase || purchase.state !== "pending") return null;
    await ctx.db.patch("purchases", purchase._id, {
      checkoutSessionId: args.checkoutSessionId,
      checkoutUrl: args.checkoutUrl,
      ...(args.paymentIntentId ? { paymentIntentId: args.paymentIntentId } : {}),
      ...(args.customerId ? { stripeCustomerId: args.customerId } : {}),
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const failPendingPurchase = internalMutation({
  args: { purchaseId: v.id("purchases") },
  handler: async (ctx, args) => {
    const purchase = await ctx.db.get("purchases", args.purchaseId);
    if (!purchase || purchase.state !== "pending" || purchase.checkoutSessionId) {
      return null;
    }
    await ctx.db.patch("purchases", purchase._id, {
      state: "failed",
      updatedAt: Date.now(),
    });
    return null;
  },
});

const userFacingCheckoutError = (error: unknown) => {
  if (error instanceof StripeProviderError) {
    if (error.code === "STRIPE_MODE_MISMATCH") {
      return "Checkout is unavailable because the Stripe deployment mode is misconfigured.";
    }
    if (error.code === "STRIPE_CATALOG_MISMATCH") {
      return "Checkout is unavailable because the configured Interview Pass catalog is not approved.";
    }
  }
  return "Checkout is temporarily unavailable. Please try again.";
};

export const createCheckoutSession = action({
  args: { packId: purchasePackId },
  handler: async (ctx, args) => {
    let purchase: PreparedPurchase | null = null;
    try {
      purchase = await ctx.runMutation(internalRefs.billing.preparePurchase, {
        packId: args.packId,
      });
      const configuration = readStripeConfiguration(env);
      const gateway = createStripeGateway(configuration);
      await gateway.getAccount();
      if (purchase.checkoutUrl) {
        return { purchaseId: purchase.purchaseId, url: purchase.checkoutUrl };
      }
      const currentPack = await gateway.resolveApprovedCatalogItem(
        packForId(configuration, args.packId),
      );
      if (
        purchase.pack.lookupKey !== currentPack.lookupKey ||
        purchase.pack.priceId !== currentPack.priceId ||
        purchase.pack.amountMinor !== currentPack.amountMinor
      ) {
        await ctx.runMutation(internalRefs.billing.refreshPendingPurchaseCatalog, {
          purchaseId: purchase.purchaseDocId,
          lookupKey: currentPack.lookupKey,
          priceId: currentPack.priceId,
          amountMinor: currentPack.amountMinor,
        });
        purchase = { ...purchase, pack: currentPack };
      }
      let customerId = purchase.stripeCustomerId;
      if (customerId) {
        try {
          customerId = (await gateway.retrieveCustomer(customerId)).id;
        } catch {
          customerId = undefined;
        }
      }
      if (!customerId) {
        customerId = (
          await gateway.createCustomer(
            {
              email: purchase.creatorEmail,
              name: purchase.creatorName,
              creatorProfileId: purchase.creatorId,
            },
            `customer:${purchase.creatorId}`,
          )
        ).id;
      }
      await ctx.runMutation(internalRefs.billing.attachCustomer, {
        purchaseId: purchase.purchaseDocId,
        customerId,
      });
      const session = await gateway.createCheckoutSession(
        {
          pack: purchase.pack,
          purchaseId: purchase.purchaseId,
          customerId,
        },
        `checkout:${purchase.purchaseId}`,
      );
      await ctx.runMutation(internalRefs.billing.attachCheckoutSession, {
        purchaseId: purchase.purchaseDocId,
        checkoutSessionId: session.id,
        checkoutUrl: session.url,
        ...(session.paymentIntentId
          ? { paymentIntentId: session.paymentIntentId }
          : {}),
        ...(session.customerId ? { customerId: session.customerId } : {}),
      });
      return { purchaseId: purchase.purchaseId, url: session.url };
    } catch (error) {
      if (purchase) {
        await ctx.runMutation(internalRefs.billing.failPendingPurchase, {
          purchaseId: purchase.purchaseDocId,
        });
      }
      throw new Error(userFacingCheckoutError(error));
    }
  },
});

const purchaseForEvent = async (
  ctx: MutationCtx,
  event: StripeWebhookEvent,
) => {
  if (event.eventType.startsWith("checkout.session.")) {
    const bySession = await ctx.db
      .query("purchases")
      .withIndex("by_checkoutSessionId", (q) =>
        q.eq("checkoutSessionId", event.objectId),
      )
      .unique();
    if (bySession) return bySession;
  }
  if (event.paymentIntentId) {
    const byPaymentIntent = await ctx.db
      .query("purchases")
      .withIndex("by_paymentIntentId", (q) =>
        q.eq("paymentIntentId", event.paymentIntentId),
      )
      .unique();
    if (byPaymentIntent) return byPaymentIntent;
  }
  if (event.chargeId) {
    const byCharge = await ctx.db
      .query("purchases")
      .withIndex("by_chargeId", (q) => q.eq("chargeId", event.chargeId))
      .unique();
    if (byCharge) return byCharge;
  }
  if (event.purchaseId) {
    return await ctx.db
      .query("purchases")
      .withIndex("by_purchaseId", (q) => q.eq("purchaseId", event.purchaseId!))
      .unique();
  }
  return null;
};

const updateStripeReferences = async (
  ctx: MutationCtx,
  purchase: Doc<"purchases">,
  event: StripeWebhookEvent,
) => {
  const patch: Partial<Doc<"purchases">> = {
    lastStripeEventId: event.eventId,
    ...(event.eventType.startsWith("checkout.session.")
      ? { checkoutSessionId: event.objectId }
      : {}),
    ...(event.paymentIntentId ? { paymentIntentId: event.paymentIntentId } : {}),
    ...(event.customerId ? { stripeCustomerId: event.customerId } : {}),
    ...(event.chargeId ? { chargeId: event.chargeId } : {}),
    updatedAt: Date.now(),
  };
  await ctx.db.patch("purchases", purchase._id, patch);
};

const markEvent = async (
  ctx: MutationCtx,
  event: StripeWebhookEvent,
  processingState: "processed" | "ignored" | "deferred",
  purchaseId?: Id<"purchases">,
) => {
  const existing = await ctx.db
    .query("stripeEvents")
    .withIndex("by_eventId", (q) => q.eq("eventId", event.eventId))
    .unique();
  const values = {
    eventId: event.eventId,
    eventType: event.eventType,
    objectId: event.objectId,
    processingState,
    ...(purchaseId ? { purchaseId } : {}),
    receivedAt: existing?.receivedAt ?? Date.now(),
    ...(processingState === "deferred" ? {} : { processedAt: Date.now() }),
  };
  if (existing) {
    await ctx.db.patch("stripeEvents", existing._id, values);
  } else {
    await ctx.db.insert("stripeEvents", values);
  }
};

const purchaseGrantAlreadyExists = async (
  ctx: MutationCtx,
  purchaseId: Id<"purchases">,
) => hasLedgerEntry(ctx, `purchase-grant:${purchaseId}`);

const handleCheckoutEvent = async (
  ctx: MutationCtx,
  purchase: Doc<"purchases">,
  event: StripeWebhookEvent,
) => {
  await updateStripeReferences(ctx, purchase, event);
  if (event.eventType === "checkout.session.async_payment_failed") {
    if (
      (purchase.state === "pending" ||
        purchase.state === "unpaid" ||
        purchase.state === "failed") &&
      purchase.refundState !== "full"
    ) {
      await ctx.db.patch("purchases", purchase._id, {
        state: "failed",
        updatedAt: Date.now(),
      });
    }
    await markEvent(ctx, event, "processed", purchase._id);
    return;
  }
  const paid =
    event.eventType === "checkout.session.async_payment_succeeded" ||
    event.paymentStatus === "paid";
  if (!paid) {
    if (purchase.state === "pending" || purchase.state === "unpaid") {
      await ctx.db.patch("purchases", purchase._id, {
        state: "unpaid",
        updatedAt: Date.now(),
      });
    }
    await markEvent(ctx, event, "ignored", purchase._id);
    return;
  }
  if (purchase.refundState === "full" || purchase.disputeState === "lost") {
    await ctx.db.patch("purchases", purchase._id, {
      state: purchase.refundState === "full" ? "refunded" : "disputed",
      updatedAt: Date.now(),
    });
    await markEvent(ctx, event, "ignored", purchase._id);
    return;
  }
  if (!(await purchaseGrantAlreadyExists(ctx, purchase._id))) {
    await grantPurchasePasses(ctx, {
      creatorId: purchase.creatorId,
      purchaseId: purchase._id,
      passCount: purchase.passCount,
      stripeEventId: event.eventId,
    });
  }
  const confirmedState =
    purchase.refundState === "partial_reconciliation_required"
      ? ("partially_refunded" as const)
      : purchase.disputeState === "open"
        ? ("disputed" as const)
        : ("paid" as const);
  await ctx.db.patch("purchases", purchase._id, {
    state: confirmedState,
    updatedAt: Date.now(),
  });
  await markEvent(ctx, event, "processed", purchase._id);
};

const handleRefundEvent = async (
  ctx: MutationCtx,
  purchase: Doc<"purchases">,
  event: StripeWebhookEvent,
) => {
  await updateStripeReferences(ctx, purchase, event);
  const refundedAmount = event.amountRefunded ?? event.amount ?? 0;
  const previousRefunded = purchase.refundedAmountMinor ?? 0;
  const totalRefunded = Math.max(previousRefunded, refundedAmount);
  const full = totalRefunded >= purchase.amountMinor;
  if (!full) {
    await ctx.db.patch("purchases", purchase._id, {
      state: "partially_refunded",
      refundState: "partial_reconciliation_required",
      refundedAmountMinor: totalRefunded,
      updatedAt: Date.now(),
    });
    await markEvent(ctx, event, "processed", purchase._id);
    return;
  }
  if (purchase.refundState !== "full") {
    const disputeDebitExists = await hasLedgerEntry(
      ctx,
      `dispute-debit:${purchase._id}`,
    );
    const activeDisputeDebit =
      disputeDebitExists && purchase.disputeState !== "won";
    if (!activeDisputeDebit) {
      await revokePurchasePasses(ctx, {
        creatorId: purchase.creatorId,
        purchaseId: purchase._id,
        passCount: purchase.passCount,
        kind: "purchase_refund_debit",
        idempotencyKey: `purchase-refund:${purchase._id}`,
        stripeEventId: event.eventId,
      });
    }
  }
  await ctx.db.patch("purchases", purchase._id, {
    state: "refunded",
    refundState: "full",
    refundedAmountMinor: totalRefunded,
    updatedAt: Date.now(),
  });
  await markEvent(ctx, event, "processed", purchase._id);
};

const handleDisputeEvent = async (
  ctx: MutationCtx,
  purchase: Doc<"purchases">,
  event: StripeWebhookEvent,
) => {
  await updateStripeReferences(ctx, purchase, event);
  const won =
    event.eventType === "charge.dispute.funds_reinstated" ||
    (event.eventType === "charge.dispute.closed" &&
      event.disputeStatus === "won");
  const lost =
    event.eventType === "charge.dispute.funds_withdrawn" ||
    (event.eventType === "charge.dispute.closed" &&
      event.disputeStatus === "lost");
  if (won) {
    if (purchase.refundState !== "full") {
      await restoreDisputedPurchasePasses(ctx, {
        creatorId: purchase.creatorId,
        purchaseId: purchase._id,
        passCount: purchase.passCount,
        stripeEventId: event.eventId,
      });
    }
    await ctx.db.patch("purchases", purchase._id, {
      state:
        purchase.refundState === "full"
          ? "refunded"
          : purchase.refundState === "partial_reconciliation_required"
            ? "partially_refunded"
            : "paid",
      disputeState: "won",
      updatedAt: Date.now(),
    });
    await markEvent(ctx, event, "processed", purchase._id);
    return;
  }
  if (lost || event.eventType === "charge.dispute.created") {
    if (purchase.refundState !== "full") {
      await revokePurchasePasses(ctx, {
        creatorId: purchase.creatorId,
        purchaseId: purchase._id,
        passCount: purchase.passCount,
        kind: "dispute_debit",
        idempotencyKey: `dispute-debit:${purchase._id}`,
        stripeEventId: event.eventId,
      });
    }
    await ctx.db.patch("purchases", purchase._id, {
      state: purchase.refundState === "full" ? "refunded" : "disputed",
      disputeState: lost ? "lost" : "open",
      updatedAt: Date.now(),
    });
    await markEvent(ctx, event, "processed", purchase._id);
    return;
  }
  await markEvent(ctx, event, "ignored", purchase._id);
};

export const handleWebhook = internalMutation({
  args: { event: sanitizedStripeWebhookEvent },
  handler: async (ctx, args) => {
    const event = args.event as StripeWebhookEvent;
    const existingEvent = await ctx.db
      .query("stripeEvents")
      .withIndex("by_eventId", (q) => q.eq("eventId", event.eventId))
      .unique();
    if (
      existingEvent &&
      (existingEvent.processingState === "processed" ||
        existingEvent.processingState === "ignored")
    ) {
      return { state: existingEvent.processingState } as const;
    }
    if (
      event.eventType === "price.created" ||
      event.eventType === "price.updated"
    ) {
      await ctx.scheduler.runAfter(0, internalRefs.billing.syncCatalog, {});
      await markEvent(ctx, event, "processed");
      return { state: "processed" as const };
    }
    const purchase = await purchaseForEvent(ctx, event);
    if (!purchase) {
      await markEvent(ctx, event, "deferred");
      return { state: "deferred" as const };
    }
    if (
      event.customerId &&
      purchase.stripeCustomerId &&
      event.customerId !== purchase.stripeCustomerId
    ) {
      await markEvent(ctx, event, "deferred", purchase._id);
      return { state: "deferred" as const };
    }
    if (event.eventType.startsWith("checkout.session.")) {
      await handleCheckoutEvent(ctx, purchase, event);
    } else if (
      event.eventType === "charge.refunded" ||
      event.eventType === "refund.created"
    ) {
      await handleRefundEvent(ctx, purchase, event);
    } else {
      await handleDisputeEvent(ctx, purchase, event);
    }
    return { state: "processed" as const };
  },
});

export const operatorAdjust = internalMutation({
  args: {
    creatorId: v.id("creatorProfiles"),
    amount: v.number(),
    idempotencyKey: v.string(),
    note: v.string(),
  },
  handler: async (ctx, args) =>
    await adjustPassBalance(ctx, {
      creatorId: args.creatorId,
      amount: args.amount,
      idempotencyKey: args.idempotencyKey,
      note: args.note,
    }),
});

export const ledgerPage = internalQuery({
  args: {
    creatorId: v.id("creatorProfiles"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) =>
    await ctx.db
      .query("passLedger")
      .withIndex("by_creatorId_and_createdAt", (q) =>
        q.eq("creatorId", args.creatorId),
      )
      .paginate(args.paginationOpts),
});

export const accountSnapshot = internalQuery({
  args: { creatorId: v.id("creatorProfiles") },
  handler: async (ctx, args) =>
    await ctx.db
      .query("passAccounts")
      .withIndex("by_creatorId", (q) => q.eq("creatorId", args.creatorId))
      .unique(),
});

export const purchaseReconciliationPage = internalQuery({
  args: {
    creatorId: v.id("creatorProfiles"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("purchases")
      .withIndex("by_creatorId_and_state", (q) =>
        q.eq("creatorId", args.creatorId),
      )
      .paginate(args.paginationOpts);
    return {
      ...page,
      page: await Promise.all(
        page.page.map(async (purchase) => ({
          purchase,
          ledgerKeys: (
            await ctx.db
              .query("passLedger")
              .withIndex("by_purchaseId", (q) => q.eq("purchaseId", purchase._id))
              .take(20)
          ).map((entry) => entry.idempotencyKey),
        })),
      ),
    };
  },
});

export const reconcileCreator = internalAction({
  args: { creatorId: v.id("creatorProfiles") },
  handler: async (ctx, args) => {
    let cursor: string | null = null;
    let balanceFromLedger = 0;
    let introductoryFromLedger = 0;
    let purchasedFromLedger = 0;
    let reservedFromLedger = 0;
    let consumedFromLedger = 0;
    let entries = 0;
    let introductoryGrantEntries = 0;
    let purchaseCursor: string | null = null;
    let purchaseCount = 0;
    const purchaseIssues: string[] = [];
    for (;;) {
      const page: {
        page: Array<Doc<"passLedger">>;
        isDone: boolean;
        continueCursor: string;
      } = await ctx.runQuery(internalRefs.billing.ledgerPage, {
        creatorId: args.creatorId,
        paginationOpts: { numItems: 100, cursor },
      });
      for (const entry of page.page) {
        entries += 1;
        balanceFromLedger += entry.amount;
        introductoryFromLedger += entry.introductoryDelta;
        purchasedFromLedger += entry.purchasedDelta;
        reservedFromLedger += entry.reservedDelta ?? 0;
        consumedFromLedger += entry.consumedDelta ?? 0;
        if (entry.kind === "introductory_grant") introductoryGrantEntries += 1;
      }
      if (page.isDone) break;
      cursor = page.continueCursor;
    }
    for (;;) {
      const page: {
        page: Array<{ purchase: Doc<"purchases">; ledgerKeys: string[] }>;
        isDone: boolean;
        continueCursor: string;
      } = await ctx.runQuery(
        internalRefs.billing.purchaseReconciliationPage,
        {
          creatorId: args.creatorId,
          paginationOpts: { numItems: 100, cursor: purchaseCursor },
        },
      );
      for (const { purchase, ledgerKeys } of page.page) {
        purchaseCount += 1;
        const grant = ledgerKeys.includes(`purchase-grant:${purchase._id}`);
        const refund = ledgerKeys.includes(`purchase-refund:${purchase._id}`);
        const disputeDebit = ledgerKeys.includes(`dispute-debit:${purchase._id}`);
        const disputeRestoration = ledgerKeys.includes(
          `dispute-restoration:${purchase._id}`,
        );
        const shouldHaveGrant =
          purchase.state === "paid" ||
          purchase.state === "partially_refunded" ||
          purchase.state === "refunded" ||
          purchase.state === "disputed";
        if (shouldHaveGrant !== grant) {
          purchaseIssues.push(`${purchase.purchaseId}:grant`);
        }
        if (
          purchase.refundState === "full" &&
          grant &&
          !refund &&
          !(disputeDebit && purchase.disputeState !== "won")
        ) {
          purchaseIssues.push(`${purchase.purchaseId}:refund`);
        }
        if (
          (purchase.disputeState === "open" || purchase.disputeState === "lost") &&
          grant &&
          !disputeDebit
        ) {
          purchaseIssues.push(`${purchase.purchaseId}:dispute-debit`);
        }
        if (
          purchase.disputeState === "won" &&
          disputeDebit &&
          !disputeRestoration &&
          purchase.refundState !== "full"
        ) {
          purchaseIssues.push(`${purchase.purchaseId}:dispute-restoration`);
        }
      }
      if (page.isDone) break;
      purchaseCursor = page.continueCursor;
    }
    const account = await ctx.runQuery(internalRefs.billing.accountSnapshot, {
      creatorId: args.creatorId,
    });
    const matches =
      account !== null &&
      account.balance === balanceFromLedger &&
      account.introductoryBalance === introductoryFromLedger &&
      account.purchasedBalance === purchasedFromLedger &&
      account.reservedBalance === reservedFromLedger &&
      account.consumedBalance === consumedFromLedger &&
      account.introductoryGranted === (introductoryGrantEntries > 0);
    return {
      entries,
      introductoryGrantEntries,
      purchaseCount,
      purchaseIssues,
      balanceFromLedger,
      introductoryFromLedger,
      purchasedFromLedger,
      reservedFromLedger,
      consumedFromLedger,
      cached: account
        ? {
            balance: account.balance,
            introductoryBalance: account.introductoryBalance,
            purchasedBalance: account.purchasedBalance,
            reservedBalance: account.reservedBalance,
            consumedBalance: account.consumedBalance,
          }
        : null,
      matches: matches && purchaseIssues.length === 0,
    };
  },
});
