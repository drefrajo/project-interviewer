import { mutationGeneric, queryGeneric } from "convex/server";
import { v, type GenericId, type Value } from "convex/values";
import {
  requireClientRoom,
  requireRoomActorFromSession,
  requireWritableClientRoom,
} from "./lib/server_authorization";
import { asRecord } from "./lib/commit_values";
import { recordAudit } from "./lib/audit";
import { canRetryWorkflow } from "./lib/production_boundaries";
import { enforceRateLimit } from "./lib/rate_limit";

const clientArgs = {
  roomId: v.id("projectRooms"),
  sessionHash: v.string(),
};

type OperationDocument = Readonly<{
  _id: GenericId<"durableOperations">;
  operationType: string;
  status: string;
  stage: string;
  attemptCount: number;
  model?: string;
  provider?: string;
  promptVersion?: string;
  schemaVersion: string;
  contextPackRevisionId?: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
  latencyMs?: number;
  errorCode?: string;
}>;

const latestOperation = async (
  context: Parameters<typeof requireRoomActorFromSession>[0],
  roomId: Parameters<typeof requireRoomActorFromSession>[1],
): Promise<OperationDocument | undefined> => {
  const operations = await context.db
    .query("durableOperations")
    .withIndex("by_room", (query) => query.eq("roomId", roomId))
    .order("desc")
    .collect();
  return operations.find((operation) =>
    String(operation.operationType).startsWith("interview_"),
  ) as unknown as OperationDocument | undefined;
};

export const get = queryGeneric({
  args: {
    roomId: v.id("projectRooms"),
    sessionHash: v.optional(v.string()),
  },
  handler: async (context, args) => {
    const actor = await requireRoomActorFromSession(
      context,
      args.roomId,
      args.sessionHash,
    );
    const interview = await context.db
      .query("discoveryInterviews")
      .withIndex("by_room_purge", (query) => query.eq("roomId", args.roomId))
      .first();
    if (!interview) return null;
    const [plan, turns, corrections, findings, events, lease, operation] =
      await Promise.all([
        context.db
          .query("interviewPlans")
          .withIndex("by_interview", (query) =>
            query.eq("interviewId", interview._id),
          )
          .order("desc")
          .first(),
        context.db
          .query("interviewTurns")
          .withIndex("by_interview_sequence", (query) =>
            query.eq("interviewId", interview._id),
          )
          .collect(),
        context.db
          .query("interviewCorrections")
          .withIndex("by_interview", (query) =>
            query.eq("interviewId", interview._id),
          )
          .collect(),
        context.db
          .query("discoveryFindings")
          .withIndex("by_interview", (query) =>
            query.eq("interviewId", interview._id),
          )
          .collect(),
        context.db
          .query("interviewEvents")
          .withIndex("by_interview", (query) =>
            query.eq("interviewId", interview._id),
          )
          .collect(),
        context.db
          .query("respondingDeviceLeases")
          .withIndex("by_room_purge", (query) => query.eq("roomId", args.roomId))
          .first(),
        latestOperation(context, args.roomId),
      ]);
    const respondingDevice =
      actor.kind === "client" &&
      Boolean(lease && lease.deviceHash === actor.session.deviceHash);
    return {
      id: interview._id,
      roomId: interview.roomId,
      language: interview.language,
      status: interview.status,
      respondingDevice,
      leaseVersion: lease?.leaseVersion ?? null,
      currentQuestion: interview.currentQuestion,
      operationStatus: interview.operationStatus,
      answerCount: interview.answerCount,
      ...(plan
        ? {
            plan: {
              profileId: plan.profileId,
              profileVersion: plan.profileVersion,
            },
          }
        : {}),
      coverage:
        plan?.coverageAreas.map(
          (area: { id: string; label: string; status: string }) => ({
            id: area.id,
            label: area.label,
            status: area.status,
          }),
        ) ?? [],
      turns: turns.map((turn) => ({
        ...turn,
        id: turn._id,
        contextPackRevisionId: turn.contextPackRevisionId ?? null,
        contextPackRevision: turn.contextPackRevision ?? null,
      })),
      corrections: corrections.map((correction) => ({
        ...correction,
        id: correction._id,
        deviceId: correction.deviceHash,
      })),
      findings: findings.map((finding) => ({
        ...finding,
        id: finding._id,
        type: finding.findingType,
      })),
      events: events.map((event) => ({
        ...event,
        id: event._id,
        type: event.eventType,
      })),
      unresolvedTopics: interview.unresolvedTopics,
      completionRationale: interview.completionRationale,
      incompleteReason: interview.incompleteReason,
      reviewerBlockers: interview.reviewerBlockers,
      usageReviewTriggered: interview.usageReviewTriggered,
      ...(operation
        ? {
            operation: {
              operationType: operation.operationType,
              status: operation.status,
              stage:
                operation.status === "succeeded"
                  ? "complete"
                  : operation.operationType === "interview_planning"
                    ? "planning"
                    : operation.operationType === "interview_review"
                      ? "reviewing"
                      : "reasoning",
              attemptCount: operation.attemptCount,
              model: operation.model,
              provider: operation.provider,
              promptVersion: operation.promptVersion ?? "unknown",
              schemaVersion: operation.schemaVersion,
              contextPackRevisionId: operation.contextPackRevisionId,
              inputTokens: operation.inputTokens,
              outputTokens: operation.outputTokens,
              estimatedCostUsd: operation.estimatedCostUsd,
              latencyMs: operation.latencyMs,
              errorCode: operation.errorCode,
            },
          }
        : {}),
    };
  },
});

export const start = mutationGeneric({
  args: clientArgs,
  handler: async (context, args) => {
    const actor = await requireWritableClientRoom(
      context,
      args.roomId,
      args.sessionHash,
    );
    const existing = await context.db
      .query("discoveryInterviews")
      .withIndex("by_room_purge", (query) => query.eq("roomId", args.roomId))
      .first();
    if (existing) return { interviewId: existing._id, operationId: null };
    const [room, activeMaterials, latestContext] = await Promise.all([
      context.db.get(args.roomId),
      context.db
        .query("projectMaterials")
        .withIndex("by_room_active", (query) =>
          query.eq("roomId", args.roomId),
        )
        .collect()
        .then((items) => items.filter((item) => item.active === true)),
      context.db
        .query("contextPackRevisions")
        .withIndex("by_room_created", (query) =>
          query.eq("roomId", args.roomId),
        )
        .order("desc")
        .first(),
    ]);
    const allMaterialsTerminal = activeMaterials.every(
      (material) =>
        material.state === "analyzed" ||
        material.state === "failed" ||
        material.state === "unsupported",
    );
    if (
      !room ||
      room.interviewReadiness !== "ready" ||
      !allMaterialsTerminal ||
      !latestContext
    ) {
      throw new Error(
        "Discovery can start only after Project Material is terminal and a current Context Pack exists.",
      );
    }
    const profile = await context.db
      .query("clientProfiles")
      .withIndex("by_room_purge", (query) => query.eq("roomId", args.roomId))
      .unique();
    if (!profile) throw new Error("Client onboarding is required.");
    const now = Date.now();
    const interviewId = await context.db.insert("discoveryInterviews", {
      roomId: args.roomId,
      planId: "pending",
      language: profile.interviewLanguage,
      status: "planning",
      operationStatus: "running",
      answerCount: 0,
      unresolvedTopics: [],
      reviewerBlockers: [],
      reviewedAnswerCount: 0,
      usageReviewTriggered: false,
      createdAt: now,
      updatedAt: now,
    });
    await context.db.insert("respondingDeviceLeases", {
      roomId: args.roomId,
      interviewId: String(interviewId),
      deviceHash: actor.session.deviceHash,
      inviteVersion: actor.session.inviteVersion,
      heartbeatAt: now,
      leaseVersion: 1,
      createdAt: now,
      updatedAt: now,
    });
    const operationId = await context.db.insert("durableOperations", {
      roomId: args.roomId,
      operationType: "interview_planning",
      subjectId: String(interviewId),
      idempotencyKey: `interview_planning:${interviewId}`,
      status: "pending",
      stage: "queued",
      attemptCount: 1,
      promptVersion: "software-project-interview-planner-v1",
      schemaVersion: "interview-plan-v1",
      createdAt: now,
      updatedAt: now,
    });
    return { interviewId, operationId };
  },
});

const requireRespondingDevice = async (
  context: Parameters<typeof requireClientRoom>[0],
  args: { roomId: Parameters<typeof requireClientRoom>[1]; sessionHash: string },
) => {
  const actor = await requireWritableClientRoom(
    context,
    args.roomId,
    args.sessionHash,
  );
  const lease = await context.db
    .query("respondingDeviceLeases")
    .withIndex("by_room_purge", (query) => query.eq("roomId", args.roomId))
    .first();
  if (!lease || lease.deviceHash !== actor.session.deviceHash) {
    throw new Error("This device does not have response permission.");
  }
  return { actor, lease };
};

export const heartbeat = mutationGeneric({
  args: clientArgs,
  handler: async (context, args) => {
    const { actor, lease } = await requireRespondingDevice(context, args);
    await enforceRateLimit(context, {
      roomId: args.roomId,
      scope: "interview_heartbeat",
      key: `${args.roomId}:${actor.session.deviceHash}`,
      limit: 120,
      windowMs: 60 * 1000,
    });
    const now = Date.now();
    await context.db.patch(
      lease._id as GenericId<"respondingDeviceLeases">,
      {
      heartbeatAt: now,
      updatedAt: now,
      },
    );
    return lease.leaseVersion;
  },
});

export const takeover = mutationGeneric({
  args: { ...clientArgs, acknowledgedDraftLoss: v.boolean() },
  handler: async (context, args) => {
    if (!args.acknowledgedDraftLoss) {
      throw new Error("Draft-loss acknowledgement is required.");
    }
    const actor = await requireWritableClientRoom(
      context,
      args.roomId,
      args.sessionHash,
    );
    await enforceRateLimit(context, {
      roomId: args.roomId,
      scope: "responding_device_takeover",
      key: `${args.roomId}:${actor.session.deviceHash}`,
      limit: 10,
      windowMs: 5 * 60 * 1000,
    });
    const lease = await context.db
      .query("respondingDeviceLeases")
      .withIndex("by_room_purge", (query) => query.eq("roomId", args.roomId))
      .first();
    if (!lease) throw new Error("Interview lease not found.");
    const now = Date.now();
    await context.db.patch(lease._id, {
      deviceHash: actor.session.deviceHash,
      inviteVersion: actor.session.inviteVersion,
      leaseVersion: lease.leaseVersion + 1,
      heartbeatAt: now,
      updatedAt: now,
    });
    await recordAudit(context, {
      roomId: args.roomId,
      actorKind: "client",
      actorId: actor.actorId,
      deviceHash: actor.session.deviceHash,
      action: "interview.responding_device_taken_over",
      now,
    });
  },
});

const acceptTurn = mutationGeneric({
  args: {
    ...clientArgs,
    questionId: v.string(),
    answer: v.string(),
    answerKind: v.union(v.literal("answer"), v.literal("skip")),
    idempotencyKey: v.string(),
    contextPackRevisionId: v.optional(v.id("contextPackRevisions")),
  },
  handler: async (context, args) => {
    const { actor } = await requireRespondingDevice(context, args);
    const interview = await context.db
      .query("discoveryInterviews")
      .withIndex("by_room_purge", (query) => query.eq("roomId", args.roomId))
      .first();
    if (!interview) throw new Error("Interview not found.");
    const existing = await context.db
      .query("interviewTurns")
      .withIndex("by_interview_idempotency", (query) =>
        query.eq("interviewId", interview._id),
      )
      .collect()
      .then((items) =>
        items.find((item) => item.idempotencyKey === args.idempotencyKey),
      );
    if (existing) {
      const operation = await context.db
        .query("durableOperations")
        .withIndex("by_idempotency", (query) =>
          query.eq("roomId", args.roomId),
        )
        .collect()
        .then((items) =>
          items.find(
            (item) =>
              item.idempotencyKey ===
              `interview_turn:${args.idempotencyKey}`,
          ),
        );
      return { interviewId: interview._id, operationId: operation?._id };
    }
    if (interview.status !== "active" || !interview.currentQuestion) {
      throw new Error("No question is active.");
    }
    if (
      interview.currentQuestion.id !== args.questionId ||
      interview.operationStatus === "running"
    ) {
      throw new Error("The current question has changed.");
    }
    const answer = args.answer.trim();
    if (args.answerKind === "answer" && !answer) {
      throw new Error("An answer is required.");
    }
    const [contextPack, latestContext, activeMaterials] = await Promise.all([
      args.contextPackRevisionId
        ? context.db.get(args.contextPackRevisionId)
        : null,
      context.db
        .query("contextPackRevisions")
        .withIndex("by_room_created", (query) =>
          query.eq("roomId", args.roomId),
        )
        .order("desc")
        .first(),
      context.db
        .query("projectMaterials")
        .withIndex("by_room_active", (query) =>
          query.eq("roomId", args.roomId),
        )
        .collect()
        .then((items) => items.filter((item) => item.active === true)),
    ]);
    if (
      !contextPack ||
      contextPack.roomId !== args.roomId ||
      !latestContext ||
      contextPack._id !== latestContext._id ||
      activeMaterials.some(
        (material) =>
          material.state === "accepted" ||
          material.state === "processing",
      )
    ) {
      throw new Error(
        "The latest Context Pack and terminal Project Material are required before answering.",
      );
    }
    const now = Date.now();
    const turnId = await context.db.insert("interviewTurns", {
      roomId: args.roomId,
      interviewId: interview._id,
      sequence: interview.answerCount + 1,
      question: interview.currentQuestion,
      answer: args.answerKind === "skip" ? "" : answer,
      answerKind: args.answerKind,
      idempotencyKey: args.idempotencyKey,
      contextPackRevisionId: contextPack._id,
      contextPackRevision: contextPack.revision,
      acceptedAt: now,
    });
    await context.db.patch(interview._id, {
      answerCount: interview.answerCount + 1,
      operationStatus: "running",
      usageReviewTriggered:
        interview.usageReviewTriggered || interview.answerCount + 1 >= 40,
      updatedAt: now,
    });
    const operationId = await context.db.insert("durableOperations", {
      roomId: args.roomId,
      operationType: "interview_turn",
      subjectId: String(interview._id),
      idempotencyKey: `interview_turn:${args.idempotencyKey}`,
      status: "pending",
      stage: "accepted",
      attemptCount: 1,
      promptVersion: "software-project-interview-agent-v1",
      schemaVersion: "interview-agent-delta-v1",
      contextPackRevisionId: String(contextPack._id),
      createdAt: now,
      updatedAt: now,
    });
    await recordAudit(context, {
      roomId: args.roomId,
      actorKind: "client",
      actorId: actor.actorId,
      deviceHash: actor.session.deviceHash,
      action: "interview.answer_accepted",
      now,
    });
    return { interviewId: interview._id, turnId, operationId };
  },
});

export { acceptTurn };

export const setStatus = mutationGeneric({
  args: {
    ...clientArgs,
    status: v.union(v.literal("paused"), v.literal("active")),
  },
  handler: async (context, args) => {
    const { actor } = await requireRespondingDevice(context, args);
    const interview = await context.db
      .query("discoveryInterviews")
      .withIndex("by_room_purge", (query) => query.eq("roomId", args.roomId))
      .first();
    if (!interview) throw new Error("Interview not found.");
    if (
      (args.status === "paused" && interview.status !== "active") ||
      (args.status === "active" && interview.status !== "paused") ||
      interview.operationStatus !== "idle"
    ) {
      throw new Error("The requested Interview status transition is invalid.");
    }
    await context.db.patch(interview._id, {
      status: args.status,
      updatedAt: Date.now(),
    });
    await recordAudit(context, {
      roomId: args.roomId,
      actorKind: "client",
      actorId: actor.actorId,
      deviceHash: actor.session.deviceHash,
      action:
        args.status === "paused"
          ? "interview.paused"
          : "interview.resumed",
    });
  },
});

export const finishEarly = mutationGeneric({
  args: {
    ...clientArgs,
    confirmed: v.boolean(),
    reason: v.optional(v.string()),
  },
  handler: async (context, args) => {
    const { actor } = await requireRespondingDevice(context, args);
    if (!args.confirmed) throw new Error("Confirmation is required.");
    const interview = await context.db
      .query("discoveryInterviews")
      .withIndex("by_room_purge", (query) => query.eq("roomId", args.roomId))
      .first();
    if (
      !interview ||
      !["active", "paused"].includes(String(interview.status)) ||
      interview.operationStatus !== "idle"
    ) {
      throw new Error("Only an in-progress Interview may finish early.");
    }
    const now = Date.now();
    await context.db.patch(interview._id, {
      status: "completed_early",
      operationStatus: "idle",
      incompleteReason: args.reason?.trim() || "Client finished early.",
      updatedAt: now,
    });
    await context.db.patch(args.roomId, {
      phase: "freelancer_review",
      updatedAt: now,
      lastActivityAt: now,
    });
    await recordAudit(context, {
      roomId: args.roomId,
      actorKind: "client",
      actorId: actor.actorId,
      deviceHash: actor.session.deviceHash,
      action: "interview.completed_early",
      now,
    });
  },
});

export const correct = mutationGeneric({
  args: {
    ...clientArgs,
    turnId: v.id("interviewTurns"),
    correctedAnswer: v.string(),
    reason: v.string(),
  },
  handler: async (context, args) => {
    const { actor } = await requireRespondingDevice(context, args);
    const turn = await context.db.get(args.turnId);
    if (!turn || turn.roomId !== args.roomId) {
      throw new Error("Interview Turn not found.");
    }
    const interview = await context.db.get(turn.interviewId);
    if (
      !interview ||
      !["active", "paused"].includes(String(interview.status)) ||
      interview.operationStatus !== "idle"
    ) {
      throw new Error(
        "Corrections require an idle, in-progress Discovery Interview.",
      );
    }
    if (!args.correctedAnswer.trim() || !args.reason.trim()) {
      throw new Error("Correction and reason are required.");
    }
    await context.db.insert("interviewCorrections", {
      roomId: args.roomId,
      interviewId: turn.interviewId,
      turnId: args.turnId,
      correctedAnswer: args.correctedAnswer.trim(),
      reason: args.reason.trim(),
      deviceHash: actor.session.deviceHash,
      createdAt: Date.now(),
    });
    const [findings, plan] = await Promise.all([
      context.db
        .query("discoveryFindings")
        .withIndex("by_interview", (query) =>
          query.eq("interviewId", turn.interviewId),
        )
        .collect(),
      context.db
        .query("interviewPlans")
        .withIndex("by_interview", (query) =>
          query.eq("interviewId", turn.interviewId),
        )
        .order("desc")
        .first(),
    ]);
    await Promise.all(
      findings
        .filter((finding) =>
          (Array.isArray(finding.sources) ? finding.sources : []).some(
            (source: unknown) => {
              const evidence = asRecord(source);
              return (
                evidence.type === "turn" &&
                evidence.turnId === String(args.turnId)
              );
            },
          ),
        )
        .map((finding) =>
          context.db.patch(finding._id, {
            status: "needs_reassessment",
          }),
        ),
    );
    if (plan) {
      const coverage = (
        Array.isArray(plan.coverageAreas) ? plan.coverageAreas : []
      ).map((rawArea: unknown) => {
        const area = asRecord(rawArea);
        const affected = (
          Array.isArray(area.evidence) ? area.evidence : []
        ).some((source: unknown) => {
          const evidence = asRecord(source);
          return (
            evidence.type === "turn" &&
            evidence.turnId === String(args.turnId)
          );
        });
        return affected
          ? {
              ...area,
              status: "partial",
              rationale:
                "A Client correction requires this coverage to be reassessed.",
              openQuestions: [
                ...(Array.isArray(area.openQuestions)
                  ? area.openQuestions
                  : []),
                "Reassess the corrected answer.",
              ],
            }
          : area;
      });
      await context.db.patch(plan._id, {
        coverageAreas: coverage as Value[],
        updatedAt: Date.now(),
      });
    }
    await recordAudit(context, {
      roomId: args.roomId,
      actorKind: "client",
      actorId: actor.actorId,
      deviceHash: actor.session.deviceHash,
      action: "interview.correction_added",
    });
  },
});

export const confirmCompletion = mutationGeneric({
  args: { ...clientArgs, confirmed: v.boolean() },
  handler: async (context, args) => {
    const { actor } = await requireRespondingDevice(context, args);
    const interview = await context.db
      .query("discoveryInterviews")
      .withIndex("by_room_purge", (query) => query.eq("roomId", args.roomId))
      .first();
    if (!interview || interview.status !== "awaiting_confirmation") {
      throw new Error("Discovery is not awaiting Client confirmation.");
    }
    const now = Date.now();
    if (args.confirmed) {
      const [turns, operations] = await Promise.all([
        context.db
          .query("interviewTurns")
          .withIndex("by_interview_sequence", (query) =>
            query.eq("interviewId", interview._id),
          )
          .collect(),
        context.db
          .query("durableOperations")
          .withIndex("by_room", (query) =>
            query.eq("roomId", args.roomId),
          )
          .collect(),
      ]);
      const finalQuestionAnswered = turns.some(
        (turn) => turn.question.kind === "final_anything_else",
      );
      const reviewerCleared = operations.some(
        (operation) =>
          operation.operationType === "interview_review" &&
          operation.status === "succeeded" &&
          operation.idempotencyKey ===
            `interview_review:${interview._id}:${interview.answerCount}`,
      );
      if (
        interview.status !== "awaiting_confirmation" ||
        interview.reviewerBlockers.length > 0 ||
        interview.reviewedAnswerCount !== interview.answerCount ||
        !finalQuestionAnswered ||
        !reviewerCleared
      ) {
        throw new Error(
          "Completion requires agent assessment, reviewer clearance, the final anything-else answer, and Client confirmation.",
        );
      }
      await context.db.patch(interview._id, {
        status: "completed",
        operationStatus: "idle",
        updatedAt: now,
      });
      await context.db.patch(args.roomId, {
        phase: "freelancer_review",
        updatedAt: now,
        lastActivityAt: now,
      });
    } else {
      await context.db.patch(interview._id, {
        status: "active",
        operationStatus: "idle",
        currentQuestion: {
          id: `question_${crypto.randomUUID()}`,
          text:
            interview.language === "de"
              ? "Was sollten wir vor dem Abschluss noch klären?"
              : "What should we clarify before completing discovery?",
          coverageAreaId: "final",
          kind: "follow_up",
          reason: "The Client asked to continue discovery.",
          askedAt: now,
        },
        updatedAt: now,
      });
    }
    await recordAudit(context, {
      roomId: args.roomId,
      actorKind: "client",
      actorId: actor.actorId,
      deviceHash: actor.session.deviceHash,
      action: args.confirmed
        ? "interview.completion_confirmed"
        : "interview.completion_declined",
      now,
    });
  },
});

export const retry = mutationGeneric({
  args: clientArgs,
  handler: async (context, args) => {
    const { actor } = await requireRespondingDevice(context, args);
    const interview = await context.db
      .query("discoveryInterviews")
      .withIndex("by_room_purge", (query) => query.eq("roomId", args.roomId))
      .first();
    if (
      !interview ||
      interview.status !== "retryable" ||
      interview.operationStatus !== "retryable"
    ) {
      throw new Error("No interrupted Interview step can be retried.");
    }
    const operation = await latestOperation(context, args.roomId);
    if (
      !operation ||
      (operation.status !== "retryable" &&
        operation.status !== "cancelled")
    ) {
      throw new Error("No interrupted interview step can be retried.");
    }
    if (!canRetryWorkflow(Number(operation.attemptCount))) {
      throw new Error("The interview retry limit has been reached.");
    }
    const now = Date.now();
    await context.db.patch(
      operation._id as GenericId<"durableOperations">,
      {
      status: "pending",
      stage: "queued",
      attemptCount: Number(operation.attemptCount) + 1,
      workflowId: undefined,
      errorCode: undefined,
      updatedAt: now,
      },
    );
    await context.db.patch(interview._id, {
      operationStatus: "running",
      updatedAt: now,
    });
    await recordAudit(context, {
      roomId: args.roomId,
      actorKind: "client",
      actorId: actor.actorId,
      deviceHash: actor.session.deviceHash,
      action: "interview.operation_retried",
      now,
    });
    return {
      interviewId: interview._id,
      operationId: operation._id,
      operationType: operation.operationType,
    };
  },
});

export const beginReview = mutationGeneric({
  args: clientArgs,
  handler: async (context, args) => {
    const { actor } = await requireRespondingDevice(context, args);
    const interview = await context.db
      .query("discoveryInterviews")
      .withIndex("by_room_purge", (query) => query.eq("roomId", args.roomId))
      .first();
    if (!interview || interview.status !== "awaiting_confirmation") {
      throw new Error("Discovery is not ready for completion review.");
    }
    const idempotencyKey = `interview_review:${interview._id}:${interview.answerCount}`;
    const existing = await context.db
      .query("durableOperations")
      .withIndex("by_room", (query) => query.eq("roomId", args.roomId))
      .order("desc")
      .collect()
      .then((items) =>
        items.find(
          (item) =>
            item.operationType === "interview_review" &&
            item.idempotencyKey === idempotencyKey &&
            (item.status === "pending" ||
              item.status === "running" ||
              item.status === "succeeded"),
        ),
      );
    if (existing) {
      return {
        interviewId: interview._id,
        operationId: existing._id,
        reused: true,
      };
    }
    const now = Date.now();
    const operationId = await context.db.insert("durableOperations", {
      roomId: args.roomId,
      operationType: "interview_review",
      subjectId: String(interview._id),
      idempotencyKey,
      status: "pending",
      stage: "queued",
      attemptCount: 1,
      promptVersion: "software-project-interview-reviewer-v1",
      schemaVersion: "interview-review-v1",
      createdAt: now,
      updatedAt: now,
    });
    await context.db.patch(interview._id, {
      operationStatus: "running",
      updatedAt: now,
    });
    await recordAudit(context, {
      roomId: args.roomId,
      actorKind: "client",
      actorId: actor.actorId,
      deviceHash: actor.session.deviceHash,
      action: "interview.completion_review_started",
      now,
    });
    return { interviewId: interview._id, operationId, reused: false };
  },
});
