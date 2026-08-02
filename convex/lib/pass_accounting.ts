import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

type PassAccount = Doc<"passAccounts">;
type LedgerKind = Doc<"passLedger">["kind"];

export const interviewPassState = (interview: Doc<"interviews">) => {
  return interview.passState;
};

export const isInterviewPassBacked = (interview: Doc<"interviews">) =>
  interviewPassState(interview) !== "unreserved";

export const reservationKeyFor = (interview: Doc<"interviews">) => {
  if (!interview.passReservationKey) {
    throw new Error("Interview pass reservation key is missing.");
  }
  return interview.passReservationKey;
};

const reservedBalanceOf = (account: PassAccount) => account.reservedBalance;
const reservedIntroductoryBalanceOf = (account: PassAccount) =>
  account.reservedIntroductoryBalance;
const reservedPurchasedBalanceOf = (account: PassAccount) =>
  account.reservedPurchasedBalance;
const consumedBalanceOf = (account: PassAccount) => account.consumedBalance;

const accountFor = async (
  ctx: MutationCtx,
  creatorId: Id<"creatorProfiles">,
): Promise<PassAccount | null> =>
  await ctx.db
    .query("passAccounts")
    .withIndex("by_creatorId", (q) => q.eq("creatorId", creatorId))
    .unique();

const ledgerForKey = async (ctx: MutationCtx, idempotencyKey: string) =>
  await ctx.db
    .query("passLedger")
    .withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", idempotencyKey))
    .unique();

export const hasLedgerEntry = async (
  ctx: MutationCtx,
  idempotencyKey: string,
) => Boolean(await ledgerForKey(ctx, idempotencyKey));

const appendLedger = async (
  ctx: MutationCtx,
  input: {
    creatorId: Id<"creatorProfiles">;
    kind: LedgerKind;
    amount: number;
    introductoryDelta: number;
    purchasedDelta: number;
    reservedDelta?: number;
    reservedIntroductoryDelta?: number;
    reservedPurchasedDelta?: number;
    consumedDelta?: number;
    idempotencyKey: string;
    purchaseId?: Id<"purchases">;
    interviewId?: Id<"interviews">;
    stripeEventId?: string;
    note?: string;
  },
) => {
  const existing = await ledgerForKey(ctx, input.idempotencyKey);
  if (existing) return existing;

  let account = await accountFor(ctx, input.creatorId);
  if (!account) {
    const now = Date.now();
    const accountId = await ctx.db.insert("passAccounts", {
      creatorId: input.creatorId,
      balance: 0,
      introductoryBalance: 0,
      purchasedBalance: 0,
      reservedBalance: 0,
      reservedIntroductoryBalance: 0,
      reservedPurchasedBalance: 0,
      consumedBalance: 0,
      introductoryGranted: false,
      createdAt: now,
      updatedAt: now,
    });
    account = await ctx.db.get("passAccounts", accountId);
    if (!account) throw new Error("Pass Balance could not be initialized.");
  }

  const next = {
    balance: account.balance + input.amount,
    introductoryBalance:
      account.introductoryBalance + input.introductoryDelta,
    purchasedBalance: account.purchasedBalance + input.purchasedDelta,
    reservedBalance:
      reservedBalanceOf(account) + (input.reservedDelta ?? 0),
    reservedIntroductoryBalance:
      reservedIntroductoryBalanceOf(account) +
      (input.reservedIntroductoryDelta ?? 0),
    reservedPurchasedBalance:
      reservedPurchasedBalanceOf(account) +
      (input.reservedPurchasedDelta ?? 0),
    consumedBalance: consumedBalanceOf(account) + (input.consumedDelta ?? 0),
    updatedAt: Date.now(),
  };
  await ctx.db.patch("passAccounts", account._id, next);
  const ledgerId = await ctx.db.insert("passLedger", {
    creatorId: input.creatorId,
    kind: input.kind,
    amount: input.amount,
    introductoryDelta: input.introductoryDelta,
    purchasedDelta: input.purchasedDelta,
    reservedDelta: input.reservedDelta ?? 0,
    reservedIntroductoryDelta: input.reservedIntroductoryDelta ?? 0,
    reservedPurchasedDelta: input.reservedPurchasedDelta ?? 0,
    consumedDelta: input.consumedDelta ?? 0,
    balanceAfter: next.balance,
    introductoryBalanceAfter: next.introductoryBalance,
    purchasedBalanceAfter: next.purchasedBalance,
    reservedAfter: next.reservedBalance,
    reservedIntroductoryBalanceAfter: next.reservedIntroductoryBalance,
    reservedPurchasedBalanceAfter: next.reservedPurchasedBalance,
    consumedAfter: next.consumedBalance,
    idempotencyKey: input.idempotencyKey,
    ...(input.purchaseId ? { purchaseId: input.purchaseId } : {}),
    ...(input.interviewId ? { interviewId: input.interviewId } : {}),
    ...(input.stripeEventId ? { stripeEventId: input.stripeEventId } : {}),
    ...(input.note ? { note: input.note } : {}),
    createdAt: Date.now(),
  });
  const ledger = await ctx.db.get("passLedger", ledgerId);
  if (!ledger) throw new Error("Pass Ledger entry could not be recorded.");
  return ledger;
};

export const ensureIntroductoryPass = async (
  ctx: MutationCtx,
  creatorId: Id<"creatorProfiles">,
) => {
  const key = `introductory:${creatorId}`;
  const existing = await ledgerForKey(ctx, key);
  if (existing) return existing;
  const ledger = await appendLedger(ctx, {
    creatorId,
    kind: "introductory_grant",
    amount: 1,
    introductoryDelta: 1,
    purchasedDelta: 0,
    idempotencyKey: key,
    note: "One non-expiring Introductory Pass.",
  });
  const account = await accountFor(ctx, creatorId);
  if (!account) throw new Error("Pass Balance could not be initialized.");
  if (!account.introductoryGranted) {
    await ctx.db.patch("passAccounts", account._id, {
      introductoryGranted: true,
      updatedAt: Date.now(),
    });
  }
  return ledger;
};

export const getPassAccount = async (
  ctx: MutationCtx,
  creatorId: Id<"creatorProfiles">,
) => {
  await ensureIntroductoryPass(ctx, creatorId);
  const account = await accountFor(ctx, creatorId);
  if (!account) throw new Error("Pass Balance could not be loaded.");
  return account;
};

/** Hold one available pass when the Creator first shares an Interview Link. */
export const reserveInterviewPass = async (
  ctx: MutationCtx,
  input: {
    creatorId: Id<"creatorProfiles">;
    interviewId: Id<"interviews">;
    reservationKey: string;
  },
) => {
  await ensureIntroductoryPass(ctx, input.creatorId);
  const key = input.reservationKey;
  const existing = await ledgerForKey(ctx, key);
  if (existing) return existing;
  const account = await accountFor(ctx, input.creatorId);
  if (!account || account.balance < 1) {
    throw new Error("At least one Interview Pass is required to share the link.");
  }
  const usesIntroductory = account.introductoryBalance > 0;
  return await appendLedger(ctx, {
    creatorId: input.creatorId,
    kind: "reservation_hold",
    amount: -1,
    introductoryDelta: usesIntroductory ? -1 : 0,
    purchasedDelta: usesIntroductory ? 0 : -1,
    reservedDelta: 1,
    reservedIntroductoryDelta: usesIntroductory ? 1 : 0,
    reservedPurchasedDelta: usesIntroductory ? 0 : 1,
    idempotencyKey: key,
    interviewId: input.interviewId,
    note: "Interview Link pass reservation.",
  });
};

/** Convert a held pass into a consumed pass immediately before AI work. */
export const consumeReservedInterviewPass = async (
  ctx: MutationCtx,
  input: {
    creatorId: Id<"creatorProfiles">;
    interviewId: Id<"interviews">;
    reservationKey: string;
  },
) => {
  await ensureIntroductoryPass(ctx, input.creatorId);
  const key = `reservation-consumption:${input.interviewId}`;
  const existing = await ledgerForKey(ctx, key);
  if (existing) return existing;
  const reservation = await ledgerForKey(ctx, input.reservationKey);
  if (!reservation) {
    throw new Error("This Interview Link does not have a valid pass reservation.");
  }
  const heldIntroductory = (reservation.reservedIntroductoryDelta ?? 0) > 0;
  const heldPurchased = (reservation.reservedPurchasedDelta ?? 0) > 0;
  return await appendLedger(ctx, {
    creatorId: input.creatorId,
    kind: "reservation_consumption",
    amount: 0,
    introductoryDelta: 0,
    purchasedDelta: 0,
    reservedDelta: -1,
    reservedIntroductoryDelta: heldIntroductory ? -1 : 0,
    reservedPurchasedDelta: heldPurchased ? -1 : 0,
    consumedDelta: 1,
    idempotencyKey: key,
    interviewId: input.interviewId,
    note: "Client deliberately started the Interview.",
  });
};

/** Release a pre-start reservation exactly once. */
export const releaseInterviewReservation = async (
  ctx: MutationCtx,
  input: {
    creatorId: Id<"creatorProfiles">;
    interviewId: Id<"interviews">;
    reservationKey: string;
  },
) => {
  const reservation = await ledgerForKey(ctx, input.reservationKey);
  if (!reservation) {
    throw new Error("Interview pass reservation could not be found.");
  }
  const key = `reservation-release:${input.reservationKey}`;
  const existing = await ledgerForKey(ctx, key);
  if (existing) return existing;
  const restoresIntroductory = reservation.introductoryDelta < 0;
  return await appendLedger(ctx, {
    creatorId: input.creatorId,
    kind: "reservation_release",
    amount: 1,
    introductoryDelta: restoresIntroductory ? 1 : 0,
    purchasedDelta: restoresIntroductory ? 0 : 1,
    reservedDelta: -1,
    reservedIntroductoryDelta: restoresIntroductory ? -1 : 0,
    reservedPurchasedDelta: restoresIntroductory ? 0 : -1,
    idempotencyKey: key,
    interviewId: input.interviewId,
    note: "Interview deactivated or deleted before Client start.",
  });
};

export const grantPurchasePasses = async (
  ctx: MutationCtx,
  input: {
    creatorId: Id<"creatorProfiles">;
    purchaseId: Id<"purchases">;
    passCount: number;
    stripeEventId?: string;
  },
) => {
  await ensureIntroductoryPass(ctx, input.creatorId);
  return await appendLedger(ctx, {
    creatorId: input.creatorId,
    kind: "purchase_grant",
    amount: input.passCount,
    introductoryDelta: 0,
    purchasedDelta: input.passCount,
    idempotencyKey: `purchase-grant:${input.purchaseId}`,
    purchaseId: input.purchaseId,
    ...(input.stripeEventId ? { stripeEventId: input.stripeEventId } : {}),
    note: "Confirmed Stripe Managed Payments purchase.",
  });
};

export const revokePurchasePasses = async (
  ctx: MutationCtx,
  input: {
    creatorId: Id<"creatorProfiles">;
    purchaseId: Id<"purchases">;
    passCount: number;
    kind: "purchase_refund_debit" | "dispute_debit";
    idempotencyKey: string;
    stripeEventId?: string;
  },
) => {
  const grant = await ledgerForKey(ctx, `purchase-grant:${input.purchaseId}`);
  if (!grant) return null;
  const existing = await ledgerForKey(ctx, input.idempotencyKey);
  if (existing) return existing;
  return await appendLedger(ctx, {
    creatorId: input.creatorId,
    kind: input.kind,
    amount: -input.passCount,
    introductoryDelta: 0,
    purchasedDelta: -input.passCount,
    idempotencyKey: input.idempotencyKey,
    purchaseId: input.purchaseId,
    ...(input.stripeEventId ? { stripeEventId: input.stripeEventId } : {}),
    note:
      input.kind === "purchase_refund_debit"
        ? "Full refund of a confirmed purchase."
        : "Dispute loss for a confirmed purchase.",
  });
};

export const restoreDisputedPurchasePasses = async (
  ctx: MutationCtx,
  input: {
    creatorId: Id<"creatorProfiles">;
    purchaseId: Id<"purchases">;
    passCount: number;
    stripeEventId?: string;
  },
) => {
  const debit = await ledgerForKey(ctx, `dispute-debit:${input.purchaseId}`);
  if (!debit) return null;
  const refund = await ledgerForKey(
    ctx,
    `purchase-refund:${input.purchaseId}`,
  );
  if (refund) return null;
  return await appendLedger(ctx, {
    creatorId: input.creatorId,
    kind: "dispute_restoration",
    amount: input.passCount,
    introductoryDelta: 0,
    purchasedDelta: input.passCount,
    idempotencyKey: `dispute-restoration:${input.purchaseId}`,
    purchaseId: input.purchaseId,
    ...(input.stripeEventId ? { stripeEventId: input.stripeEventId } : {}),
    note: "Dispute resolved in the Creator's favor.",
  });
};

export const adjustPassBalance = async (
  ctx: MutationCtx,
  input: {
    creatorId: Id<"creatorProfiles">;
    amount: number;
    idempotencyKey: string;
    note: string;
  },
) => {
  await ensureIntroductoryPass(ctx, input.creatorId);
  const idempotencyKey = `manual:${input.creatorId}:${input.idempotencyKey}`;
  return await appendLedger(ctx, {
    creatorId: input.creatorId,
    kind: "manual_adjustment",
    amount: input.amount,
    introductoryDelta: 0,
    purchasedDelta: input.amount,
    idempotencyKey,
    note: input.note,
  });
};
