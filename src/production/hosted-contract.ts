import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";
import { api } from "../../convex/typed_api";
import type {
  FreelancerActor,
  ProjectNextAction,
  ProjectPhase,
  ProjectRoom,
  ProjectRoomView,
  RoomActor,
  SharedResource,
} from "../domain/project-interviewer";
import { projectNextActionFor } from "../domain/project-interviewer";

type PublicQuery = FunctionReference<"query", "public">;
export type PublicMutation = FunctionReference<"mutation", "public">;
type PublicAction = FunctionReference<"action", "public">;
export type WireValue<Value> = Value extends string & {
  __tableName: string;
}
  ? string
  : Value extends readonly (infer Item)[]
    ? WireValue<Item>[]
    : Value extends Record<string, unknown>
      ? { [Key in keyof Value]: WireValue<Value[Key]> }
      : Value;

export interface HostedConvexTransport {
  query<Reference extends PublicQuery>(
    reference: Reference,
    args: WireValue<FunctionArgs<Reference>>,
  ): Promise<FunctionReturnType<Reference>>;
  mutation<Reference extends PublicMutation>(
    reference: Reference,
    args: WireValue<FunctionArgs<Reference>>,
  ): Promise<FunctionReturnType<Reference>>;
  action<Reference extends PublicAction>(
    reference: Reference,
    args: WireValue<FunctionArgs<Reference>>,
  ): Promise<FunctionReturnType<Reference>>;
}

export interface HostedCryptography {
  randomToken(): string;
  hash(value: string): Promise<string>;
}

export const references = {
  auth: {
    getProviderAvailability: api.auth.getProviderAvailability,
  },
  rooms: {
    ensureProfile: api.rooms.ensureFreelancerProfile,
    create: api.rooms.create,
    getFreelancer: api.rooms.getForFreelancer,
    getClient: api.rooms.getForClient,
    list: api.rooms.listForFreelancer,
    listDeleted: api.rooms.listRecentlyDeleted,
    onboard: api.rooms.onboardClient,
  },
  invites: {
    create: api["invite_actions"].createCapability,
    get: api["invite_actions"].getCapability,
    exchange: api.invites.exchangeCapabilityHash,
    revoke: api.invites.revokeCapability,
  },
  home: {
    listResources: api["project_home"].listResources,
    createResource: api["project_home"].createResource,
    updateResource: api["project_home"].updateResource,
    reorderResources: api["project_home"].reorderResources,
    removeResource: api["project_home"].removeResource,
    archive: api["project_home"].archiveRoom,
    restore: api["project_home"].restoreRoom,
    reopen: api["project_home"].reopenDiscovery,
    delete: api.deletion.scheduleRoomDeletion,
    recover: api.deletion.recoverRoom,
  },
  materials: {
    requestUpload: api.materials.requestUpload,
    commitUpload: api.materials.commitUpload,
    listFreelancer: api.materials.listForFreelancer,
    listClient: api.materials.listForClient,
    addFeedback: api.materials.addFeedback,
    remove: api.materials.remove,
    continueWithoutFiles: api.materials.continueWithoutFiles,
    latestContext: api.materials.latestContext,
  },
  operations: {
    begin: api.operations.begin,
  },
  workflows: {
    startFile: api.workflows.startFileAnalysis,
    startInterviewPlanning: api.workflows.startInterviewPlanning,
    startInterviewTurn: api.workflows.startInterviewTurn,
    startInterviewReview: api.workflows.startInterviewReview,
  },
  interviews: {
    get: api.interviews.get,
    start: api.interviews.start,
    heartbeat: api.interviews.heartbeat,
    takeover: api.interviews.takeover,
    acceptTurn: api.interviews.acceptTurn,
    setStatus: api.interviews.setStatus,
    finishEarly: api.interviews.finishEarly,
    correct: api.interviews.correct,
    confirmCompletion: api.interviews.confirmCompletion,
    retry: api.interviews.retry,
    beginReview: api.interviews.beginReview,
  },
  briefs: {
    get: api.briefs.get,
    beginGeneration: api.briefs.beginGeneration,
    updateMarkdown: api.briefs.updateMarkdown,
    updateSection: api.briefs.updateSection,
    addItem: api.briefs.addItem,
    updateItem: api.briefs.updateItem,
    moveItem: api.briefs.moveItem,
    removeItem: api.briefs.removeItem,
    resolveWarning: api.briefs.resolveWarning,
    sendForReview: api.briefs.sendForReview,
    submitChangeRequest: api.briefs.submitChangeRequest,
    acknowledgeChangeRequest: api.briefs.acknowledgeChangeRequest,
    approve: api.briefs.approve,
    reopen: api.briefs.reopen,
    exportMarkdown: api.briefs.exportMarkdown,
    inspectSource: api.briefs.inspectSource,
  },
  briefWorkflow: {
    start: api.workflows.startBriefGeneration,
  },
  search: {
    text: api.search.text,
  },
} as const;

export const browserCryptography: HostedCryptography = {
  randomToken: () => {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
  },
  hash: async (value) =>
    Array.from(
      new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(value),
        ),
      ),
      (byte) => byte.toString(16).padStart(2, "0"),
    ).join(""),
};

export const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The hosted backend returned an invalid record.");
  }
  return value as Record<string, unknown>;
};

export const stringValue = (value: unknown, label: string): string => {
  if (typeof value !== "string") {
    throw new Error(`The hosted backend returned an invalid ${label}.`);
  }
  return value;
};

export const numberValue = (value: unknown, label: string): number => {
  if (typeof value !== "number") {
    throw new Error(`The hosted backend returned an invalid ${label}.`);
  }
  return value;
};

export const roomView = (value: unknown): ProjectRoomView => {
  const item = record(value);
  return {
    id: stringValue(item.id ?? item._id, "room id"),
    title: stringValue(item.title, "room title"),
    clientLabel: stringValue(item.clientLabel, "client label"),
    projectDescription: stringValue(
      item.projectDescription,
      "project description",
    ),
    briefLanguage: item.briefLanguage === "de" ? "de" : "en",
    discoveryProfileId: "software-project",
    phase: item.phase as ProjectPhase,
    interviewReadiness:
      item.interviewReadiness === "ready"
        ? "ready"
        : "waiting_for_material",
    lastActivityAt: numberValue(item.lastActivityAt, "last activity"),
    createdAt: numberValue(item.createdAt, "created time"),
    updatedAt: numberValue(item.updatedAt, "updated time"),
    freelancerDisplayName:
      typeof item.freelancerDisplayName === "string"
        ? item.freelancerDisplayName
        : "Freelancer",
    ...(item.client && typeof item.client === "object"
      ? {
          client: item.client as NonNullable<ProjectRoomView["client"]>,
        }
      : {}),
  };
};

export const roomRecord = (
  value: unknown,
): ProjectRoom & { nextAction: ProjectNextAction } => {
  const item = record(value);
  const view = roomView(item);
  return {
    ...view,
    freelancerId:
      typeof item.freelancerId === "string"
        ? item.freelancerId
        : "authenticated",
    freelancerGuidance:
      typeof item.freelancerGuidance === "string"
        ? item.freelancerGuidance
        : "",
    ...(typeof item.archivedFromPhase === "string"
      ? {
          archivedFromPhase:
            item.archivedFromPhase as Exclude<
              ProjectRoom["archivedFromPhase"],
              undefined
            >,
        }
      : {}),
    invite: {
      tokenHash: "server-managed",
      status: "active",
      version: 0,
    },
    nextAction: projectNextActionFor(view.phase, "freelancer"),
  };
};

export const resource = (value: unknown): SharedResource => {
  const item = record(value);
  return {
    id: stringValue(item.id ?? item._id, "resource id"),
    roomId: stringValue(item.roomId, "resource room"),
    label: stringValue(item.label, "resource label"),
    ...(typeof item.url === "string" ? { url: item.url } : {}),
    ...(typeof item.note === "string" ? { note: item.note } : {}),
    ...(typeof item.accountIdentifier === "string"
      ? { accountIdentifier: item.accountIdentifier }
      : {}),
    order: numberValue(item.order, "resource order"),
    createdAt: numberValue(item.createdAt, "resource created time"),
    updatedAt: numberValue(item.updatedAt, "resource updated time"),
  };
};

export const actorArguments = (actor: RoomActor) =>
  actor.kind === "client" ? { sessionHash: actor.sessionId } : {};

export const actorValue = (actor: RoomActor) =>
  actor.kind === "client"
    ? { kind: "client" as const, sessionHash: actor.sessionId }
    : { kind: "freelancer" as const };

export const authenticatedFreelancer = (): FreelancerActor => ({
  kind: "freelancer",
  freelancerId: "authenticated",
  sessionId: "better-auth",
});
