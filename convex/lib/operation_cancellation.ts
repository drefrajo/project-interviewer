import { cancel, type WorkflowId } from "@convex-dev/workflow";
import type { ComponentApi as WorkflowComponentApi } from "@convex-dev/workflow/_generated/component.js";
import {
  componentsGeneric,
  type GenericDataModel,
  type GenericMutationCtx,
} from "convex/server";
import type { GenericId } from "convex/values";
import { cancelledAggregateKind } from "./production_boundaries";

const workflowComponent = componentsGeneric()
  .workflow as unknown as WorkflowComponentApi;

type ActiveOperation = Readonly<{
  _id: GenericId<"durableOperations">;
  roomId: GenericId<"projectRooms">;
  operationType: string;
  subjectId: string;
  workflowId?: string;
}>;

const markAggregateRetryable = async (
  context: GenericMutationCtx<GenericDataModel>,
  operation: ActiveOperation,
  now: number,
) => {
  const aggregateKind = cancelledAggregateKind(operation.operationType);
  if (aggregateKind === "material") {
    const materialId = context.db.normalizeId(
      "projectMaterials",
      operation.subjectId,
    );
    const material = materialId ? await context.db.get(materialId) : null;
    if (
      materialId &&
      material &&
      material.roomId === operation.roomId &&
      material.active &&
      (material.state === "accepted" || material.state === "processing")
    ) {
      await context.db.patch(materialId, {
        state: "failed",
        stage: "complete",
        retryAvailable: true,
        failureCode: "OPERATION_CANCELLED",
        updatedAt: now,
      });
      const [activeMaterials, latestContext] = await Promise.all([
        context.db
          .query("projectMaterials")
          .withIndex("by_room_active", (query) =>
            query.eq("roomId", operation.roomId),
          )
          .collect()
          .then((items) => items.filter((item) => item.active === true)),
        context.db
          .query("contextPackRevisions")
          .withIndex("by_room_created", (query) =>
            query.eq("roomId", operation.roomId),
          )
          .order("desc")
          .first(),
      ]);
      const allTerminal = activeMaterials.every(
        (item) =>
          String(item._id) === String(materialId) ||
          item.state === "analyzed" ||
          item.state === "failed" ||
          item.state === "unsupported",
      );
      await context.db.patch(operation.roomId, {
        interviewReadiness:
          allTerminal && latestContext ? "ready" : "waiting_for_material",
        updatedAt: now,
      });
    }
    return;
  }
  if (aggregateKind === "interview") {
    const interviewId = context.db.normalizeId(
      "discoveryInterviews",
      operation.subjectId,
    );
    const interview = interviewId
      ? await context.db.get(interviewId)
      : null;
    if (
      interviewId &&
      interview &&
      interview.roomId === operation.roomId &&
      interview.status !== "completed" &&
      interview.status !== "completed_early"
    ) {
      await context.db.patch(interviewId, {
        status: "retryable",
        operationStatus: "retryable",
        updatedAt: now,
      });
    }
  }
};

export const cancelOperationAndRecoverAggregate = async (
  context: GenericMutationCtx<GenericDataModel>,
  operation: ActiveOperation,
  now: number,
) => {
  await context.db.patch(operation._id, {
    status: "cancelled",
    cancelRequestedAt: now,
    updatedAt: now,
  });
  if (operation.workflowId) {
    await cancel(
      context,
      workflowComponent,
      operation.workflowId as WorkflowId,
    );
  }
  await markAggregateRetryable(context, operation, now);
};
