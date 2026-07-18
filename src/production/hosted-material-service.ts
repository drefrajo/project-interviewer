import type { ProjectInterviewer, RoomActor } from "../domain/project-interviewer";
import type {
  ProjectMaterialView,
  SourceLocator,
} from "../domain/project-material";
import { decodeSourceLocator } from "../application/staged-material-retrieval";
import {
  analysisFeedbackSchema,
  contextPackRevisionSchema,
  projectMaterialViewSchema,
} from "./hosted-dto-schemas";
import {
  actorArguments,
  actorValue,
  record,
  references,
  stringValue,
  type HostedConvexTransport,
} from "./hosted-contract";
import { pollUntil } from "./poll-until";

export const createHostedMaterialServices = (
  transport: HostedConvexTransport,
  pendingUploads: Map<
    string,
    { materialId: string; operationId: string }
  >,
): Pick<ProjectInterviewer, "materials" | "contextPacks" | "retrieval"> => {
  const listMaterials = async (
    actor: RoomActor,
    roomId: string,
  ): Promise<ProjectMaterialView[]> => {
    const result = await transport.query(
      actor.kind === "client"
        ? references.materials.listClient
        : references.materials.listFreelancer,
      { roomId, ...actorArguments(actor) },
    );
    if (!Array.isArray(result)) {
      throw new Error("The hosted backend returned invalid materials.");
    }
    return result.map((value) => projectMaterialViewSchema.parse(value));
  };

  const waitForMaterial = async (
    actor: RoomActor,
    roomId: string,
    materialId: string,
  ): Promise<ProjectMaterialView> => {
    const material = await pollUntil({
      attempts: 180,
      intervalMs: 500,
      load: async () =>
        (await listMaterials(actor, roomId)).find(
          ({ id }) => id === materialId,
        ),
      isComplete: (candidate) =>
        Boolean(
          candidate &&
            candidate.state !== "accepted" &&
            candidate.state !== "processing",
        ),
    });
    if (!material) throw new Error("Project Material is unavailable.");
    return material;
  };

  const startFileOperation = async (
    actor: RoomActor,
    roomId: string,
    materialId: string,
    operationId: string,
  ) => {
    await transport.mutation(references.workflows.startFile, {
      roomId,
      materialId,
      operationId,
      ...actorArguments(actor),
    });
    return waitForMaterial(actor, roomId, materialId);
  };

  return {
    materials: {
      async accept(
        actor: RoomActor,
        roomId: string,
        input: { fileReference: string },
      ) {
        const pending = pendingUploads.get(input.fileReference);
        if (!pending) {
          throw new Error("The hosted upload reference is invalid.");
        }
        const material = (await listMaterials(actor, roomId)).find(
          ({ id }) => id === pending.materialId,
        );
        if (!material) throw new Error("Uploaded Project Material is missing.");
        return material;
      },
      async process(
        actor: RoomActor,
        roomId: string,
        materialId: string,
      ) {
        const pending = [...pendingUploads.values()].find(
          (item) => item.materialId === materialId,
        );
        if (!pending) {
          return waitForMaterial(actor, roomId, materialId);
        }
        return startFileOperation(
          actor,
          roomId,
          materialId,
          pending.operationId,
        );
      },
      async retry(
        actor: RoomActor,
        roomId: string,
        materialId: string,
      ) {
        const started = record(
          await transport.mutation(references.operations.begin, {
            roomId,
            operationType: "file_processing",
            subjectId: materialId,
            idempotencyKey: `file_processing:${materialId}:retry`,
            schemaVersion: "1",
            promptVersion: "software-project-file-analysis-v1",
            ...actorArguments(actor),
          }),
        );
        return startFileOperation(
          actor,
          roomId,
          materialId,
          stringValue(started.operationId, "operation id"),
        );
      },
      async includeSuspectedSecrets(
        actor: RoomActor,
        roomId: string,
        materialId: string,
        input: { acknowledgedProviderDisclosure: boolean },
      ) {
        const started = record(
          await transport.mutation(references.materials.includeSecrets, {
            roomId,
            materialId,
            actor: actorValue(actor),
            ...input,
          }),
        );
        return startFileOperation(
          actor,
          roomId,
          materialId,
          stringValue(started.operationId, "operation id"),
        );
      },
      async addFeedback(
        actor: RoomActor,
        roomId: string,
        materialId: string,
        input: { explanation: string; locator: SourceLocator },
      ) {
        const value = await transport.mutation(
          references.materials.addFeedback,
          {
            roomId,
            materialId,
            actor: actorValue(actor),
            ...input,
          },
        );
        return analysisFeedbackSchema.parse(value);
      },
      list: listMaterials,
      async remove(
        actor: RoomActor,
        roomId: string,
        materialId: string,
      ) {
        return transport.mutation(references.materials.remove, {
          roomId,
          materialId,
          actor: actorValue(actor),
        });
      },
      async continueWithoutFiles(actor: RoomActor, roomId: string) {
        return transport.mutation(
          references.materials.continueWithoutFiles,
          {
            roomId,
            actor: actorValue(actor),
          },
        );
      },
    },
    contextPacks: {
      async latest(actor: RoomActor, roomId: string) {
        const result = await transport.query(
          references.materials.latestContext,
          { roomId, ...actorArguments(actor) },
        );
        if (result === null) return null;
        const item = record(result);
        return contextPackRevisionSchema.parse({
          ...item,
          id: stringValue(item.id ?? item._id, "Context Pack id"),
          roomId: stringValue(item.roomId, "Context Pack room"),
          likelyProjectType:
            typeof item.likelyProjectType === "string"
              ? item.likelyProjectType
              : null,
        });
      },
    },
    retrieval: {
      async search(
        actor: RoomActor,
        roomId: string,
        input: { query: string; limit?: number },
      ) {
        const result = await transport.query(references.search.text, {
          roomId,
          searchText: input.query,
          ...actorArguments(actor),
        });
        if (!Array.isArray(result)) return [];
        return result
          .slice(0, input.limit ?? 12)
          .flatMap((value, index) => {
            const item = record(value);
            const locator = decodeSourceLocator(item.locator);
            return locator
              ? [
                  {
                    materialId: stringValue(
                      item.materialId,
                      "material id",
                    ),
                    text: stringValue(item.text, "material excerpt"),
                    locator,
                    score: 1 - index / Math.max(1, result.length),
                  },
                ]
              : [];
          });
      },
    },
  };
};
