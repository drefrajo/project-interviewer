import { WorkflowManager } from "@convex-dev/workflow";
import type { ComponentApi as WorkflowComponentApi } from "@convex-dev/workflow/_generated/component.js";
import {
  componentsGeneric,
  internalMutationGeneric,
  internalQueryGeneric,
  makeFunctionReference,
  mutationGeneric,
  type FunctionReference,
  type GenericDataModel,
  type GenericMutationCtx,
} from "convex/server";
import { v, type GenericId } from "convex/values";
import type {
  AiOperationResult,
  DomainOperationArguments,
  DomainOperationKind,
} from "./lib/ai-contract";
import { commitBrief } from "./lib/brief-commit";
import { commitFileAnalysis } from "./lib/file-analysis-commit";
import {
  commitInterviewPlanning,
  commitInterviewUpdate,
} from "./lib/interview-commit";
import { canCommitOperationResult } from "./lib/production-boundaries";
import {
  requireWritableClientRoom,
  requireWritableFreelancerRoom,
  requireWritableRoomActor,
} from "./lib/server-authorization";

const components = componentsGeneric();
export const workflowManager = new WorkflowManager(
  components.workflow as unknown as WorkflowComponentApi,
  {
    workpoolOptions: {
      maxParallelism: 3,
      retryActionsByDefault: true,
      defaultRetryBehavior: {
        maxAttempts: 2,
        initialBackoffMs: 500,
        base: 2,
      },
    },
  },
);

const operationKindValidator = v.union(
  v.literal("file_analysis"),
  v.literal("interview_planning"),
  v.literal("interview_turn"),
  v.literal("interview_review"),
  v.literal("brief_generation"),
);

const markStageReference = makeFunctionReference<
  "mutation",
  {
    operationId: GenericId<"durableOperations">;
    status: "running" | "retryable";
    stage: string;
    errorCode?: string;
  },
  boolean
>("workflows:markStage");
const executeDomainOperationReference = makeFunctionReference<
  "action",
  DomainOperationArguments,
  AiOperationResult
>("ai:executeDomainOperation");
const commitResultReference = makeFunctionReference<
  "mutation",
  {
    operationId: GenericId<"durableOperations">;
    kind: DomainOperationKind;
    subjectId: string;
    result: AiOperationResult;
  },
  boolean
>("workflows:commitResult");

export const loadDomainOperationContext = internalQueryGeneric({
  args: {
    operationId: v.id("durableOperations"),
    kind: operationKindValidator,
    subjectId: v.string(),
  },
  handler: async (context, args) => {
    const operation = await context.db.get(args.operationId);
    if (!operation) return null;
    const room = await context.db.get(operation.roomId);
    if (!room || room.deletedAt || room.phase === "archived") return null;
    const latestContext = await context.db
      .query("contextPackRevisions")
      .withIndex("by_room_created", (query) =>
        query.eq("roomId", operation.roomId),
      )
      .order("desc")
      .first();

    if (args.kind === "file_analysis") {
      const materialId = context.db.normalizeId(
        "projectMaterials",
        args.subjectId,
      );
      const material = materialId
        ? await context.db.get(materialId)
        : null;
      return material?.roomId === operation.roomId
        ? { operation, room, material, contextPack: latestContext }
        : null;
    }

    const interviewId = context.db.normalizeId(
      "discoveryInterviews",
      args.subjectId,
    );
    const interview = interviewId
      ? await context.db.get(interviewId)
      : await context.db
          .query("discoveryInterviews")
          .withIndex("by_room", (query) =>
            query.eq("roomId", operation.roomId),
          )
          .first();
    if (
      args.kind !== "brief_generation" &&
      (!interview || interview.roomId !== operation.roomId)
    ) {
      return null;
    }
    const resolvedInterview = interview ?? undefined;
    const plans = resolvedInterview
      ? await context.db
          .query("interviewPlans")
          .withIndex("by_interview", (query) =>
            query.eq("interviewId", resolvedInterview._id),
          )
          .collect()
      : [];
    const turns = resolvedInterview
      ? await context.db
          .query("interviewTurns")
          .withIndex("by_interview_sequence", (query) =>
            query.eq("interviewId", resolvedInterview._id),
          )
          .collect()
      : [];
    const corrections = resolvedInterview
      ? await context.db
          .query("interviewCorrections")
          .withIndex("by_interview", (query) =>
            query.eq("interviewId", resolvedInterview._id),
          )
          .collect()
      : [];
    const events = resolvedInterview
      ? await context.db
          .query("interviewEvents")
          .withIndex("by_interview", (query) =>
            query.eq("interviewId", resolvedInterview._id),
          )
          .collect()
      : [];
    const findings = await context.db
      .query("discoveryFindings")
      .withIndex("by_room_type", (query) =>
        query.eq("roomId", operation.roomId),
      )
      .collect();
    return {
      operation,
      room,
      interview: resolvedInterview,
      plan: plans.at(-1),
      turns,
      corrections,
      events,
      findings,
      contextPack: latestContext,
    };
  },
});

export const markStage = internalMutationGeneric({
  args: {
    operationId: v.id("durableOperations"),
    status: v.union(v.literal("running"), v.literal("retryable")),
    stage: v.string(),
    errorCode: v.optional(v.string()),
  },
  handler: async (context, args) => {
    const operation = await context.db.get(args.operationId);
    if (!operation || operation.status === "cancelled") return false;
    const room = await context.db.get(operation.roomId);
    if (!room || room.deletedAt || room.phase === "archived") return false;
    await context.db.patch(args.operationId, {
      status: args.status,
      stage: args.stage,
      ...(args.errorCode ? { errorCode: args.errorCode } : {}),
      updatedAt: Date.now(),
    });
    if (args.status === "retryable") {
      const now = Date.now();
      if (operation.operationType === "file_processing") {
        const materialId = context.db.normalizeId(
          "projectMaterials",
          String(operation.subjectId),
        );
        const material = materialId
          ? await context.db.get(materialId)
          : null;
        if (
          materialId &&
          material &&
          material.roomId === operation.roomId
        ) {
          await context.db.patch(materialId, {
            state:
              args.errorCode === "UNSUPPORTED_MATERIAL"
                ? "unsupported"
                : "failed",
            stage: "complete",
            retryAvailable: true,
            failureCode: args.errorCode ?? "AI_OPERATION_FAILED",
            updatedAt: now,
          });
          const activeMaterials = await context.db
            .query("projectMaterials")
            .withIndex("by_room_active", (query) =>
              query.eq("roomId", operation.roomId),
            )
            .collect()
            .then((items) =>
              items.filter((item) => item.active === true),
            );
          const latestContext = await context.db
            .query("contextPackRevisions")
            .withIndex("by_room_created", (query) =>
              query.eq("roomId", operation.roomId),
            )
            .order("desc")
            .first();
          const allTerminal = activeMaterials.every(
            (item) =>
              String(item._id) === String(materialId) ||
              item.state === "analyzed" ||
              item.state === "failed" ||
              item.state === "unsupported",
          );
          await context.db.patch(operation.roomId, {
            interviewReadiness:
              allTerminal && latestContext
                ? "ready"
                : "waiting_for_material",
            updatedAt: now,
          });
        }
      } else if (
        String(operation.operationType).startsWith("interview_")
      ) {
        const interviewId = context.db.normalizeId(
          "discoveryInterviews",
          String(operation.subjectId),
        );
        const interview = interviewId
          ? await context.db.get(interviewId)
          : null;
        if (
          interviewId &&
          interview &&
          interview.roomId === operation.roomId
        ) {
          await context.db.patch(interviewId, {
            status: "retryable",
            operationStatus: "retryable",
            updatedAt: now,
          });
        }
      }
    }
    return true;
  },
});

export const markMaterialProgress = internalMutationGeneric({
  args: {
    operationId: v.id("durableOperations"),
    materialId: v.id("projectMaterials"),
    stage: v.union(
      v.literal("checking_file"),
      v.literal("extracting_content"),
      v.literal("checking_secrets"),
      v.literal("analyzing"),
      v.literal("indexing"),
    ),
  },
  handler: async (context, args) => {
    const [operation, material] = await Promise.all([
      context.db.get(args.operationId),
      context.db.get(args.materialId),
    ]);
    if (
      !operation ||
      !material ||
      operation.status === "cancelled" ||
      operation.operationType !== "file_processing" ||
      operation.subjectId !== String(args.materialId) ||
      material.roomId !== operation.roomId ||
      !material.active
    ) {
      return false;
    }
    await context.db.patch(args.materialId, {
      state: "processing",
      stage: args.stage,
      updatedAt: Date.now(),
    });
    return true;
  },
});

export const commitResult = internalMutationGeneric({
  args: {
    operationId: v.id("durableOperations"),
    kind: operationKindValidator,
    subjectId: v.string(),
    result: v.any(),
  },
  handler: async (context, args) => {
    const operation = await context.db.get(args.operationId);
    const room = operation ? await context.db.get(operation.roomId) : null;
    if (
      !operation ||
      room?.phase === "archived" ||
      !canCommitOperationResult(
        String(operation.status),
        Boolean(room?.deletedAt),
      )
    ) {
      return false;
    }
    const result = args.result as AiOperationResult;
    const now = Date.now();
    if (args.kind === "file_analysis") {
      await commitFileAnalysis(
        context,
        operation,
        args.subjectId,
        result,
        now,
      );
    } else if (args.kind === "interview_planning") {
      await commitInterviewPlanning(
        context,
        operation,
        args.subjectId,
        result,
        now,
      );
    } else if (
      args.kind === "interview_turn" ||
      args.kind === "interview_review"
    ) {
      await commitInterviewUpdate(
        context,
        operation,
        args.subjectId,
        result,
        args.kind,
        now,
      );
    } else {
      await commitBrief(context, operation, result, now);
    }
    await context.db.patch(args.operationId, {
      status: "succeeded",
      stage: "complete",
      model: result.metadata.model,
      provider: result.metadata.provider,
      inputTokens: result.metadata.inputTokens,
      outputTokens: result.metadata.outputTokens,
      ...(result.metadata.estimatedCostUsd === undefined
        ? {}
        : { estimatedCostUsd: result.metadata.estimatedCostUsd }),
      latencyMs: result.metadata.latencyMs,
      updatedAt: now,
    });
    await context.db.insert("usageRecords", {
      roomId: operation.roomId,
      operationId: operation._id,
      operationType: String(operation.operationType),
      model: result.metadata.model,
      provider: result.metadata.provider,
      inputTokens: result.metadata.inputTokens,
      outputTokens: result.metadata.outputTokens,
      ...(result.metadata.estimatedCostUsd === undefined
        ? {}
        : { estimatedCostUsd: result.metadata.estimatedCostUsd }),
      latencyMs: result.metadata.latencyMs,
      attemptCount: result.metadata.attemptCount,
      createdAt: now,
    });
    return true;
  },
});

export const domainOperationWorkflow = workflowManager
  .define({
    args: {
      operationId: v.id("durableOperations"),
      kind: operationKindValidator,
      subjectId: v.string(),
    },
  })
  .handler(async (step, args): Promise<void> => {
    const active = await step.runMutation(markStageReference, {
      operationId: args.operationId,
      status: "running",
      stage: "calling_model",
    });
    if (!active) return;
    try {
      const result = await step.runAction(
        executeDomainOperationReference,
        args,
        {
          retry: {
            maxAttempts: 2,
            initialBackoffMs: 500,
            base: 2,
          },
        },
      );
      await step.runMutation(commitResultReference, {
        ...args,
        result,
      });
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : String(cause);
      await step.runMutation(markStageReference, {
        operationId: args.operationId,
        status: "retryable",
        stage: "failed",
        errorCode:
          /unsupported|encrypted|password.protected/i.test(message)
            ? "UNSUPPORTED_MATERIAL"
            : "AI_OPERATION_FAILED",
      });
    }
  });

const domainOperationWorkflowReference = makeFunctionReference<
  "mutation",
  { args: DomainOperationArguments },
  string
>("workflows:domainOperationWorkflow") as unknown as FunctionReference<
  "mutation",
  "internal",
  { args: DomainOperationArguments },
  string
>;

const expectedOperationType: Record<DomainOperationKind, string> = {
  file_analysis: "file_processing",
  interview_planning: "interview_planning",
  interview_turn: "interview_turn",
  interview_review: "interview_review",
  brief_generation: "brief_generation",
};

const startDomainOperation = async (
  context: GenericMutationCtx<GenericDataModel>,
  args: {
    roomId: GenericId<"projectRooms">;
    operationId: GenericId<"durableOperations">;
    kind: DomainOperationKind;
    subjectId: string;
  },
) => {
  const operation = await context.db.get(args.operationId);
  const room = await context.db.get(args.roomId);
  if (
    !operation ||
    !room ||
    room.deletedAt ||
    room.phase === "archived" ||
    operation.roomId !== args.roomId ||
    operation.operationType !== expectedOperationType[args.kind] ||
    operation.subjectId !== args.subjectId
  ) {
    throw new Error("Operation does not match the requested domain workflow.");
  }
  if (operation.workflowId) {
    return { workflowId: operation.workflowId, reused: true };
  }
  const workflowId = await workflowManager.start(
    context,
    domainOperationWorkflowReference,
    {
      operationId: args.operationId,
      kind: args.kind,
      subjectId: args.subjectId,
    },
    { startAsync: true },
  );
  await context.db.patch(args.operationId, {
    workflowId,
    updatedAt: Date.now(),
  });
  return { workflowId, reused: false };
};

export const startFileAnalysis = mutationGeneric({
  args: {
    roomId: v.id("projectRooms"),
    materialId: v.id("projectMaterials"),
    operationId: v.id("durableOperations"),
    sessionHash: v.optional(v.string()),
  },
  handler: async (context, args) => {
    await requireWritableRoomActor(
      context,
      args.roomId,
      args.sessionHash
        ? { kind: "client", sessionHash: args.sessionHash }
        : { kind: "freelancer" },
    );
    const material = await context.db.get(args.materialId);
    if (!material || material.roomId !== args.roomId) {
      throw new Error("Material not found.");
    }
    return startDomainOperation(context, {
      roomId: args.roomId,
      operationId: args.operationId,
      kind: "file_analysis",
      subjectId: String(args.materialId),
    });
  },
});

export const startFileAnalysisInternal = internalMutationGeneric({
  args: {
    roomId: v.id("projectRooms"),
    materialId: v.id("projectMaterials"),
    operationId: v.id("durableOperations"),
  },
  handler: async (context, args) => {
    const material = await context.db.get(args.materialId);
    if (!material || material.roomId !== args.roomId) {
      throw new Error("Material not found.");
    }
    return startDomainOperation(context, {
      roomId: args.roomId,
      operationId: args.operationId,
      kind: "file_analysis",
      subjectId: String(args.materialId),
    });
  },
});

const clientInterviewStarter = (
  kind: "interview_planning" | "interview_turn" | "interview_review",
) =>
  mutationGeneric({
    args: {
      roomId: v.id("projectRooms"),
      interviewId: v.id("discoveryInterviews"),
      operationId: v.id("durableOperations"),
      sessionHash: v.string(),
    },
    handler: async (context, args) => {
      await requireWritableClientRoom(
        context,
        args.roomId,
        args.sessionHash,
      );
      const interview = await context.db.get(args.interviewId);
      if (!interview || interview.roomId !== args.roomId) {
        throw new Error("Interview not found.");
      }
      return startDomainOperation(context, {
        roomId: args.roomId,
        operationId: args.operationId,
        kind,
        subjectId: String(args.interviewId),
      });
    },
  });

export const startInterviewPlanning = clientInterviewStarter(
  "interview_planning",
);
export const startInterviewTurn = clientInterviewStarter("interview_turn");
export const startInterviewReview = clientInterviewStarter(
  "interview_review",
);

export const startBriefGeneration = mutationGeneric({
  args: {
    roomId: v.id("projectRooms"),
    operationId: v.id("durableOperations"),
  },
  handler: async (context, args) => {
    await requireWritableFreelancerRoom(context, args.roomId);
    return startDomainOperation(context, {
      roomId: args.roomId,
      operationId: args.operationId,
      kind: "brief_generation",
      subjectId: String(args.roomId),
    });
  },
});
