import type {
  GenericDataModel,
  GenericMutationCtx,
  GenericQueryCtx,
} from "convex/server";
import type { GenericId } from "convex/values";
import { assertRoomWritablePhase } from "./production_boundaries";

type ReadContext =
  | GenericQueryCtx<GenericDataModel>
  | GenericMutationCtx<GenericDataModel>;

type RoomDocument = Readonly<{
  _id: GenericId<"projectRooms">;
  freelancerId: GenericId<"freelancerProfiles">;
  title: string;
  clientLabel: string;
  projectDescription: string;
  briefLanguage: "en" | "de";
  discoveryProfileId: "software-project";
  discoveryProfileVersion: string;
  freelancerGuidance: string;
  phase:
    | "setup"
    | "discovery"
    | "freelancer_review"
    | "client_review"
    | "approved"
    | "archived";
  interviewReadiness: "waiting_for_material" | "ready";
  lastActivityAt: number;
  archivedFromPhase?:
    | "setup"
    | "discovery"
    | "freelancer_review"
    | "client_review"
    | "approved";
  deletedAt?: number;
  purgeAfter?: number;
  createdAt: number;
  updatedAt: number;
}>;

export const requireFreelancerRoom = async (
  context: ReadContext,
  roomId: GenericId<"projectRooms">,
) => {
  const identity = await context.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Authentication required.");
  }
  const room = (await context.db.get(roomId)) as RoomDocument | null;
  if (!room || room.deletedAt) {
    throw new Error("Room not found.");
  }
  const profile = (await context.db.get(room.freelancerId)) as {
    authUserId: string;
  } | null;
  if (!profile || profile.authUserId !== identity.subject) {
    throw new Error("Room access denied.");
  }
  return { kind: "freelancer" as const, room, actorId: identity.subject };
};

export const requireClientRoom = async (
  context: ReadContext,
  roomId: GenericId<"projectRooms">,
  sessionHash: string,
) => {
  const room = (await context.db.get(roomId)) as RoomDocument | null;
  if (!room || room.deletedAt) {
    throw new Error("Room not found.");
  }
  const session = await context.db
    .query("clientSessions")
    .withIndex("by_session_hash", (query) =>
      query.eq("sessionHash", sessionHash),
    )
    .unique();
  if (!session || !session.active || session.roomId !== roomId) {
    throw new Error("Room access denied.");
  }
  const capability = await context.db
    .query("inviteCapabilities")
    .withIndex("by_room", (query) => query.eq("roomId", roomId))
    .collect()
    .then((items) =>
      items.find((item) => item.version === session.inviteVersion),
    );
  if (!capability || capability.status !== "active") {
    throw new Error("Client session revoked.");
  }
  return {
    kind: "client" as const,
    room,
    actorId: sessionHash,
    session,
  };
};

export const requireRoomActor = (
  context: ReadContext,
  roomId: GenericId<"projectRooms">,
  actor:
    | Readonly<{ kind: "freelancer" }>
    | Readonly<{ kind: "client"; sessionHash: string }>,
) =>
  actor.kind === "client"
    ? requireClientRoom(context, roomId, actor.sessionHash)
    : requireFreelancerRoom(context, roomId);

export const requireRoomActorFromSession = (
  context: ReadContext,
  roomId: GenericId<"projectRooms">,
  sessionHash?: string,
) =>
  requireRoomActor(
    context,
    roomId,
    sessionHash
      ? { kind: "client", sessionHash }
      : { kind: "freelancer" },
  );

const requireWritable = <
  Authorized extends { room: RoomDocument },
>(
  authorized: Authorized,
): Authorized => {
  assertRoomWritablePhase(authorized.room.phase);
  return authorized;
};

export const requireWritableFreelancerRoom = async (
  context: ReadContext,
  roomId: GenericId<"projectRooms">,
) => requireWritable(await requireFreelancerRoom(context, roomId));

export const requireWritableClientRoom = async (
  context: ReadContext,
  roomId: GenericId<"projectRooms">,
  sessionHash: string,
) => requireWritable(await requireClientRoom(context, roomId, sessionHash));

export const requireWritableRoomActor = async (
  context: ReadContext,
  roomId: GenericId<"projectRooms">,
  actor:
    | Readonly<{ kind: "freelancer" }>
    | Readonly<{ kind: "client"; sessionHash: string }>,
) =>
  requireWritable(
    await requireRoomActor(context, roomId, actor),
  );

export const requireWritableRoomActorFromSession = async (
  context: ReadContext,
  roomId: GenericId<"projectRooms">,
  sessionHash?: string,
) =>
  requireWritable(
    await requireRoomActorFromSession(context, roomId, sessionHash),
  );
