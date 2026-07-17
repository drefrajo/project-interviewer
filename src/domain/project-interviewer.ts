export type Language = "en" | "de";

export type ProjectPhase =
  | "setup"
  | "discovery"
  | "freelancer_review"
  | "client_review"
  | "approved"
  | "archived";

export interface FreelancerActor {
  kind: "freelancer";
  freelancerId: string;
  sessionId: string;
}

export interface ClientActor {
  kind: "client";
  roomId: string;
  deviceId: string;
  inviteVersion: number;
  sessionId: string;
}

export type RoomActor = FreelancerActor | ClientActor;

export interface ProjectRoom {
  id: string;
  freelancerId: string;
  title: string;
  clientLabel: string;
  projectDescription: string;
  briefLanguage: Language;
  discoveryProfileId: "software-project";
  freelancerGuidance: string;
  phase: ProjectPhase;
  interviewReadiness: "waiting_for_material" | "ready";
  createdAt: number;
  updatedAt: number;
  invite: {
    tokenHash: string;
    status: "active" | "revoked";
    version: number;
  };
  client?: {
    displayName: string;
    interviewLanguage: Language;
    acknowledgedAt: number;
  };
}

export type ProjectRoomView = Pick<
  ProjectRoom,
  | "id"
  | "title"
  | "clientLabel"
  | "projectDescription"
  | "briefLanguage"
  | "discoveryProfileId"
  | "phase"
  | "interviewReadiness"
  | "createdAt"
  | "updatedAt"
  | "client"
> & { freelancerDisplayName: string };

export interface AuditEvent {
  id: string;
  roomId: string;
  actorKind: RoomActor["kind"];
  deviceId?: string;
  action: string;
  createdAt: number;
}

interface FreelancerIdentity {
  id: string;
  displayName: string;
  createdAt: number;
}

export interface ProjectInterviewerSnapshot {
  freelancers: FreelancerIdentity[];
  rooms: ProjectRoom[];
  auditEvents: AuditEvent[];
}

export interface ProjectInterviewerDependencies {
  ids: {
    next(prefix: string): string;
    inviteToken(): string;
    deviceId(): string;
  };
  clock: {
    now(): number;
  };
  inviteTokens: {
    hash(token: string): Promise<string>;
  };
  initialState?: ProjectInterviewerSnapshot;
  persist?: (snapshot: ProjectInterviewerSnapshot) => void;
}

export interface CreateProjectRoomInput {
  title: string;
  clientLabel: string;
  projectDescription: string;
  briefLanguage: Language;
  freelancerGuidance: string;
}

export class AuthorizationError extends Error {
  constructor(message = "You do not have access to this Project Room.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

const copy = <T>(value: T): T => structuredClone(value);

export const createProjectInterviewer = (
  dependencies: ProjectInterviewerDependencies,
) => {
  const state: ProjectInterviewerSnapshot = copy(
    dependencies.initialState ?? {
      freelancers: [],
      rooms: [],
      auditEvents: [],
    },
  );
  const freelancerSessions = new Map<string, string>();
  const clientSessions = new Map<
    string,
    {
      roomId: string;
      deviceId: string;
      inviteVersion: number;
      tokenHash: string;
    }
  >();

  const persist = () => dependencies.persist?.(copy(state));

  const audit = (
    actor: RoomActor,
    roomId: string,
    action: string,
  ): void => {
    state.auditEvents.push({
      id: dependencies.ids.next("audit"),
      roomId,
      actorKind: actor.kind,
      ...(actor.kind === "client" ? { deviceId: actor.deviceId } : {}),
      action,
      createdAt: dependencies.clock.now(),
    });
  };

  const requireFreelancerRoom = (
    actor: FreelancerActor,
    roomId: string,
  ): ProjectRoom => {
    requireFreelancer(actor);
    const room = state.rooms.find(
      (candidate) =>
        candidate.id === roomId &&
        candidate.freelancerId === actor.freelancerId,
    );
    if (!room) {
      throw new AuthorizationError();
    }
    return room;
  };

  const requireFreelancer = (actor: FreelancerActor): void => {
    if (
      freelancerSessions.get(actor.sessionId) !== actor.freelancerId ||
      !state.freelancers.some(({ id }) => id === actor.freelancerId)
    ) {
      throw new AuthorizationError();
    }
  };

  const requireRoomActor = (actor: RoomActor, roomId: string): ProjectRoom => {
    if (actor.kind === "freelancer") {
      return requireFreelancerRoom(actor, roomId);
    }
    const session = clientSessions.get(actor.sessionId);
    const room = state.rooms.find(
      (candidate) =>
        candidate.id === roomId &&
        session?.roomId === roomId &&
        session.deviceId === actor.deviceId &&
        session.inviteVersion === actor.inviteVersion &&
        session.tokenHash === candidate.invite.tokenHash &&
        actor.roomId === roomId &&
        candidate.invite.status === "active" &&
        candidate.invite.version === actor.inviteVersion,
    );
    if (!room) {
      throw new AuthorizationError();
    }
    return room;
  };

  const findRoomByInvite = async (
    token: string,
  ): Promise<ProjectRoom | undefined> => {
    const tokenHash = await dependencies.inviteTokens.hash(token);
    return state.rooms.find(
      (room) =>
        room.invite.status === "active" &&
        room.invite.tokenHash === tokenHash,
    );
  };

  const toProjectRoomView = (room: ProjectRoom): ProjectRoomView => ({
    id: room.id,
    title: room.title,
    clientLabel: room.clientLabel,
    projectDescription: room.projectDescription,
    briefLanguage: room.briefLanguage,
    discoveryProfileId: room.discoveryProfileId,
    phase: room.phase,
    interviewReadiness: room.interviewReadiness,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    freelancerDisplayName:
      state.freelancers.find(({ id }) => id === room.freelancerId)
        ?.displayName ?? "Freelancer",
    ...(room.client ? { client: copy(room.client) } : {}),
  });

  return {
    identities: {
      async createDevelopmentFreelancer(input: {
        displayName: string;
      }): Promise<FreelancerActor> {
        const displayName = input.displayName.trim();
        if (!displayName) {
          throw new ValidationError("A Freelancer display name is required.");
        }
        const identity: FreelancerIdentity = {
          id: dependencies.ids.next("freelancer"),
          displayName,
          createdAt: dependencies.clock.now(),
        };
        state.freelancers.push(identity);
        const sessionId = dependencies.ids.next("freelancer_session");
        freelancerSessions.set(sessionId, identity.id);
        persist();
        return {
          kind: "freelancer",
          freelancerId: identity.id,
          sessionId,
        };
      },

      async resumeDevelopmentFreelancer(
        freelancerId: string,
      ): Promise<FreelancerActor> {
        if (!state.freelancers.some(({ id }) => id === freelancerId)) {
          throw new AuthorizationError();
        }
        const sessionId = dependencies.ids.next("freelancer_session");
        freelancerSessions.set(sessionId, freelancerId);
        return { kind: "freelancer", freelancerId, sessionId };
      },
    },
    rooms: {
      async create(
        actor: FreelancerActor,
        input: CreateProjectRoomInput,
      ): Promise<{ room: ProjectRoom; inviteToken: string }> {
        requireFreelancer(actor);
        const required = [
          input.title,
          input.clientLabel,
          input.projectDescription,
        ];
        if (required.some((value) => !value.trim())) {
          throw new ValidationError(
            "Title, Client label, and Project Description are required.",
          );
        }

        const inviteToken = dependencies.ids.inviteToken();
        const now = dependencies.clock.now();
        const room: ProjectRoom = {
          id: dependencies.ids.next("room"),
          freelancerId: actor.freelancerId,
          title: input.title.trim(),
          clientLabel: input.clientLabel.trim(),
          projectDescription: input.projectDescription.trim(),
          briefLanguage: input.briefLanguage,
          discoveryProfileId: "software-project",
          freelancerGuidance: input.freelancerGuidance.trim(),
          phase: "setup",
          interviewReadiness: "waiting_for_material",
          createdAt: now,
          updatedAt: now,
          invite: {
            tokenHash: await dependencies.inviteTokens.hash(inviteToken),
            status: "active",
            version: 1,
          },
        };
        state.rooms.push(room);
        audit(actor, room.id, "project_room.created");
        persist();
        return { room: copy(room), inviteToken };
      },

      async get(actor: RoomActor, roomId: string): Promise<ProjectRoomView> {
        return toProjectRoomView(requireRoomActor(actor, roomId));
      },

      async list(
        actor: FreelancerActor,
        filters: { search?: string; phase?: ProjectPhase } = {},
      ): Promise<Array<ProjectRoom & { nextAction: string }>> {
        requireFreelancer(actor);
        const search = filters.search?.trim().toLocaleLowerCase() ?? "";
        return state.rooms
          .filter((room) => room.freelancerId === actor.freelancerId)
          .filter((room) => !filters.phase || room.phase === filters.phase)
          .filter(
            (room) =>
              !search ||
              `${room.title} ${room.clientLabel}`
                .toLocaleLowerCase()
                .includes(search),
          )
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .map((room) => ({
            ...copy(room),
            nextAction: nextActionFor(room),
          }));
      },
    },
    clientAccess: {
      async resolveInvite(
        inviteToken: string,
        input: { deviceId?: string },
      ): Promise<{
        actor: ClientActor;
        room: ProjectRoomView;
        onboardingRequired: boolean;
        client?: ProjectRoom["client"];
      }> {
        const room = await findRoomByInvite(inviteToken);
        if (!room) {
          throw new AuthorizationError(
            "This Invite Link is invalid or has been revoked.",
          );
        }
        const actor: ClientActor = {
          kind: "client",
          roomId: room.id,
          deviceId: input.deviceId ?? dependencies.ids.deviceId(),
          inviteVersion: room.invite.version,
          sessionId: dependencies.ids.next("client_session"),
        };
        clientSessions.set(actor.sessionId, {
          roomId: room.id,
          deviceId: actor.deviceId,
          inviteVersion: room.invite.version,
          tokenHash: room.invite.tokenHash,
        });
        return {
          actor,
          room: toProjectRoomView(room),
          onboardingRequired: !room.client,
          ...(room.client ? { client: copy(room.client) } : {}),
        };
      },

      async onboard(
        actor: ClientActor,
        input: {
          displayName: string;
          interviewLanguage: Language;
          acknowledgedDisclosure: boolean;
        },
      ): Promise<ProjectRoomView> {
        const room = requireRoomActor(actor, actor.roomId);
        if (room.client) {
          throw new ValidationError(
            "Client onboarding is already complete for this Project Room.",
          );
        }
        if (!input.displayName.trim() || !input.acknowledgedDisclosure) {
          throw new ValidationError(
            "Display name and the processing acknowledgement are required.",
          );
        }
        room.client = {
          displayName: input.displayName.trim(),
          interviewLanguage: input.interviewLanguage,
          acknowledgedAt: dependencies.clock.now(),
        };
        room.phase = "discovery";
        room.updatedAt = dependencies.clock.now();
        audit(actor, room.id, "client.onboarded");
        persist();
        return toProjectRoomView(room);
      },

      async rotateInvite(
        actor: FreelancerActor,
        roomId: string,
      ): Promise<{ inviteToken: string; inviteVersion: number }> {
        const room = requireFreelancerRoom(actor, roomId);
        const inviteToken = dependencies.ids.inviteToken();
        room.invite = {
          tokenHash: await dependencies.inviteTokens.hash(inviteToken),
          status: "active",
          version: room.invite.version + 1,
        };
        room.updatedAt = dependencies.clock.now();
        audit(actor, room.id, "invite.rotated");
        persist();
        return {
          inviteToken,
          inviteVersion: room.invite.version,
        };
      },

      async revokeInvite(
        actor: FreelancerActor,
        roomId: string,
      ): Promise<void> {
        const room = requireFreelancerRoom(actor, roomId);
        room.invite.status = "revoked";
        room.updatedAt = dependencies.clock.now();
        audit(actor, room.id, "invite.revoked");
        persist();
      },
    },
    inspectState: (): ProjectInterviewerSnapshot => copy(state),
  };
};

const nextActionFor = (room: ProjectRoom): string => {
  const actions: Record<ProjectPhase, string> = {
    setup: "Share Invite Link",
    discovery: "Continue discovery",
    freelancer_review: "Review Brief Draft",
    client_review: "Wait for Client review",
    approved: "Open Project Home",
    archived: "Restore Project Room",
  };
  return actions[room.phase];
};

export type ProjectInterviewer = ReturnType<typeof createProjectInterviewer>;
