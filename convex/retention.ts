import { v } from "convex/values";
import {
  env,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { deleteInterviewData } from "./lib/delete_interview";
import {
  legacyRetentionPatch,
  RETENTION_POLICY_VERSION,
} from "./lib/retention";
import { buildRetentionWarningEmailRequest } from "./lib/provider_requests";
import { internalRefs } from "./internal_refs";

const MAX_RETENTION_BATCH = 50;

export const backfillDeadlines = internalMutation({
  args: { limit: v.number() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const interviews = await ctx.db
      .query("interviews")
      .withIndex("by_retentionPolicyVersion", (q) =>
        q.eq("retentionPolicyVersion", undefined),
      )
      .take(Math.min(Math.max(Math.floor(args.limit), 1), MAX_RETENTION_BATCH));
    for (const interview of interviews) {
      await ctx.db.patch(
        "interviews",
        interview._id,
        legacyRetentionPatch(interview),
      );
    }
    return interviews.length;
  },
});

const expiredCandidate = v.object({
  interviewId: v.id("interviews"),
});

export const getExpired = internalQuery({
  args: { now: v.number(), limit: v.number() },
  returns: v.array(expiredCandidate),
  handler: async (ctx, args) => {
    const interviews = await ctx.db
      .query("interviews")
      .withIndex("by_retentionPolicyVersion_and_retentionExpiresAt", (q) =>
        q
          .eq("retentionPolicyVersion", RETENTION_POLICY_VERSION)
          .lte("retentionExpiresAt", args.now),
      )
      .order("asc")
      .take(Math.min(Math.max(Math.floor(args.limit), 1), MAX_RETENTION_BATCH));
    return interviews.map((interview) => ({ interviewId: interview._id }));
  },
});

const warningCandidate = v.object({
  interviewId: v.id("interviews"),
  projectName: v.string(),
  retentionExpiresAt: v.number(),
  creatorEmail: v.string(),
  creatorName: v.string(),
  creatorLanguage: v.union(v.literal("en"), v.literal("de")),
});

export const getWarnings = internalQuery({
  args: { now: v.number(), limit: v.number() },
  returns: v.array(warningCandidate),
  handler: async (ctx, args) => {
    const interviews = await ctx.db
      .query("interviews")
      .withIndex(
        "by_retentionWarningAttemptedAt_and_retentionWarningAt",
        (q) =>
          q
            .eq("retentionWarningAttemptedAt", undefined)
            .lte("retentionWarningAt", args.now),
      )
      .order("asc")
      .take(Math.min(Math.max(Math.floor(args.limit), 1), MAX_RETENTION_BATCH));
    const candidates = [];
    for (const interview of interviews) {
      if (
        interview.retentionPolicyVersion !== RETENTION_POLICY_VERSION ||
        interview.retentionExpiresAt === undefined ||
        interview.retentionExpiresAt <= args.now
      ) {
        continue;
      }
      const creator = await ctx.db.get("creatorProfiles", interview.creatorId);
      if (!creator) continue;
      candidates.push({
        interviewId: interview._id,
        projectName: interview.projectName,
        retentionExpiresAt: interview.retentionExpiresAt,
        creatorEmail: creator.email,
        creatorName: creator.displayName,
        creatorLanguage: creator.language ?? creator.emailLanguage ?? "en",
      });
    }
    return candidates;
  },
});

export const recordWarningAttempt = internalMutation({
  args: {
    interviewId: v.id("interviews"),
    retentionExpiresAt: v.number(),
    attemptedAt: v.number(),
    delivered: v.boolean(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const interview = await ctx.db.get("interviews", args.interviewId);
    if (
      !interview ||
      interview.retentionExpiresAt !== args.retentionExpiresAt
    ) {
      return false;
    }
    await ctx.db.patch("interviews", interview._id, {
      retentionWarningAttemptedAt: args.attemptedAt,
      ...(args.delivered
        ? { retentionWarningSentAt: args.attemptedAt }
        : {}),
    });
    return true;
  },
});

export const deleteExpired = internalMutation({
  args: { interviewId: v.id("interviews"), now: v.number() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const interview = await ctx.db.get("interviews", args.interviewId);
    if (
      !interview?.retentionExpiresAt ||
      interview.retentionPolicyVersion !== RETENTION_POLICY_VERSION ||
      interview.retentionExpiresAt > args.now
    ) {
      return false;
    }
    await deleteInterviewData(ctx, interview);
    return true;
  },
});

export const runSweep = internalAction({
  args: {},
  returns: v.object({
    backfilled: v.number(),
    deleted: v.number(),
    warningsSent: v.number(),
  }),
  handler: async (ctx) => {
    const backfilled = await ctx.runMutation(
      internalRefs.retention.backfillDeadlines,
      { limit: MAX_RETENTION_BATCH },
    );
    const now = Date.now();
    const expired = await ctx.runQuery(internalRefs.retention.getExpired, {
      now,
      limit: MAX_RETENTION_BATCH,
    });
    let deleted = 0;
    for (const item of expired) {
      if (
        await ctx.runMutation(internalRefs.retention.deleteExpired, {
          interviewId: item.interviewId,
          now,
        })
      ) {
        deleted += 1;
      }
    }
    const warnings = await ctx.runQuery(
      internalRefs.retention.getWarnings,
      { now, limit: MAX_RETENTION_BATCH },
    );
    let warningsSent = 0;
    for (const item of warnings) {
      try {
        const dashboardUrl = `${env.SITE_URL}/interviews/${item.interviewId}`;
        const request = buildRetentionWarningEmailRequest({
          apiUrl: env.CLOUDFLARE_EMAIL_API_URL,
          apiToken: env.CLOUDFLARE_EMAIL_API_TOKEN,
          from: env.EMAIL_FROM,
          fromName: env.EMAIL_FROM_NAME,
          to: item.creatorEmail,
          creatorName: item.creatorName,
          language: item.creatorLanguage,
          projectName: item.projectName,
          dashboardUrl,
          interviewId: item.interviewId,
          retentionExpiresAt: item.retentionExpiresAt,
        });
        const response = await fetch(request.url, request.init);
        if (await ctx.runMutation(internalRefs.retention.recordWarningAttempt, {
          interviewId: item.interviewId,
          retentionExpiresAt: item.retentionExpiresAt,
          attemptedAt: now,
          delivered: response.ok,
        })) {
          if (!response.ok) continue;
          warningsSent += 1;
        }
      } catch {
        // Warning delivery is best effort and must never postpone deletion.
        await ctx.runMutation(internalRefs.retention.recordWarningAttempt, {
          interviewId: item.interviewId,
          retentionExpiresAt: item.retentionExpiresAt,
          attemptedAt: now,
          delivered: false,
        });
      }
    }
    if (
      backfilled === MAX_RETENTION_BATCH ||
      expired.length === MAX_RETENTION_BATCH ||
      warnings.length === MAX_RETENTION_BATCH
    ) {
      await ctx.scheduler.runAfter(
        60_000,
        internalRefs.retention.runSweep,
        {},
      );
    }
    return { backfilled, deleted, warningsSent };
  },
});
