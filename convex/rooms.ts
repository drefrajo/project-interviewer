import {
  mutationGeneric,
  queryGeneric,
} from "convex/server";
import { v, type GenericId } from "convex/values";
import {
  requireClientRoom,
  requireFreelancerRoom,
} from "./lib/server_authorization";
import { enforceRateLimit } from "./lib/rate_limit";
import { clientRoomDto } from "./lib/public_dtos";
import { recordAudit } from "./lib/audit";

const languageValidator = v.union(v.literal("en"), v.literal("de"));

const roomView = async (
  context: Parameters<typeof requireFreelancerRoom>[0],
  room: Readonly<Record<string, unknown>> & {
    _id: GenericId<"projectRooms">;
    freelancerId: GenericId<"freelancerProfiles">;
  },
) => {
  const [profile, client] = await Promise.all([
    context.db.get(room.freelancerId),
    context.db
      .query("clientProfiles")
      .withIndex("by_room_purge", (query) => query.eq("roomId", room._id))
      .unique(),
  ]);
  return {
    id: room._id,
    title: room.title,
    clientLabel: room.clientLabel,
    projectDescription: room.projectDescription,
    briefLanguage: room.briefLanguage,
    discoveryProfileId: room.discoveryProfileId,
    phase: room.phase,
    interviewReadiness: room.interviewReadiness,
    lastActivityAt: room.lastActivityAt,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    freelancerDisplayName: profile?.displayName ?? "Freelancer",
    ...(client
      ? {
          client: {
            displayName: client.displayName,
            interviewLanguage: client.interviewLanguage,
            acknowledgedAt: client.acknowledgedAt,
          },
        }
      : {}),
  };
};

export const ensureFreelancerProfile = mutationGeneric({
  args: { displayName: v.string() },
  handler: async (context, args) => {
    const identity = await context.auth.getUserIdentity();
    if (!identity) throw new Error("Authentication required.");
    const existing = await context.db
      .query("freelancerProfiles")
      .withIndex("by_auth_user", (query) =>
        query.eq("authUserId", identity.subject),
      )
      .unique();
    if (existing) return existing._id;
    const displayName = args.displayName.trim();
    if (!displayName) throw new Error("A Freelancer display name is required.");
    const now = Date.now();
    return context.db.insert("freelancerProfiles", {
      authUserId: identity.subject,
      displayName,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const create = mutationGeneric({
  args: {
    title: v.string(),
    clientLabel: v.string(),
    projectDescription: v.string(),
    briefLanguage: languageValidator,
    freelancerGuidance: v.string(),
  },
  handler: async (context, args) => {
    const identity = await context.auth.getUserIdentity();
    if (!identity) throw new Error("Authentication required.");
    const profile = await context.db
      .query("freelancerProfiles")
      .withIndex("by_auth_user", (query) =>
        query.eq("authUserId", identity.subject),
      )
      .unique();
    if (!profile) throw new Error("Freelancer profile is missing.");
    if (
      !args.title.trim() ||
      !args.clientLabel.trim() ||
      !args.projectDescription.trim()
    ) {
      throw new Error(
        "Title, Client label, and Project Description are required.",
      );
    }
    const now = Date.now();
    const roomId = await context.db.insert("projectRooms", {
      freelancerId: profile._id,
      title: args.title.trim(),
      clientLabel: args.clientLabel.trim(),
      projectDescription: args.projectDescription.trim(),
      briefLanguage: args.briefLanguage,
      discoveryProfileId: "software-project",
      discoveryProfileVersion: "software-project-v1",
      freelancerGuidance: args.freelancerGuidance.trim(),
      phase: "setup",
      interviewReadiness: "waiting_for_material",
      lastActivityAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await recordAudit(context, {
      roomId,
      actorKind: "freelancer",
      actorId: identity.subject,
      action: "project_room.created",
      now,
    });
    return roomId;
  },
});

export const getForFreelancer = queryGeneric({
  args: { roomId: v.id("projectRooms") },
  handler: async (context, args) => {
    const { room } = await requireFreelancerRoom(context, args.roomId);
    return roomView(context, room);
  },
});

export const getForClient = queryGeneric({
  args: {
    roomId: v.id("projectRooms"),
    sessionHash: v.string(),
  },
  handler: async (context, args) => {
    const { room } = await requireClientRoom(
      context,
      args.roomId,
      args.sessionHash,
    );
    return {
      ...clientRoomDto(room),
      ...(await roomView(context, room)),
    };
  },
});

export const listForFreelancer = queryGeneric({
  args: {},
  handler: async (context) => {
    const identity = await context.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required.");
    }
    const profile = await context.db
      .query("freelancerProfiles")
      .withIndex("by_auth_user", (query) =>
        query.eq("authUserId", identity.subject),
      )
      .unique();
    if (!profile) {
      return [];
    }
    const rooms = await context.db
      .query("projectRooms")
      .withIndex("by_freelancer", (query) =>
        query.eq(
          "freelancerId",
          profile._id as GenericId<"freelancerProfiles">,
        ),
      )
      .order("desc")
      .collect();
    return Promise.all(
      rooms
        .filter((room) => room.deletedAt === undefined)
        .map(async (room) => ({
          ...room,
          ...(await roomView(context, room)),
        })),
    );
  },
});

export const listRecentlyDeleted = queryGeneric({
  args: {},
  handler: async (context) => {
    const identity = await context.auth.getUserIdentity();
    if (!identity) throw new Error("Authentication required.");
    const profile = await context.db
      .query("freelancerProfiles")
      .withIndex("by_auth_user", (query) =>
        query.eq("authUserId", identity.subject),
      )
      .unique();
    if (!profile) return [];
    const rooms = await context.db
      .query("projectRooms")
      .withIndex("by_freelancer", (query) =>
        query.eq("freelancerId", profile._id),
      )
      .order("desc")
      .collect();
    return Promise.all(
      rooms
        .filter(
          (room) =>
            room.deletedAt !== undefined &&
            room.purgeAfter !== undefined,
        )
        .map(async (room) => ({
          ...(await roomView(context, room)),
          deletedAt: room.deletedAt!,
          purgeAfter: room.purgeAfter!,
        })),
    );
  },
});

export const onboardClient = mutationGeneric({
  args: {
    roomId: v.id("projectRooms"),
    sessionHash: v.string(),
    displayName: v.string(),
    interviewLanguage: languageValidator,
    acknowledgedDisclosure: v.boolean(),
  },
  handler: async (context, args) => {
    const authorized = await requireClientRoom(
      context,
      args.roomId,
      args.sessionHash,
    );
    const { room } = authorized;
    await enforceRateLimit(context, {
      roomId: args.roomId,
      scope: "client_onboarding",
      key: `${args.roomId}:${String(authorized.session.deviceHash)}`,
      limit: 10,
      windowMs: 60 * 60 * 1000,
    });
    if (!args.displayName.trim() || !args.acknowledgedDisclosure) {
      throw new Error(
        "Display name and the processing acknowledgement are required.",
      );
    }
    const existing = await context.db
      .query("clientProfiles")
      .withIndex("by_room_purge", (query) => query.eq("roomId", args.roomId))
      .unique();
    if (existing) throw new Error("Client onboarding is already complete.");
    const now = Date.now();
    await context.db.insert("clientProfiles", {
      roomId: args.roomId,
      displayName: args.displayName.trim(),
      interviewLanguage: args.interviewLanguage,
      acknowledgedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    if (room.phase !== "archived") {
      await context.db.patch(args.roomId, {
        phase: "discovery",
        lastActivityAt: now,
        updatedAt: now,
      });
    }
    await recordAudit(context, {
      roomId: args.roomId,
      actorKind: "client",
      actorId: authorized.actorId,
      deviceHash: authorized.session.deviceHash,
      action: "client.onboarded",
      now,
    });
    return roomView(context, {
      ...room,
      phase: room.phase === "archived" ? room.phase : "discovery",
      lastActivityAt: now,
      updatedAt: now,
    });
  },
});

export const touchClientSession = mutationGeneric({
  args: {
    roomId: v.id("projectRooms"),
    sessionHash: v.string(),
  },
  handler: async (context, args) => {
    const { session } = await requireClientRoom(
      context,
      args.roomId,
      args.sessionHash,
    );
    await context.db.patch(
      session._id as GenericId<"clientSessions">,
      { lastSeenAt: Date.now() },
    );
  },
});
