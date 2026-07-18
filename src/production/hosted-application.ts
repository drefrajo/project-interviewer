import type {
  ClientActor,
  FreelancerActor,
  ProjectInterviewer,
  ProjectPhase,
  ProjectRoomView,
  RoomActor,
} from "../domain/project-interviewer";
import { projectNextActionFor } from "../domain/project-interviewer";
import {
  actorArguments,
  authenticatedFreelancer,
  browserCryptography,
  numberValue,
  record,
  references,
  resource,
  roomRecord,
  roomView,
  stringValue,
  type HostedConvexTransport,
  type HostedCryptography,
} from "./hosted-contract";
import { createHostedMaterialServices } from "./hosted-material-service";
import { createHostedInterviewService } from "./hosted-interview-service";
import { createHostedBriefService } from "./hosted-brief-service";
export type { HostedConvexTransport } from "./hosted-contract";

export const createHostedApplication = (
  transport: HostedConvexTransport,
  cryptography: HostedCryptography = browserCryptography,
  pendingUploads: Map<
    string,
    { materialId: string; operationId: string }
  > = new Map(),
): ProjectInterviewer => {
  const getRoom = async (
    actor: RoomActor,
    roomId: string,
  ): Promise<ProjectRoomView> =>
    roomView(
      await transport.query(
        actor.kind === "client"
          ? references.rooms.getClient
          : references.rooms.getFreelancer,
        { roomId, ...actorArguments(actor) },
      ),
    );

  const home = {
    resources: {
      list: async (actor: RoomActor, roomId: string) => {
        const result = await transport.query(
          references.home.listResources,
          { roomId, ...actorArguments(actor) },
        );
        if (!Array.isArray(result)) {
          throw new Error("The hosted backend returned invalid resources.");
        }
        return result.map(resource);
      },
      create: async (
        _actor: RoomActor,
        roomId: string,
        input: {
          label: string;
          url?: string;
          note?: string;
          accountIdentifier?: string;
        },
      ) =>
        resource(
          await transport.mutation(references.home.createResource, {
            roomId,
            ...input,
          }),
        ),
      update: async (
        _actor: RoomActor,
        roomId: string,
        resourceId: string,
        input: {
          label: string;
          url?: string;
          note?: string;
          accountIdentifier?: string;
        },
      ) =>
        resource(
          await transport.mutation(references.home.updateResource, {
            roomId,
            resourceId,
            ...input,
          }),
        ),
      reorder: async (
        _actor: RoomActor,
        roomId: string,
        resourceIds: string[],
      ) => {
        const result = await transport.mutation(
          references.home.reorderResources,
          { roomId, resourceIds },
        );
        if (!Array.isArray(result)) {
          throw new Error("The hosted backend returned invalid resources.");
        }
        return result.map(resource);
      },
      remove: async (
        _actor: RoomActor,
        roomId: string,
        resourceId: string,
      ) => {
        await transport.mutation(references.home.removeResource, {
          roomId,
          resourceId,
        });
      },
    },
  };

  const materialServices = createHostedMaterialServices(
    transport,
    pendingUploads,
  );

  const interviewService = createHostedInterviewService(transport);

  const briefService = createHostedBriefService(transport);

  const partial = {
    identities: {
      async establishFreelancer(input: {
        displayName: string;
      }): Promise<FreelancerActor> {
        await transport.mutation(references.rooms.ensureProfile, input);
        return authenticatedFreelancer();
      },
      async resumeFreelancer(): Promise<FreelancerActor> {
        return authenticatedFreelancer();
      },
    },
    rooms: {
      async create(
        _actor: FreelancerActor,
        input: {
          title: string;
          clientLabel: string;
          projectDescription: string;
          briefLanguage: "en" | "de";
          freelancerGuidance: string;
        },
      ) {
        const roomId = stringValue(
          await transport.mutation(references.rooms.create, input),
          "room id",
        );
        const capability = record(
          await transport.action(references.invites.create, { roomId }),
        );
        const inviteToken = stringValue(
          capability.token,
          "invite capability",
        );
        const now = Date.now();
        return {
          room: {
            id: roomId,
            freelancerId: "authenticated",
            title: input.title.trim(),
            clientLabel: input.clientLabel.trim(),
            projectDescription: input.projectDescription.trim(),
            briefLanguage: input.briefLanguage,
            discoveryProfileId: "software-project" as const,
            freelancerGuidance: input.freelancerGuidance.trim(),
            phase: "setup" as const,
            interviewReadiness: "waiting_for_material" as const,
            lastActivityAt: now,
            createdAt: now,
            updatedAt: now,
            invite: {
              tokenHash: "server-managed",
              status: "active" as const,
              version: numberValue(capability.version, "invite version"),
            },
          },
          inviteToken,
        };
      },
      get: getRoom,
      async list(
        _actor: FreelancerActor,
        filters: { search?: string; phase?: ProjectPhase } = {},
      ) {
        const result = await transport.query(references.rooms.list, {});
        if (!Array.isArray(result)) {
          throw new Error("The hosted backend returned invalid rooms.");
        }
        const search = filters.search?.trim().toLocaleLowerCase() ?? "";
        return result
          .map(roomRecord)
          .filter((room) => !filters.phase || room.phase === filters.phase)
          .filter(
            (room) =>
              !search ||
              `${room.title} ${room.clientLabel}`
                .toLocaleLowerCase()
                .includes(search),
          );
      },
    },
    projectHome: {
      async get(actor: RoomActor, roomId: string) {
        const [room, resources, brief] = await Promise.all([
          getRoom(actor, roomId),
          home.resources.list(actor, roomId),
          briefService.get(actor, roomId),
        ]);
        return {
          room,
          readOnly: room.phase === "archived" && actor.kind === "client",
          nextAction: projectNextActionFor(room.phase, actor.kind),
          resources,
          approvedVersions: brief.reviewVersions.filter(
            ({ status }) => status === "approved",
          ),
        };
      },
      resources: home.resources,
      lifecycle: {
        archive: async (actor: FreelancerActor, roomId: string) => {
          await transport.mutation(references.home.archive, { roomId });
          return getRoom(actor, roomId);
        },
        restoreArchived: async (
          actor: FreelancerActor,
          roomId: string,
        ) => {
          await transport.mutation(references.home.restore, { roomId });
          return getRoom(actor, roomId);
        },
        delete: async (_actor: FreelancerActor, roomId: string) =>
          record(
            await transport.mutation(references.home.delete, { roomId }),
          ) as unknown as {
            roomId: string;
            deletedAt: number;
            purgeAfter: number;
          },
        listRecentlyDeleted: async (actor: FreelancerActor) => {
          void actor;
          const result = await transport.query(
            references.rooms.listDeleted,
            {},
          );
          if (!Array.isArray(result)) {
            throw new Error(
              "The hosted backend returned invalid deleted rooms.",
            );
          }
          return result.map((item) => {
            const source = record(item);
            return {
              ...roomView(source),
              deletedAt: numberValue(source.deletedAt, "deleted time"),
              purgeAfter: numberValue(source.purgeAfter, "purge time"),
            };
          });
        },
        recover: async (actor: FreelancerActor, roomId: string) => {
          await transport.mutation(references.home.recover, { roomId });
          return getRoom(actor, roomId);
        },
        reopenDiscovery: async (
          _actor: FreelancerActor,
          roomId: string,
        ) => {
          await transport.mutation(references.home.reopen, { roomId });
        },
        purgeExpired: async () => [],
      },
    },
    clientAccess: {
      async resolveInvite(
        inviteToken: string,
        input: { deviceId?: string },
      ) {
        const deviceId = input.deviceId ?? cryptography.randomToken();
        const sessionHash = await cryptography.hash(
          cryptography.randomToken(),
        );
        const result = record(
          await transport.mutation(references.invites.exchange, {
            tokenHash: await cryptography.hash(inviteToken),
            sessionHash,
            deviceHash: await cryptography.hash(deviceId),
          }),
        );
        const roomId = stringValue(result.roomId, "room id");
        const inviteVersion = numberValue(
          result.inviteVersion,
          "invite version",
        );
        const actor: ClientActor = {
          kind: "client",
          roomId,
          deviceId,
          inviteVersion,
          sessionId: sessionHash,
        };
        const room = await getRoom(actor, roomId);
        return {
          actor,
          room,
          onboardingRequired: !room.client,
          ...(room.client ? { client: room.client } : {}),
        };
      },
      async onboard(
        actor: ClientActor,
        input: {
          displayName: string;
          interviewLanguage: "en" | "de";
          acknowledgedDisclosure: boolean;
        },
      ) {
        return roomView(
          await transport.mutation(references.rooms.onboard, {
            roomId: actor.roomId,
            sessionHash: actor.sessionId,
            ...input,
          }),
        );
      },
      async rotateInvite(
        _actor: FreelancerActor,
        roomId: string,
      ) {
        const result = record(
          await transport.action(references.invites.create, { roomId }),
        );
        return {
          inviteToken: stringValue(result.token, "invite capability"),
          inviteVersion: numberValue(result.version, "invite version"),
        };
      },
      async revokeInvite(
        _actor: FreelancerActor,
        roomId: string,
      ) {
        await transport.mutation(references.invites.revoke, { roomId });
      },
    },
    materials: materialServices.materials,
    contextPacks: materialServices.contextPacks,
    retrieval: materialServices.retrieval,
    interviews: interviewService,
    briefs: briefService,
    inspectState() {
      throw new Error(
        "Hosted state is only available through authorized Convex queries.",
      );
    },
  };

  return partial satisfies ProjectInterviewer;
};
