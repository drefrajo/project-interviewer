import { listMessages, saveMessage } from "@convex-dev/agent";
import { RateLimiter, MINUTE } from "@convex-dev/rate-limiter";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { agentComponent, rateLimiterComponent } from "./lib/components";
import { hashCapability } from "./lib/capability_crypto";
import { agentMessageContentText } from "./lib/agent_message";
import {
  assertHttpUrls,
  assertLength,
  interviewDto,
  MAX_CLIENT_MESSAGE_LENGTH,
  MAX_CLIENT_MESSAGES,
  MAX_DOCUMENT_REVISIONS,
  MAX_VISUAL_NOTE_LENGTH,
} from "./lib/domain";
import { isMalformedStructuredInterviewOutput } from "./lib/interview_output";
import {
  consumeReservedInterviewPass,
  interviewPassState,
  isInterviewPassBacked,
  reservationKeyFor,
} from "./lib/pass_accounting";
import { visualDirection } from "./schema";
import { internalRefs } from "./internal_refs";
import {
  publicCreatorIdentity,
  requirePublicCreatorIdentity,
} from "./lib/creator_identity";
import {
  activityRetentionPatch,
  completedRetentionPatch,
} from "./lib/retention";

const rateLimiter = new RateLimiter(rateLimiterComponent, {
  billableAi: {
    kind: "token bucket",
    rate: 20,
    period: MINUTE,
    capacity: 5,
  },
});

// Development-only controls. Flip this single flag to re-enable the temporary
// retry mutations and expose their UI to a Client.
const TEMPORARY_CONCEPT_BATCH_RETRIES_ENABLED = false;
const DEFAULT_CONCEPT_IMAGE_MODEL = "gpt-image-2" as const;

const activityUpdatePatch = () => {
  const now = Date.now();
  return { updatedAt: now, ...activityRetentionPatch(now) };
};

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
  if (direction.kind === "concept") {
    const note = direction.note
      ? assertLength(
          "Visual Direction note",
          direction.note,
          MAX_VISUAL_NOTE_LENGTH,
        )
      : undefined;
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
  const note = assertLength(
    "Visual Direction note",
    direction.note ?? "",
    MAX_VISUAL_NOTE_LENGTH,
  );
  return {
    kind: "inspiration_links" as const,
    inspirationLinks: assertHttpUrls(direction.inspirationLinks),
    note,
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
    const publicCreator = publicCreatorIdentity(creator);
    const reservationRequired = !isInterviewPassBacked(interview);
    if (reservationRequired) {
      return {
        interviewId: interview._id,
        projectName: interview.projectName,
        creator: publicCreator,
        creatorIdentityReady: publicCreator !== null,
        clientLanguage: interview.clientLanguage,
        modelFamily: "GPT-5.6 Terra",
        temporaryConceptBatchRetriesEnabled:
          TEMPORARY_CONCEPT_BATCH_RETRIES_ENABLED,
        step: "interview" as const,
        started: false,
        reservationRequired: true,
        passState: "unreserved" as const,
      };
    }
    return {
      ...(await interviewDto(interview, (id) => ctx.storage.getUrl(id))),
      interviewId: interview._id,
      started: Boolean(interview.startedAt ?? interview.frozenAt),
      reservationRequired: false,
      passState: interviewPassState(interview),
      modelFamily: "GPT-5.6 Terra",
      creator: publicCreator,
      creatorIdentityReady: publicCreator !== null,
      disclosure: {
        approximateMinutes: 10,
        modelFamily: "GPT-5.6 Terra",
      },
      temporaryConceptBatchRetriesEnabled:
        TEMPORARY_CONCEPT_BATCH_RETRIES_ENABLED,
    };
  },
});

export const start = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const { interview, linkHash } = await byToken(ctx, args.token);
    const creator = await ctx.db.get("creatorProfiles", interview.creatorId);
    if (!creator) throw new Error("Interview creator not found.");
    requirePublicCreatorIdentity(creator);
    if (!isInterviewPassBacked(interview)) {
      throw new Error("This Interview Link is waiting for the Creator to reserve a pass.");
    }
    if (interview.submission) throw new Error("The Interview is read-only.");
    if (interview.operation || interview.startedAt) return null;
    await rateLimiter.limit(ctx, "billableAi", {
      key: linkHash,
      throws: true,
    });
    await consumeReservedInterviewPass(ctx, {
      creatorId: interview.creatorId,
      interviewId: interview._id,
      reservationKey: reservationKeyFor(interview),
    });
    const now = Date.now();
    await ctx.db.patch("interviews", interview._id, {
      startedAt: now,
      passState: "consumed",
      passConsumedAt: now,
      operation: {
        kind: "interview_response",
        status: "pending",
        attempt: 0,
      },
      updatedAt: now,
      ...activityRetentionPatch(now),
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
    if (interviewPassState(interview) !== "consumed") {
      throw new Error("Start the Interview before sending a Client message.");
    }
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
      passState: "consumed",
      passConsumedAt: interview.passConsumedAt ?? now,
      clientMessageCount: interview.clientMessageCount + 1,
      suggestedReplies: [],
      operation: {
        kind: "interview_response",
        status: "pending",
        attempt: 0,
        input: saved.messageId,
      },
      updatedAt: now,
      ...activityRetentionPatch(now),
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
      ...activityUpdatePatch(),
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
      ...activityUpdatePatch(),
    });
    await ctx.scheduler.runAfter(0, internalRefs.jobs.runPending, {
      interviewId: interview._id,
    });
    return null;
  },
});

export const requestMoreConcepts = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const { interview, linkHash } = await byToken(ctx, args.token);
    if (
      interview.submission ||
      interview.step !== "concepts" ||
      !interview.projectDocument
    ) {
      throw new Error("The Interview is not ready for more Visual Concepts.");
    }
    if (
      interview.operation?.status === "pending" ||
      interview.operation?.status === "running"
    ) {
      throw new Error("Visual Concept generation is already in progress.");
    }
    if (
      interview.concepts.length !== 3 ||
      interview.concepts.some((concept) => concept.status !== "ready")
    ) {
      throw new Error(
        "A second Visual Concept batch can be requested only while one ready batch exists.",
      );
    }
    await rateLimiter.limit(ctx, "billableAi", {
      key: linkHash,
      throws: true,
    });
    await ctx.db.patch("interviews", interview._id, {
      visualDirection: undefined,
      operation: {
        kind: "concept_generation",
        status: "pending",
        attempt: 0,
        imageModel: DEFAULT_CONCEPT_IMAGE_MODEL,
        additionalConcepts: true,
      },
      ...activityUpdatePatch(),
    });
    await ctx.scheduler.runAfter(0, internalRefs.jobs.runPending, {
      interviewId: interview._id,
    });
    return null;
  },
});

export const retryAdditionalConcepts = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    if (!TEMPORARY_CONCEPT_BATCH_RETRIES_ENABLED) {
      throw new Error("Temporary Visual Concept batch retries are disabled.");
    }
    const { interview, linkHash } = await byToken(ctx, args.token);
    if (
      interview.submission ||
      interview.step !== "concepts" ||
      !interview.projectDocument
    ) {
      throw new Error("The Interview is not ready to retry Visual Concepts.");
    }
    if (interview.concepts.length !== 6) {
      throw new Error("The second Visual Concept batch is not available.");
    }
    if (
      interview.operation?.status === "pending" ||
      interview.operation?.status === "running"
    ) {
      throw new Error("Visual Concept generation is already in progress.");
    }
    await rateLimiter.limit(ctx, "billableAi", {
      key: linkHash,
      throws: true,
    });
    await Promise.all(
      interview.concepts.flatMap((concept) =>
        Number.parseInt(concept.id.replace("concept_", ""), 10) > 3 &&
        concept.imageId
          ? [ctx.storage.delete(concept.imageId)]
          : [],
      ),
    );
    const concepts = interview.concepts.map((concept) => {
      if (Number.parseInt(concept.id.replace("concept_", ""), 10) <= 3) {
        return concept;
      }
      return {
        id: concept.id,
        name: concept.name,
        rationale: concept.rationale,
        prompt: concept.prompt,
        status: "pending" as const,
      };
    });
    await ctx.db.patch("interviews", interview._id, {
      concepts,
      visualDirection: undefined,
      operation: {
        kind: "concept_generation",
        status: "pending",
        attempt: 0,
        imageModel: DEFAULT_CONCEPT_IMAGE_MODEL,
        additionalConcepts: true,
        regeneratePrompts: true,
      },
      ...activityUpdatePatch(),
    });
    await ctx.scheduler.runAfter(0, internalRefs.jobs.runPending, {
      interviewId: interview._id,
    });
    return null;
  },
});

export const retryFirstConcepts = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    if (!TEMPORARY_CONCEPT_BATCH_RETRIES_ENABLED) {
      throw new Error("Temporary Visual Concept batch retries are disabled.");
    }
    const { interview, linkHash } = await byToken(ctx, args.token);
    if (
      interview.submission ||
      interview.step !== "concepts" ||
      !interview.projectDocument
    ) {
      throw new Error("The Interview is not ready to retry Visual Concepts.");
    }
    if (interview.concepts.length !== 6) {
      throw new Error("The second Visual Concept batch is not available.");
    }
    if (
      interview.operation?.status === "pending" ||
      interview.operation?.status === "running"
    ) {
      throw new Error("Visual Concept generation is already in progress.");
    }
    await rateLimiter.limit(ctx, "billableAi", {
      key: linkHash,
      throws: true,
    });
    await Promise.all(
      interview.concepts.flatMap((concept) =>
        concept.imageId ? [ctx.storage.delete(concept.imageId)] : [],
      ),
    );
    await ctx.db.patch("interviews", interview._id, {
      concepts: [],
      visualDirection: undefined,
      operation: {
        kind: "concept_generation",
        status: "pending",
        attempt: 0,
        imageModel: DEFAULT_CONCEPT_IMAGE_MODEL,
        regeneratePrompts: true,
      },
      ...activityUpdatePatch(),
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
      ...(interview.operation.regeneratePrompts !== undefined
        ? { regeneratePrompts: interview.operation.regeneratePrompts }
        : {}),
      ...(interview.operation.additionalConcepts !== undefined
        ? { additionalConcepts: interview.operation.additionalConcepts }
        : {}),
      ...(interview.operation.input ? { input: interview.operation.input } : {}),
      ...(interview.operation.startedAt
        ? { startedAt: interview.operation.startedAt }
        : {}),
    };
    await ctx.db.patch("interviews", interview._id, {
      operation: { ...operation, status: "pending" },
      ...activityUpdatePatch(),
    });
    await ctx.scheduler.runAfter(0, internalRefs.jobs.runPending, {
      interviewId: interview._id,
    });
    return null;
  },
});

export const retryMalformedResponse = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const { interview, linkHash } = await byToken(ctx, args.token);
    if (!isInterviewPassBacked(interview)) {
      throw new Error("This Interview Link is waiting for the Creator to reserve a pass.");
    }
    if (
      interview.submission ||
      interview.step !== "interview" ||
      interview.operation
    ) {
      throw new Error("The Interview response cannot be retried.");
    }
    const page = await listMessages(ctx, agentComponent, {
      threadId: interview.agentThreadId,
      paginationOpts: { numItems: 1, cursor: null },
      excludeToolMessages: true,
      statuses: ["success"],
    });
    const latest = page.page[0];
    const latestContent = latest?.message
      ? agentMessageContentText(latest.message.content)
      : "";
    if (
      !latest?.message ||
      latest.message.role !== "assistant" ||
      !isMalformedStructuredInterviewOutput(latestContent)
    ) {
      throw new Error("The latest Interview response is not retryable.");
    }
    await rateLimiter.limit(ctx, "billableAi", {
      key: linkHash,
      throws: true,
    });
    await ctx.runMutation(agentComponent.messages.deleteByIds, {
      messageIds: [latest._id],
    });
    await ctx.db.patch("interviews", interview._id, {
      suggestedReplies: [],
      operation: {
        kind: "interview_response",
        status: "pending",
        attempt: 0,
      },
      ...activityUpdatePatch(),
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
      ...activityUpdatePatch(),
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
    const expectedConceptCount = interview.concepts.length === 6 ? 6 : 3;
    if (
      interview.step !== "concepts" ||
      !interview.projectDocument ||
      interview.operation ||
      interview.concepts.length !== expectedConceptCount ||
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
      ...completedRetentionPatch(now),
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
    if (!isInterviewPassBacked(interview)) {
      throw new Error("This Interview Link is waiting for the Creator to reserve a pass.");
    }
    return await listMessages(ctx, agentComponent, {
      threadId: interview.agentThreadId,
      paginationOpts: args.paginationOpts,
      excludeToolMessages: true,
    });
  },
});
