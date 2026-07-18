import type { FunctionArgs } from "convex/server";
import type {
  BriefEvidenceDetail,
  ProjectBriefView,
} from "../domain/project-brief";
import type {
  ProjectInterviewer,
  RoomActor,
} from "../domain/project-interviewer";
import {
  actorArguments,
  record,
  references,
  stringValue,
  type HostedConvexTransport,
  type WireValue,
} from "./hosted-contract";
import { pollUntil } from "./poll-until";
import { projectBriefViewSchema } from "./hosted-dto-schemas";

export const createHostedBriefService = (
  transport: HostedConvexTransport,
): ProjectInterviewer["briefs"] => {
  type EditableBriefMutation =
    | typeof references.briefs.updateMarkdown
    | typeof references.briefs.updateSection
    | typeof references.briefs.addItem
    | typeof references.briefs.updateItem
    | typeof references.briefs.moveItem
    | typeof references.briefs.removeItem
    | typeof references.briefs.resolveWarning
    | typeof references.briefs.sendForReview
    | typeof references.briefs.submitChangeRequest
    | typeof references.briefs.acknowledgeChangeRequest
    | typeof references.briefs.approve
    | typeof references.briefs.reopen;
  const get = async (
    actor: RoomActor,
    roomId: string,
  ): Promise<ProjectBriefView> => {
    const raw = record(
      await transport.query(references.briefs.get, {
        roomId,
        ...actorArguments(actor),
      }),
    );
    const operation =
      raw.operation && typeof raw.operation === "object"
        ? record(raw.operation)
        : null;
    return projectBriefViewSchema.parse({
      ...raw,
      ...(operation
        ? {
            operation: {
              ...operation,
              status:
                operation.status === "pending"
                  ? "running"
                  : operation.status === "failed"
                    ? "retryable"
                    : operation.status,
            },
          }
        : { operation: null }),
    });
  };

  const wait = async (actor: RoomActor, roomId: string) => {
    return pollUntil({
      attempts: 120,
      intervalMs: 500,
      load: () => get(actor, roomId),
      isComplete: (brief) => brief.operation?.status !== "running",
    });
  };

  const mutate = async <Reference extends EditableBriefMutation>(
    reference: Reference,
    actor: RoomActor,
    roomId: string,
    input?: Omit<
      WireValue<FunctionArgs<Reference>>,
      "roomId" | "sessionHash"
    >,
  ) => {
    await transport.mutation(reference, {
      roomId,
      ...actorArguments(actor),
      ...(input ?? {}),
    } as WireValue<FunctionArgs<Reference>>);
    return get(actor, roomId);
  };

  const generate: ProjectInterviewer["briefs"]["generate"] = async (
    actor,
    roomId,
    input,
  ) => {
    if (actor.kind !== "freelancer") {
      throw new Error("Only the Freelancer can generate the brief.");
    }
    const started = record(
      await transport.mutation(references.briefs.beginGeneration, {
        roomId,
        ...input,
      }),
    );
    await transport.mutation(references.briefWorkflow.start, {
      roomId,
      operationId: stringValue(started.operationId, "operation id"),
    });
    return wait(actor, roomId);
  };

  const service: ProjectInterviewer["briefs"] = {
    get,
    generate,
    async retryGeneration(actor, roomId) {
      const current = await get(actor, roomId);
      return generate(actor, roomId, {
        idempotencyKey:
          current.operation?.idempotencyKey ??
          `brief_generation:${roomId}`,
      });
    },
    updateMarkdown: (actor, roomId, input) =>
      mutate(references.briefs.updateMarkdown, actor, roomId, input),
    updateSection: (actor, roomId, input) =>
      mutate(references.briefs.updateSection, actor, roomId, input),
    addItem: (actor, roomId, input) =>
      mutate(references.briefs.addItem, actor, roomId, input),
    updateItem: (actor, roomId, input) =>
      mutate(references.briefs.updateItem, actor, roomId, input),
    moveItem: (actor, roomId, input) =>
      mutate(references.briefs.moveItem, actor, roomId, input),
    removeItem: (actor, roomId, input) =>
      mutate(references.briefs.removeItem, actor, roomId, input),
    resolveWarning: (actor, roomId, input) =>
      mutate(references.briefs.resolveWarning, actor, roomId, input),
    sendForReview: (actor, roomId) =>
      mutate(references.briefs.sendForReview, actor, roomId),
    submitChangeRequest: (actor, roomId, input) =>
      mutate(references.briefs.submitChangeRequest, actor, roomId, input),
    acknowledgeChangeRequest: (actor, roomId) =>
      mutate(
        references.briefs.acknowledgeChangeRequest,
        actor,
        roomId,
      ),
    approve: (actor, roomId) =>
      mutate(references.briefs.approve, actor, roomId),
    reopen: (actor, roomId) =>
      mutate(references.briefs.reopen, actor, roomId),
    async exportMarkdown(actor, roomId, input) {
      return stringValue(
        await transport.query(references.briefs.exportMarkdown, {
          roomId,
          ...actorArguments(actor),
          ...input,
        }),
        "Markdown export",
      );
    },
    async inspectSource(actor, roomId, source) {
      const raw = record(
        await transport.query(references.briefs.inspectSource, {
          roomId,
          ...actorArguments(actor),
          source,
        }),
      );
      return {
        label: stringValue(raw.label, "evidence label"),
        text: stringValue(raw.text, "evidence text"),
        ...(typeof raw.locator === "string"
          ? { locator: raw.locator }
          : {}),
        ...(typeof raw.reason === "string" ? { reason: raw.reason } : {}),
        ...(typeof raw.sequence === "number"
          ? { sequence: raw.sequence }
          : {}),
        ...(typeof raw.unavailable === "boolean"
          ? { unavailable: raw.unavailable }
          : {}),
      } satisfies BriefEvidenceDetail;
    },
  };
  return service;
};
