import { listMessages, saveMessage } from "@convex-dev/agent";
import { RateLimiter, MINUTE } from "@convex-dev/rate-limiter";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { agentComponent, rateLimiterComponent } from "./lib/components";
import { hashCapability } from "./lib/capability_crypto";
import {
  assertHttpUrls,
  assertLength,
  interviewDto,
  MAX_CLIENT_MESSAGE_LENGTH,
  MAX_CLIENT_MESSAGES,
  MAX_DOCUMENT_REVISIONS,
  MAX_VISUAL_NOTE_LENGTH,
} from "./lib/domain";
import { visualDirection } from "./schema";
import { internalRefs } from "./internal_refs";

const rateLimiter = new RateLimiter(rateLimiterComponent, {
  billableAi: {
    kind: "token bucket",
    rate: 20,
    period: MINUTE,
    capacity: 5,
  },
});

const findByToken = async (
  ctx: QueryCtx | MutationCtx,
  token: string,
) => {
  const linkHash = await hashCapability(token);
  const interview = await ctx.db
    .query("interviews")
    .withIndex("by_linkHash", (q) => q.eq("linkHash", linkHash))
    .unique();
  return interview ? { interview, linkHash } : null;
};

const byToken = async (ctx: QueryCtx | MutationCtx, token: string) => {
  const result = await findByToken(ctx, token);
  if (!result) throw new Error("Interview Link is invalid.");
  return result;
};

const directionValue = (
  direction: typeof visualDirection.type,
  concepts: ReadonlyArray<{ id: string; status: string }>,
) => {
  const note = direction.note
    ? assertLength(
        "Visual Direction note",
        direction.note,
        MAX_VISUAL_NOTE_LENGTH,
      )
    : undefined;
  if (direction.kind === "concept") {
    if (
      !concepts.some(
        (concept) =>
          concept.id === direction.conceptId && concept.status === "ready",
      )
    ) {
      throw new Error("Selected Visual Concept is not available.");
    }
    return {
      kind: "concept" as const,
      conceptId: direction.conceptId,
      ...(note ? { note } : {}),
    };
  }
  return {
    kind: "inspiration_links" as const,
    inspirationLinks: assertHttpUrls(direction.inspirationLinks),
    ...(note ? { note } : {}),
  };
};

export const getByLink = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const access = await findByToken(ctx, args.token);
    if (!access) return null;
    const { interview } = access;
    const creator = await ctx.db.get("creatorProfiles", interview.creatorId);
    if (!creator) throw new Error("Interview creator not found.");
    return {
      ...(await interviewDto(interview, (id) => ctx.storage.getUrl(id))),
      interviewId: interview._id,
      started: Boolean(interview.startedAt ?? interview.frozenAt),
      modelFamily:
        interview.model === "gpt-5.6-terra" ? "GPT-5.6" : "DeepSeek V4",
      creator: {
        displayName: creator.displayName,
        email: creator.email,
      },
      disclosure: {
        approximateMinutes: 10,
        modelFamily:
          interview.model === "gpt-5.6-terra" ? "GPT-5.6" : "DeepSeek V4",
        privacyUrl: "https://openrouter.ai/privacy",
      },
    };
  },
});

export const start = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const { interview, linkHash } = await byToken(ctx, args.token);
    if (interview.submission) throw new Error("The Interview is read-only.");
    if (interview.operation || interview.startedAt) return null;
    await rateLimiter.limit(ctx, "billableAi", {
      key: linkHash,
      throws: true,
    });
    await ctx.db.patch("interviews", interview._id, {
      startedAt: Date.now(),
      operation: {
        kind: "interview_response",
        status: "pending",
        attempt: 0,
      },
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internalRefs.jobs.runPending, {
      interviewId: interview._id,
    });
    return null;
  },
});

export const sendMessage = mutation({
  args: { token: v.string(), content: v.string() },
  handler: async (ctx, args) => {
    const { interview, linkHash } = await byToken(ctx, args.token);
    if (interview.submission || interview.step !== "interview") {
      throw new Error("The Interview is read-only.");
    }
    if (interview.operation) {
      throw new Error("An Interview operation is already in progress.");
    }
    if (interview.clientMessageCount >= MAX_CLIENT_MESSAGES) {
      throw new Error("The Interview message limit has been reached.");
    }
    await rateLimiter.limit(ctx, "billableAi", {
      key: linkHash,
      throws: true,
    });
    const message = assertLength(
      "Client message",
      args.content,
      MAX_CLIENT_MESSAGE_LENGTH,
    );
    const saved = await saveMessage(ctx, agentComponent, {
      threadId: interview.agentThreadId,
      prompt: message,
    });
    const now = Date.now();
    await ctx.db.patch("interviews", interview._id, {
      startedAt: interview.startedAt ?? now,
      frozenAt: interview.frozenAt ?? now,
      clientMessageCount: interview.clientMessageCount + 1,
      suggestedReplies: [],
      operation: {
        kind: "interview_response",
        status: "pending",
        attempt: 0,
        input: saved.messageId,
      },
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, internalRefs.jobs.runPending, {
      interviewId: interview._id,
    });
    return { accepted: true, messageId: saved.messageId };
  },
});

export const requestDocumentChanges = mutation({
  args: { token: v.string(), changes: v.string() },
  handler: async (ctx, args) => {
    const { interview, linkHash } = await byToken(ctx, args.token);
    if (
      interview.submission ||
      interview.step !== "review" ||
      !interview.projectDocument
    ) {
      throw new Error("Project Document changes are not available.");
    }
    if (interview.operation) {
      throw new Error("An Interview operation is already in progress.");
    }
    if (interview.documentRevisionCount >= MAX_DOCUMENT_REVISIONS) {
      throw new Error("The Project Document revision limit has been reached.");
    }
    await rateLimiter.limit(ctx, "billableAi", {
      key: linkHash,
      throws: true,
    });
    const changes = assertLength(
      "Document change request",
      args.changes,
      MAX_CLIENT_MESSAGE_LENGTH,
    );
    await ctx.db.patch("interviews", interview._id, {
      documentRevisionCount: interview.documentRevisionCount + 1,
      operation: {
        kind: "document_revision",
        status: "pending",
        attempt: 0,
        input: changes,
      },
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internalRefs.jobs.runPending, {
      interviewId: interview._id,
    });
    return null;
  },
});

export const continueToConcepts = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const { interview, linkHash } = await byToken(ctx, args.token);
    if (
      interview.submission ||
      interview.step !== "review" ||
      !interview.projectDocument
    ) {
      throw new Error("The Interview is not ready for Visual Concepts.");
    }
    if (interview.operation) {
      throw new Error("An Interview operation is already in progress.");
    }
    await rateLimiter.limit(ctx, "billableAi", {
      key: linkHash,
      throws: true,
    });
    await ctx.db.patch("interviews", interview._id, {
      step: "concepts",
      operation: {
        kind: "concept_generation",
        status: "pending",
        attempt: 0,
      },
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internalRefs.jobs.runPending, {
      interviewId: interview._id,
    });
    return null;
  },
});

export const retry = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const { interview, linkHash } = await byToken(ctx, args.token);
    if (
      interview.submission ||
      !interview.operation ||
      interview.operation.status !== "failed"
    ) {
      throw new Error("Interview has no failed operation to retry.");
    }
    await rateLimiter.limit(ctx, "billableAi", {
      key: linkHash,
      throws: true,
    });
    const operation = {
      kind: interview.operation.kind,
      attempt: 0,
      ...(interview.operation.input ? { input: interview.operation.input } : {}),
      ...(interview.operation.startedAt
        ? { startedAt: interview.operation.startedAt }
        : {}),
    };
    await ctx.db.patch("interviews", interview._id, {
      operation: { ...operation, status: "pending" },
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internalRefs.jobs.runPending, {
      interviewId: interview._id,
    });
    return null;
  },
});

export const setVisualDirection = mutation({
  args: { token: v.string(), direction: visualDirection },
  handler: async (ctx, args) => {
    const { interview } = await byToken(ctx, args.token);
    if (interview.submission || interview.step !== "concepts") {
      throw new Error("Visual Direction is read-only.");
    }
    const direction = directionValue(args.direction, interview.concepts);
    await ctx.db.patch("interviews", interview._id, {
      visualDirection: direction,
      updatedAt: Date.now(),
    });
    return direction;
  },
});

export const submit = mutation({
  args: {
    token: v.string(),
    direction: v.optional(visualDirection),
  },
  handler: async (ctx, args) => {
    const { interview } = await byToken(ctx, args.token);
    if (interview.submission) {
      return { created: false, submission: interview.submission };
    }
    if (
      interview.step !== "concepts" ||
      !interview.projectDocument ||
      interview.concepts.length !== 3 ||
      interview.concepts.some((concept) => concept.status !== "ready")
    ) {
      throw new Error("The Interview is not ready to submit.");
    }
    const direction = args.direction
      ? directionValue(args.direction, interview.concepts)
      : interview.visualDirection;
    if (!direction) throw new Error("Choose a Visual Direction before submitting.");
    const now = Date.now();
    const submission = {
      id: `submission_${crypto.randomUUID()}`,
      submittedAt: now,
      projectDocument: interview.projectDocument,
      visualDirection: direction,
      emailDelivery: "pending" as const,
      emailAttempts: 0,
    };
    await ctx.db.patch("interviews", interview._id, {
      step: "submitted",
      visualDirection: direction,
      submission,
      operation: {
        kind: "email_notification",
        status: "pending",
        attempt: 0,
      },
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, internalRefs.jobs.runPending, {
      interviewId: interview._id,
    });
    return { created: true, submission };
  },
});

export const listTranscript = query({
  args: {
    token: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { interview } = await byToken(ctx, args.token);
    return await listMessages(ctx, agentComponent, {
      threadId: interview.agentThreadId,
      paginationOpts: args.paginationOpts,
      excludeToolMessages: true,
    });
  },
});
