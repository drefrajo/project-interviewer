/// <reference types="vite/client" />

import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import { register as registerAgent } from "@convex-dev/agent/test";
import { createThread } from "@convex-dev/agent";
import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import schema from "./schema";
import { hashCapability, sealCapabilityToken } from "./lib/capability_crypto";
import { agentComponent } from "./lib/components";

const modules = import.meta.glob("./**/*.ts");
type Harness = TestConvex<typeof schema>;

// Test-only encryption material for link rotation. No deployment secret is
// used by these deterministic tests.
process.env.CAPABILITY_ENCRYPTION_SECRET ??= "test-only-capability-secret";

const creatorIdentity = (tokenIdentifier: string) => ({ tokenIdentifier });

const seedCreator = async (t: Harness, tokenIdentifier: string) =>
  await t.run(async (ctx) =>
    await ctx.db.insert("creatorProfiles", {
      authUserId: `${tokenIdentifier}-auth`,
      tokenIdentifier,
      email: `${tokenIdentifier.replaceAll("|", "-")}@example.test`,
      displayName: tokenIdentifier,
      createdAt: 1,
      updatedAt: 1,
    }),
  );

const seedInterview = async (
  t: Harness,
  creatorId: Id<"creatorProfiles">,
  token: string,
  overrides: Partial<Doc<"interviews">> = {},
) => {
  const linkHash = await hashCapability(token);
  const sealedToken = await sealCapabilityToken(
    token,
    process.env.CAPABILITY_ENCRYPTION_SECRET!,
    `interview-link:${linkHash}`,
  );
  return await t.run(async (ctx) =>
    await ctx.db.insert("interviews", {
      creatorId,
      agentThreadId: `thread-${token}`,
      linkHash,
      linkTokenCiphertext: sealedToken.ciphertext,
      linkTokenIv: sealedToken.iv,
      linkVersion: 1,
      projectName: "Portfolio",
      clientLanguage: "en",
      model: "gpt-5.6-terra",
      instructions: "Interview the Client.",
      passState: "unreserved",
      createdAt: 1,
      updatedAt: 1,
      step: "interview",
      clientMessageCount: 0,
      documentRevisionCount: 0,
      concepts: [],
      usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
      ...overrides,
    } as never),
  );
};

const seedPurchase = async (
  t: Harness,
  creatorId: Id<"creatorProfiles">,
  input: {
    purchaseId: string;
    passCount?: 1 | 5;
    amountMinor?: 2900 | 9900;
  },
) =>
  await t.run(async (ctx) =>
    await ctx.db.insert("purchases", {
      purchaseId: input.purchaseId,
      creatorId,
      packId: input.passCount === 5 ? "five_passes" : "one_pass",
      priceId: input.passCount === 5 ? "price_five_sandbox" : "price_one_sandbox",
      quantity: 1,
      passCount: input.passCount ?? 1,
      amountMinor: input.amountMinor ?? 2900,
      currency: "eur",
      state: "pending",
      refundState: "none",
      disputeState: "none",
      stripeCustomerId: `cus-${input.purchaseId}`,
      createdAt: 1,
      updatedAt: 1,
    }),
  );

const checkoutEvent = (input: {
  eventId: string;
  purchaseId: string;
  paymentStatus?: string;
  eventType?:
    | "checkout.session.completed"
    | "checkout.session.async_payment_succeeded"
    | "checkout.session.async_payment_failed";
}) => ({
  eventId: input.eventId,
  eventType: input.eventType ?? "checkout.session.completed",
  objectId: `cs-${input.purchaseId}`,
  purchaseId: input.purchaseId,
  ...(input.paymentStatus ? { paymentStatus: input.paymentStatus } : {}),
  customerId: `cus-${input.purchaseId}`,
});

const readPassState = async (t: Harness, creatorId: Id<"creatorProfiles">) =>
  await t.run(async (ctx) => ({
    account: await ctx.db
      .query("passAccounts")
      .withIndex("by_creatorId", (q) => q.eq("creatorId", creatorId))
      .unique(),
    ledger: await ctx.db
      .query("passLedger")
      .withIndex("by_creatorId_and_createdAt", (q) =>
        q.eq("creatorId", creatorId),
      )
      .order("asc")
      .collect(),
  }));

describe("pass accounting and Interview reservation", () => {
  it("grants exactly one introductory pass to new and existing Creators", async () => {
    const t = convexTest(schema, modules);
    const existingCreatorId = await seedCreator(t, "test|existing");
    const newCreatorId = await seedCreator(t, "test|new");

    for (const [index, creatorId] of [existingCreatorId, newCreatorId].entries()) {
      await t.mutation(internal.billing.operatorAdjust, {
        creatorId,
        amount: 0,
        idempotencyKey: `intro-check-${index}`,
        note: "Initialize test Creator pass account.",
      });
    }

    for (const creatorId of [existingCreatorId, newCreatorId]) {
      const state = await readPassState(t, creatorId);
      expect(state.account).toMatchObject({
        balance: 1,
        introductoryBalance: 1,
        purchasedBalance: 0,
        introductoryGranted: true,
      });
      expect(
        state.ledger.filter((entry) => entry.kind === "introductory_grant"),
      ).toHaveLength(1);
    }
  });

  it("grants one or five purchased passes only after paid completion", async () => {
    const t = convexTest(schema, modules);
    const creatorId = await seedCreator(t, "test|purchases");
    await seedPurchase(t, creatorId, { purchaseId: "purchase-one", passCount: 1 });
    await seedPurchase(t, creatorId, { purchaseId: "purchase-five", passCount: 5, amountMinor: 9900 });

    await expect(
      t.mutation(internal.billing.handleWebhook, {
        event: checkoutEvent({
          eventId: "evt-unpaid",
          purchaseId: "purchase-one",
          paymentStatus: "unpaid",
        }),
      }),
    ).resolves.toEqual({ state: "processed" });
    let state = await readPassState(t, creatorId);
    expect(state.account).toBeNull();

    await t.mutation(internal.billing.handleWebhook, {
      event: checkoutEvent({
        eventId: "evt-one-paid",
        purchaseId: "purchase-one",
        paymentStatus: "paid",
      }),
    });
    await t.mutation(internal.billing.handleWebhook, {
      event: checkoutEvent({
        eventId: "evt-five-paid",
        purchaseId: "purchase-five",
        eventType: "checkout.session.async_payment_succeeded",
      }),
    });
    state = await readPassState(t, creatorId);
    expect(state.account).toMatchObject({
      balance: 7,
      introductoryBalance: 1,
      purchasedBalance: 6,
    });
    expect(state.ledger.filter((entry) => entry.kind === "purchase_grant")).toHaveLength(2);
  });

  it("fulfills delayed, duplicate, and reordered checkout events once", async () => {
    const t = convexTest(schema, modules);
    const creatorId = await seedCreator(t, "test|webhooks");
    await seedPurchase(t, creatorId, { purchaseId: "purchase-delayed", passCount: 5, amountMinor: 9900 });

    await t.mutation(internal.billing.handleWebhook, {
      event: checkoutEvent({
        eventId: "evt-delayed-success",
        purchaseId: "purchase-delayed",
        eventType: "checkout.session.async_payment_succeeded",
      }),
    });
    await t.mutation(internal.billing.handleWebhook, {
      event: checkoutEvent({
        eventId: "evt-delayed-success",
        purchaseId: "purchase-delayed",
        eventType: "checkout.session.async_payment_succeeded",
      }),
    });
    await t.mutation(internal.billing.handleWebhook, {
      event: checkoutEvent({
        eventId: "evt-reordered-unpaid",
        purchaseId: "purchase-delayed",
        paymentStatus: "unpaid",
      }),
    });
    const state = await readPassState(t, creatorId);
    expect(state.ledger.filter((entry) => entry.kind === "purchase_grant")).toHaveLength(1);
    expect(state.account?.balance).toBe(6);
    const purchase = await t.run(async (ctx) =>
      await ctx.db
        .query("purchases")
        .withIndex("by_purchaseId", (q) => q.eq("purchaseId", "purchase-delayed"))
        .unique(),
    );
    expect(purchase?.state).toBe("paid");
  });

  it("marks failed delayed payments without granting passes", async () => {
    const t = convexTest(schema, modules);
    const creatorId = await seedCreator(t, "test|failed-payment");
    await seedPurchase(t, creatorId, { purchaseId: "purchase-failed" });
    await t.mutation(internal.billing.handleWebhook, {
      event: checkoutEvent({
        eventId: "evt-failed-payment",
        purchaseId: "purchase-failed",
        eventType: "checkout.session.async_payment_failed",
      }),
    });
    const state = await readPassState(t, creatorId);
    expect(state.account).toBeNull();
    const purchase = await t.run(async (ctx) =>
      await ctx.db
        .query("purchases")
        .withIndex("by_purchaseId", (q) => q.eq("purchaseId", "purchase-failed"))
        .unique(),
    );
    expect(purchase?.state).toBe("failed");
  });

  it("reserves on the first shared link and consumes exactly once on concurrent Start", async () => {
    const t = convexTest(schema, modules);
    registerRateLimiter(t);
    const tokenIdentifier = "test|reservation";
    const creatorId = await seedCreator(t, tokenIdentifier);
    const token = "reservation-token";
    const interviewId = await seedInterview(t, creatorId, token, {
      passState: "unreserved",
    });

    const reservations = await Promise.all([
      t.withIdentity(creatorIdentity(tokenIdentifier)).mutation(api.interviews.reserveLink, {
        interviewId,
      }),
      t.withIdentity(creatorIdentity(tokenIdentifier)).mutation(api.interviews.reserveLink, {
        interviewId,
      }),
    ]);
    expect(reservations.filter((result) => result.reserved)).toHaveLength(1);
    expect(reservations.filter((result) => result.alreadyReserved)).toHaveLength(1);
    const state = await readPassState(t, creatorId);
    expect(state.account).toMatchObject({
      balance: 0,
      reservedBalance: 1,
      introductoryBalance: 0,
      reservedIntroductoryBalance: 1,
    });
    expect(state.ledger.filter((entry) => entry.kind === "reservation_hold")).toHaveLength(1);
    const interview = await t.run(async (ctx) => await ctx.db.get("interviews", interviewId));
    expect(interview?.passState).toBe("reserved");

    await Promise.all([
      t.mutation(api.client.start, { token }),
      t.mutation(api.client.start, { token }),
    ]);
    const consumed = await readPassState(t, creatorId);
    expect(consumed.account).toMatchObject({
      balance: 0,
      reservedBalance: 0,
      consumedBalance: 1,
    });
    expect(
      consumed.ledger.filter((entry) => entry.kind === "reservation_consumption"),
    ).toHaveLength(1);
    const consumedInterview = await t.run(async (ctx) => await ctx.db.get("interviews", interviewId));
    expect(consumedInterview?.passState).toBe("consumed");

    await t.withIdentity(creatorIdentity(tokenIdentifier)).mutation(api.interviews.rotateLink, {
      interviewId,
    });
    const afterRotation = await readPassState(t, creatorId);
    expect(afterRotation.ledger.filter((entry) => entry.kind === "reservation_hold")).toHaveLength(1);
  });

  it("keeps unreserved links out of the workflow while reserved links work", async () => {
    const t = convexTest(schema, modules);
    registerRateLimiter(t);
    const creatorId = await seedCreator(t, "test|client-links");
    const token = "client-link-token";
    const interviewId = await seedInterview(t, creatorId, token, {
      passState: "unreserved",
    });

    const blocked = await t.query(api.client.getByLink, { token });
    expect(blocked).toMatchObject({ reservationRequired: true, passState: "unreserved", started: false });
    let beforeStart = await readPassState(t, creatorId);
    expect(beforeStart.account).toBeNull();
    expect(beforeStart.ledger.filter((entry) => entry.kind === "reservation_consumption")).toHaveLength(0);
    await expect(t.query(api.transcripts.listForClient, { token })).rejects.toThrow(
      "waiting for the Creator to reserve a pass",
    );
    beforeStart = await readPassState(t, creatorId);
    expect(beforeStart.account).toBeNull();
    await expect(t.mutation(api.client.start, { token })).rejects.toThrow(
      "waiting for the Creator to reserve a pass",
    );

    await t.withIdentity(creatorIdentity("test|client-links")).mutation(api.interviews.reserveLink, {
      interviewId,
    });
    const usable = await t.query(api.client.getByLink, { token });
    expect(usable).toMatchObject({ reservationRequired: false, passState: "reserved" });
    await expect(
      t.mutation(api.client.sendMessage, { token, content: "bypass Start" }),
    ).rejects.toThrow("Start the Interview before sending a Client message");
    await expect(t.mutation(api.client.start, { token })).resolves.toBeNull();
  });

  it("returns one pass on deletion before the first accepted Client message, never after", async () => {
    const t = convexTest(schema, modules);
    const tokenIdentifier = "test|deletion";
    registerAgent(t);
    registerRateLimiter(t);
    const creatorId = await seedCreator(t, tokenIdentifier);
    const threadId = await t.run(async (ctx) =>
      await createThread(ctx, agentComponent, {
        userId: creatorId,
        title: "Portfolio",
      }),
    );
    const startedThreadId = await t.run(async (ctx) =>
      await createThread(ctx, agentComponent, {
        userId: creatorId,
        title: "Portfolio started",
      }),
    );
    const beforeStartId = await seedInterview(t, creatorId, "delete-before-message", {
      agentThreadId: threadId,
    });
    const afterStartId = await seedInterview(t, creatorId, "delete-after-message", {
      passState: "unreserved",
      agentThreadId: startedThreadId,
    });

    await t.withIdentity(creatorIdentity(tokenIdentifier)).mutation(api.interviews.reserveLink, {
      interviewId: beforeStartId,
    });
    let state = await readPassState(t, creatorId);
    expect(state.account?.balance).toBe(0);
    expect(state.account?.reservedBalance).toBe(1);
    await t.withIdentity(creatorIdentity(tokenIdentifier)).mutation(api.interviews.remove, {
      interviewId: beforeStartId,
      confirmation: "Portfolio",
    });
    state = await readPassState(t, creatorId);
    expect(state.account?.balance).toBe(1);
    expect(state.ledger.filter((entry) => entry.kind === "reservation_release")).toHaveLength(1);
    expect(state.account?.reservedBalance).toBe(0);
    await t.withIdentity(creatorIdentity(tokenIdentifier)).mutation(api.interviews.reserveLink, {
      interviewId: afterStartId,
    });
    await t.mutation(api.client.start, { token: "delete-after-message" });
    await t.withIdentity(creatorIdentity(tokenIdentifier)).mutation(api.interviews.remove, {
      interviewId: afterStartId,
      confirmation: "Portfolio",
    });
    state = await readPassState(t, creatorId);
    expect(state.ledger.filter((entry) => entry.kind === "reservation_release")).toHaveLength(1);
    expect(state.ledger.filter((entry) => entry.kind === "reservation_consumption")).toHaveLength(1);
    expect(state.account?.balance).toBe(0);
    expect(state.account?.reservedBalance).toBe(0);
  });

  it("releases an unstarted reservation on explicit deactivation exactly once", async () => {
    const t = convexTest(schema, modules);
    const tokenIdentifier = "test|deactivate";
    const creatorId = await seedCreator(t, tokenIdentifier);
    const interviewId = await seedInterview(t, creatorId, "deactivate-token", {
      passState: "unreserved",
    });

    await t.withIdentity(creatorIdentity(tokenIdentifier)).mutation(api.interviews.reserveLink, {
      interviewId,
    });
    const first = await t.withIdentity(creatorIdentity(tokenIdentifier)).mutation(
      api.interviews.deactivate,
      { interviewId },
    );
    const second = await t.withIdentity(creatorIdentity(tokenIdentifier)).mutation(
      api.interviews.deactivate,
      { interviewId },
    );
    expect(first).toEqual({ released: true });
    expect(second).toEqual({ released: false });
    const state = await readPassState(t, creatorId);
    expect(state.account).toMatchObject({ balance: 1, reservedBalance: 0 });
    expect(state.ledger.filter((entry) => entry.kind === "reservation_release")).toHaveLength(1);
    expect(await t.query(api.client.getByLink, { token: "deactivate-token" })).toMatchObject({
      reservationRequired: true,
      passState: "unreserved",
    });
    await t.withIdentity(creatorIdentity(tokenIdentifier)).mutation(api.interviews.reserveLink, {
      interviewId,
    });
    const reReserved = await readPassState(t, creatorId);
    expect(reReserved.account).toMatchObject({ balance: 0, reservedBalance: 1 });
    expect(reReserved.ledger.filter((entry) => entry.kind === "reservation_hold")).toHaveLength(2);
  });

  it("does not expose or mutate another Creator's billing or Interview state", async () => {
    const t = convexTest(schema, modules);
    const ownerToken = "test|owner";
    const otherToken = "test|other";
    const ownerId = await seedCreator(t, ownerToken);
    const otherId = await seedCreator(t, otherToken);
    const interviewId = await seedInterview(t, ownerId, "owned-link");
    await seedPurchase(t, ownerId, { purchaseId: "owned-purchase" });

    await t.mutation(internal.billing.operatorAdjust, {
      creatorId: ownerId,
      amount: 0,
      idempotencyKey: "owner-intro-check",
      note: "Initialize test Creator pass account.",
    });

    await t.mutation(internal.billing.operatorAdjust, {
      creatorId: otherId,
      amount: 0,
      idempotencyKey: "ownership-intro-check",
      note: "Initialize test Creator pass account.",
    });
    expect(
      await t.withIdentity(creatorIdentity(otherToken)).query(api.billing.getBalance, {}),
    ).toEqual({ availablePasses: 1, reservedPasses: 0, introductoryPasses: 1, purchasedPasses: 0 });
    expect(
      await t.withIdentity(creatorIdentity(otherToken)).query(api.billing.getPurchaseStatus, {
        purchaseId: "owned-purchase",
      }),
    ).toBeNull();
    await expect(
      t.withIdentity(creatorIdentity(otherToken)).mutation(api.interviews.reserveLink, {
        interviewId,
      }),
    ).rejects.toThrow("Interview not found");

    const ownerBalance = await t.withIdentity(creatorIdentity(ownerToken)).query(api.billing.getBalance, {});
    expect(ownerBalance).toEqual({ availablePasses: 1, reservedPasses: 0, introductoryPasses: 1, purchasedPasses: 0 });
    expect(otherId).not.toBe(ownerId);
  });

  it("keeps existing started and submitted Interviews usable without retroactive billing", async () => {
    const t = convexTest(schema, modules);
    const tokenIdentifier = "test|existing-data";
    const creatorId = await seedCreator(t, tokenIdentifier);
    const unstartedToken = "existing-unstarted";
    const startedToken = "existing-started";
    const submittedToken = "existing-submitted";
    const unstartedId = await seedInterview(t, creatorId, unstartedToken, {
      passState: "unreserved",
    });
    const startedId = await seedInterview(t, creatorId, startedToken, {
      passState: "consumed",
      startedAt: 2,
      frozenAt: 2,
    });
    const submittedId = await seedInterview(t, creatorId, submittedToken, {
      passState: "consumed",
      step: "submitted",
    });

    const unstarted = await t.query(api.client.getByLink, { token: unstartedToken });
    const started = await t.query(api.client.getByLink, { token: startedToken });
    const submitted = await t.query(api.client.getByLink, { token: submittedToken });
    expect(unstarted?.reservationRequired).toBe(true);
    expect(started?.reservationRequired).toBe(false);
    expect(submitted?.reservationRequired).toBe(false);

    await t.withIdentity(creatorIdentity(tokenIdentifier)).mutation(api.interviews.reserveLink, {
      interviewId: startedId,
    });
    await t.withIdentity(creatorIdentity(tokenIdentifier)).mutation(api.interviews.reserveLink, {
      interviewId: submittedId,
    });

    await t.withIdentity(creatorIdentity(tokenIdentifier)).mutation(api.interviews.reserveLink, {
      interviewId: unstartedId,
    });
    const state = await readPassState(t, creatorId);
    expect(state.ledger.filter((entry) => entry.kind === "reservation_hold")).toHaveLength(1);
    expect(state.account?.balance).toBe(0);
    expect(state.account?.reservedBalance).toBe(1);
  });

  it("revokes full refunds once and avoids a second debit for a dispute", async () => {
    const t = convexTest(schema, modules);
    const creatorId = await seedCreator(t, "test|reversals");
    await seedPurchase(t, creatorId, {
      purchaseId: "purchase-reversed",
      passCount: 5,
      amountMinor: 9900,
    });
    await t.mutation(internal.billing.handleWebhook, {
      event: checkoutEvent({
        eventId: "evt-reversed-paid",
        purchaseId: "purchase-reversed",
        paymentStatus: "paid",
      }),
    });
    await t.mutation(internal.billing.handleWebhook, {
      event: {
        eventId: "evt-dispute-created",
        eventType: "charge.dispute.created",
        objectId: "dp_reversed",
        purchaseId: "purchase-reversed",
        customerId: "cus-purchase-reversed",
      },
    });
    await t.mutation(internal.billing.handleWebhook, {
      event: {
        eventId: "evt-dispute-duplicate",
        eventType: "charge.dispute.closed",
        objectId: "dp_reversed",
        purchaseId: "purchase-reversed",
        disputeStatus: "lost",
        customerId: "cus-purchase-reversed",
      },
    });
    let state = await readPassState(t, creatorId);
    expect(state.ledger.filter((entry) => entry.kind === "dispute_debit")).toHaveLength(1);
    expect(state.account?.balance).toBe(1);

    await t.mutation(internal.billing.handleWebhook, {
      event: {
        eventId: "evt-refund-after-dispute",
        eventType: "charge.refunded",
        objectId: "ch_reversed",
        purchaseId: "purchase-reversed",
        amount: 9900,
        amountRefunded: 9900,
        customerId: "cus-purchase-reversed",
      },
    });
    await t.mutation(internal.billing.handleWebhook, {
      event: {
        eventId: "evt-refund-duplicate",
        eventType: "refund.created",
        objectId: "re_reversed",
        purchaseId: "purchase-reversed",
        amount: 9900,
        amountRefunded: 9900,
        customerId: "cus-purchase-reversed",
      },
    });
    state = await readPassState(t, creatorId);
    expect(state.ledger.filter((entry) => entry.kind === "purchase_refund_debit")).toHaveLength(0);
    expect(state.ledger.filter((entry) => entry.kind === "dispute_debit")).toHaveLength(1);
    expect(state.account?.balance).toBe(1);

    await seedPurchase(t, creatorId, {
      purchaseId: "purchase-won-then-refunded",
      passCount: 5,
      amountMinor: 9900,
    });
    await t.mutation(internal.billing.handleWebhook, {
      event: checkoutEvent({
        eventId: "evt-won-refund-paid",
        purchaseId: "purchase-won-then-refunded",
        paymentStatus: "paid",
      }),
    });
    await t.mutation(internal.billing.handleWebhook, {
      event: {
        eventId: "evt-won-refund-dispute",
        eventType: "charge.dispute.created",
        objectId: "dp_won_refund",
        purchaseId: "purchase-won-then-refunded",
        customerId: "cus-purchase-won-then-refunded",
      },
    });
    await t.mutation(internal.billing.handleWebhook, {
      event: {
        eventId: "evt-won-refund-restored",
        eventType: "charge.dispute.funds_reinstated",
        objectId: "dp_won_refund",
        purchaseId: "purchase-won-then-refunded",
        customerId: "cus-purchase-won-then-refunded",
      },
    });
    await t.mutation(internal.billing.handleWebhook, {
      event: {
        eventId: "evt-won-refund-refunded",
        eventType: "charge.refunded",
        objectId: "ch_won_refund",
        purchaseId: "purchase-won-then-refunded",
        amount: 9900,
        amountRefunded: 9900,
        customerId: "cus-purchase-won-then-refunded",
      },
    });
    state = await readPassState(t, creatorId);
    expect(
      state.ledger.filter((entry) => entry.kind === "dispute_restoration"),
    ).toHaveLength(1);
    expect(
      state.ledger.filter((entry) => entry.kind === "purchase_refund_debit"),
    ).toHaveLength(1);
  });

  it("records partial refunds as reconciliation work without guessing pass counts", async () => {
    const t = convexTest(schema, modules);
    const creatorId = await seedCreator(t, "test|partial-refund");
    await seedPurchase(t, creatorId, {
      purchaseId: "purchase-partial",
      passCount: 5,
      amountMinor: 9900,
    });
    await t.mutation(internal.billing.handleWebhook, {
      event: checkoutEvent({
        eventId: "evt-partial-paid",
        purchaseId: "purchase-partial",
        paymentStatus: "paid",
      }),
    });
    await t.mutation(internal.billing.handleWebhook, {
      event: {
        eventId: "evt-partial-refund",
        eventType: "charge.refunded",
        objectId: "ch_partial",
        purchaseId: "purchase-partial",
        amount: 9900,
        amountRefunded: 1000,
        customerId: "cus-purchase-partial",
      },
    });
    const purchase = await t.run(async (ctx) =>
      await ctx.db
        .query("purchases")
        .withIndex("by_purchaseId", (q) => q.eq("purchaseId", "purchase-partial"))
        .unique(),
    );
    expect(purchase).toMatchObject({
      state: "partially_refunded",
      refundState: "partial_reconciliation_required",
      refundedAmountMinor: 1000,
    });
    const state = await readPassState(t, creatorId);
    expect(state.ledger.filter((entry) => entry.kind === "purchase_refund_debit")).toHaveLength(0);
    expect(state.account?.balance).toBe(6);
  });

  it("creates checkout state only for the authenticated Creator", async () => {
    const t = convexTest(schema, modules);
    const ownerId = await seedCreator(t, "test|checkout-owner");
    await seedCreator(t, "test|checkout-other");
    await seedPurchase(t, ownerId, { purchaseId: "purchase-owned" });

    await expect(
      t.withIdentity(creatorIdentity("test|checkout-other")).action(
        api.billing.createCheckoutSession,
        { packId: "one_pass" },
      ),
    ).rejects.toThrow("Checkout is temporarily unavailable");
    const ownerPurchase = await t.run(async (ctx) =>
      await ctx.db
        .query("purchases")
        .withIndex("by_purchaseId", (q) => q.eq("purchaseId", "purchase-owned"))
        .unique(),
    );
    expect(ownerPurchase?.creatorId).toBe(ownerId);
  });

  it("reconciles purchases and the cached balance from append-only ledger entries", async () => {
    const t = convexTest(schema, modules);
    const creatorId = await seedCreator(t, "test|reconcile");
    await seedPurchase(t, creatorId, { purchaseId: "purchase-reconcile" });
    await t.mutation(internal.billing.handleWebhook, {
      event: checkoutEvent({
        eventId: "evt-reconcile-paid",
        purchaseId: "purchase-reconcile",
        paymentStatus: "paid",
      }),
    });
    await expect(
      t.action(internal.billing.reconcileCreator, { creatorId }),
    ).resolves.toMatchObject({
      purchaseCount: 1,
      purchaseIssues: [],
      matches: true,
    });
    const account = await t.run(async (ctx) =>
      await ctx.db
        .query("passAccounts")
        .withIndex("by_creatorId", (q) => q.eq("creatorId", creatorId))
        .unique(),
    );
    if (!account) throw new Error("Pass account was not created.");
    await t.run(async (ctx) => {
      await ctx.db.patch("passAccounts", account._id, {
        balance: account.balance + 1,
      });
    });
    await expect(
      t.action(internal.billing.reconcileCreator, { creatorId }),
    ).resolves.toMatchObject({ matches: false });
  });

  it("supports scoped, idempotent operator adjustments", async () => {
    const t = convexTest(schema, modules);
    const firstCreatorId = await seedCreator(t, "test|operator-first");
    const secondCreatorId = await seedCreator(t, "test|operator-second");
    await t.mutation(internal.billing.operatorAdjust, {
      creatorId: firstCreatorId,
      amount: 2,
      idempotencyKey: "case-123",
      note: "Support correction",
    });
    await t.mutation(internal.billing.operatorAdjust, {
      creatorId: firstCreatorId,
      amount: 2,
      idempotencyKey: "case-123",
      note: "Support correction retry",
    });
    await t.mutation(internal.billing.operatorAdjust, {
      creatorId: secondCreatorId,
      amount: 3,
      idempotencyKey: "case-123",
      note: "Separate Creator case",
    });
    const first = await readPassState(t, firstCreatorId);
    const second = await readPassState(t, secondCreatorId);
    expect(first.account?.balance).toBe(3);
    expect(second.account?.balance).toBe(4);
    expect(first.ledger.filter((entry) => entry.kind === "manual_adjustment")).toHaveLength(1);
    expect(second.ledger.filter((entry) => entry.kind === "manual_adjustment")).toHaveLength(1);
  });
});
