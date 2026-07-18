import type { DiscoveryInterviewView } from "../domain/discovery-interview";
import type { ProjectInterviewer, RoomActor } from "../domain/project-interviewer";
import {
  actorArguments,
  numberValue,
  record,
  references,
  stringValue,
  type HostedConvexTransport,
} from "./hosted-contract";
import { pollUntil } from "./poll-until";
import { discoveryInterviewViewSchema } from "./hosted-dto-schemas";

const requireClient = (actor: RoomActor) => {
  if (actor.kind !== "client") {
    throw new Error("Only the Client can change the Discovery Interview.");
  }
  return actor;
};

export const createHostedInterviewService = (
  transport: HostedConvexTransport,
): ProjectInterviewer["interviews"] => {
  const get = async (
    actor: RoomActor,
    roomId: string,
  ): Promise<DiscoveryInterviewView | null> => {
    const value = await transport.query(references.interviews.get, {
      roomId,
      ...actorArguments(actor),
    });
    return value === null
      ? null
      : discoveryInterviewViewSchema.parse(value);
  };

  const startWorkflow = async (
    operationType: string,
    roomId: string,
    interviewId: string,
    operationId: string,
    sessionHash: string,
  ) => {
    const reference =
      operationType === "interview_planning"
        ? references.workflows.startInterviewPlanning
        : operationType === "interview_review"
          ? references.workflows.startInterviewReview
          : references.workflows.startInterviewTurn;
    await transport.mutation(reference, {
      roomId,
      interviewId,
      operationId,
      sessionHash,
    });
  };

  const wait = async (
    actor: RoomActor,
    roomId: string,
  ): Promise<DiscoveryInterviewView> => {
    const interview = await pollUntil({
      attempts: 120,
      intervalMs: 500,
      load: async () => {
        const current = await get(actor, roomId);
        if (
          actor.kind === "client" &&
          current?.status === "awaiting_confirmation" &&
          current.operation?.operationType === "interview_turn"
        ) {
          const review = record(
            await transport.mutation(references.interviews.beginReview, {
              roomId,
              sessionHash: actor.sessionId,
            }),
          );
          if (review.reused !== true) {
            await startWorkflow(
              "interview_review",
              roomId,
              stringValue(review.interviewId, "interview id"),
              stringValue(review.operationId, "operation id"),
              actor.sessionId,
            );
          }
          return null;
        }
        return current;
      },
      isComplete: (current) =>
        current !== null && current.operationStatus !== "running",
    });
    if (!interview) throw new Error("Discovery Interview is unavailable.");
    return interview;
  };

  const requireCurrent = async (actor: RoomActor, roomId: string) => {
    const interview = await get(actor, roomId);
    if (!interview) throw new Error("Discovery Interview is unavailable.");
    return interview;
  };

  const service: ProjectInterviewer["interviews"] = {
    get,
    async start(actor, roomId) {
      const client = requireClient(actor);
      const started = record(
        await transport.mutation(references.interviews.start, {
          roomId,
          sessionHash: client.sessionId,
        }),
      );
      const interviewId = stringValue(started.interviewId, "interview id");
      if (typeof started.operationId === "string") {
        await startWorkflow(
          "interview_planning",
          roomId,
          interviewId,
          started.operationId,
          client.sessionId,
        );
      }
      return wait(client, roomId);
    },
    async heartbeat(actor, roomId) {
      if (actor.kind !== "client") return 0;
      return numberValue(
        await transport.mutation(references.interviews.heartbeat, {
          roomId,
          sessionHash: actor.sessionId,
        }),
        "lease version",
      );
    },
    async takeover(actor, roomId, input) {
      const client = requireClient(actor);
      await transport.mutation(references.interviews.takeover, {
        roomId,
        sessionHash: client.sessionId,
        ...input,
      });
      return requireCurrent(client, roomId);
    },
    async submitAnswer(actor, roomId, input) {
      const client = requireClient(actor);
      const started = record(
        await transport.mutation(references.interviews.acceptTurn, {
          roomId,
          sessionHash: client.sessionId,
          questionId: input.questionId,
          answer: input.answer,
          answerKind: "answer",
          idempotencyKey: input.idempotencyKey,
          ...(input.contextPackRevisionId
            ? { contextPackRevisionId: input.contextPackRevisionId }
            : {}),
        }),
      );
      if (typeof started.operationId === "string") {
        await startWorkflow(
          "interview_turn",
          roomId,
          stringValue(started.interviewId, "interview id"),
          started.operationId,
          client.sessionId,
        );
      }
      return wait(client, roomId);
    },
    async skip(actor, roomId, input) {
      const client = requireClient(actor);
      const started = record(
        await transport.mutation(references.interviews.acceptTurn, {
          roomId,
          sessionHash: client.sessionId,
          questionId: input.questionId,
          answer: "",
          answerKind: "skip",
          idempotencyKey: input.idempotencyKey,
          ...(input.contextPackRevisionId
            ? { contextPackRevisionId: input.contextPackRevisionId }
            : {}),
        }),
      );
      if (typeof started.operationId === "string") {
        await startWorkflow(
          "interview_turn",
          roomId,
          stringValue(started.interviewId, "interview id"),
          started.operationId,
          client.sessionId,
        );
      }
      return wait(client, roomId);
    },
    async retryPending(actor, roomId) {
      const client = requireClient(actor);
      const result = record(
        await transport.mutation(references.interviews.retry, {
          roomId,
          sessionHash: client.sessionId,
        }),
      );
      await startWorkflow(
        stringValue(result.operationType, "operation type"),
        roomId,
        stringValue(result.interviewId, "interview id"),
        stringValue(result.operationId, "operation id"),
        client.sessionId,
      );
      return wait(client, roomId);
    },
    async pause(actor, roomId) {
      const client = requireClient(actor);
      await transport.mutation(references.interviews.setStatus, {
        roomId,
        sessionHash: client.sessionId,
        status: "paused",
      });
      return requireCurrent(client, roomId);
    },
    async resume(actor, roomId) {
      const client = requireClient(actor);
      await transport.mutation(references.interviews.setStatus, {
        roomId,
        sessionHash: client.sessionId,
        status: "active",
      });
      return requireCurrent(client, roomId);
    },
    async finishEarly(actor, roomId, input) {
      const client = requireClient(actor);
      await transport.mutation(references.interviews.finishEarly, {
        roomId,
        sessionHash: client.sessionId,
        ...input,
      });
      return requireCurrent(client, roomId);
    },
    async correct(actor, roomId, input) {
      const client = requireClient(actor);
      await transport.mutation(references.interviews.correct, {
        roomId,
        sessionHash: client.sessionId,
        ...input,
      });
      return requireCurrent(client, roomId);
    },
    async confirmCompletion(actor, roomId, input) {
      const client = requireClient(actor);
      await transport.mutation(references.interviews.confirmCompletion, {
        roomId,
        sessionHash: client.sessionId,
        ...input,
      });
      return requireCurrent(client, roomId);
    },
    recordMaterialAdded() {
      // The Convex file-analysis commit records this event atomically.
    },
  };
  return service;
};
