import {
  actionGeneric,
  internalMutationGeneric,
  internalQueryGeneric,
  makeFunctionReference,
  mutationGeneric,
} from "convex/server";
import { v, type GenericId } from "convex/values";
import { requireFreelancerRoom } from "./lib/server_authorization";
import { recordAudit } from "./lib/audit";
import { enforceRateLimit } from "./lib/rate_limit";

const createCapabilityActionReference = makeFunctionReference<
  "action",
  { roomId: GenericId<"projectRooms"> },
  { token: string; version: number }
>("invite_actions:createCapability");

const getCapabilityActionReference = makeFunctionReference<
  "action",
  { roomId: GenericId<"projectRooms"> },
  | { status: "revoked"; version: number }
  | { status: "unavailable"; version: number }
  | { status: "active"; token: string; version: number }
>("invite_actions:getCapability");

export const createCapabilityRecord = internalMutationGeneric({
  args: {
    roomId: v.id("projectRooms"),
    authUserId: v.string(),
    tokenHash: v.string(),
    tokenCiphertext: v.string(),
    tokenIv: v.string(),
  },
  handler: async (context, args) => {
    const room = await context.db.get(args.roomId);
    if (!room) {
      throw new Error("Room not found.");
    }
    const profile = await context.db.get(room.freelancerId);
    if (!profile || profile.authUserId !== args.authUserId) {
      throw new Error("Room access denied.");
    }
    const existing = await context.db
      .query("inviteCapabilities")
      .withIndex("by_room", (query) => query.eq("roomId", args.roomId))
      .collect();
    const version = Math.max(0, ...existing.map((item) => item.version)) + 1;
    const now = Date.now();
    for (const capability of existing.filter(
      (item) => item.status === "active",
    )) {
      await context.db.patch(capability._id, {
        status: "revoked",
        revokedAt: now,
        tokenCiphertext: undefined,
        tokenIv: undefined,
      });
    }
    await context.db.insert("inviteCapabilities", {
      roomId: args.roomId,
      tokenHash: args.tokenHash,
      tokenCiphertext: args.tokenCiphertext,
      tokenIv: args.tokenIv,
      version,
      status: "active",
      createdAt: now,
    });
    await recordAudit(context, {
      roomId: args.roomId,
      actorKind: "freelancer",
      actorId: args.authUserId,
      action: "client_invite.rotated",
      now,
    });
    return version;
  },
});

export const currentCapabilityRecord = internalQueryGeneric({
  args: {
    roomId: v.id("projectRooms"),
    authUserId: v.string(),
  },
  handler: async (context, args) => {
    const room = await context.db.get(args.roomId);
    if (!room || room.deletedAt) {
      throw new Error("Room not found.");
    }
    const profile = await context.db.get(room.freelancerId);
    if (!profile || profile.authUserId !== args.authUserId) {
      throw new Error("Room access denied.");
    }
    const capability = await context.db
      .query("inviteCapabilities")
      .withIndex("by_room", (query) => query.eq("roomId", args.roomId))
      .order("desc")
      .first();
    if (!capability) return null;
    return {
      status: capability.status,
      version: capability.version,
      ...(capability.tokenCiphertext
        ? { tokenCiphertext: capability.tokenCiphertext }
        : {}),
      ...(capability.tokenIv ? { tokenIv: capability.tokenIv } : {}),
    };
  },
});

/**
 * Compatibility paths for clients loaded before Invite Link cryptography moved
 * to the Node runtime. The wrappers intentionally contain no cryptography.
 */
export const createCapability = actionGeneric({
  args: { roomId: v.id("projectRooms") },
  handler: (context, args) =>
    context.runAction(createCapabilityActionReference, args),
});

export const getCapability = actionGeneric({
  args: { roomId: v.id("projectRooms") },
  handler: (context, args) =>
    context.runAction(getCapabilityActionReference, args),
});

export const exchangeCapabilityHash = mutationGeneric({
  args: {
    tokenHash: v.string(),
    sessionHash: v.string(),
    deviceHash: v.string(),
  },
  handler: async (context, args) => {
    const existingSession = await context.db
      .query("clientSessions")
      .withIndex("by_session_hash", (query) =>
        query.eq("sessionHash", args.sessionHash),
      )
      .unique();
    if (existingSession) {
      const capability = await context.db
        .query("inviteCapabilities")
        .withIndex("by_token_hash", (query) =>
          query.eq("tokenHash", args.tokenHash),
        )
        .unique();
      if (
        !capability ||
        capability.status !== "active" ||
        existingSession.roomId !== capability.roomId ||
        existingSession.inviteVersion !== capability.version ||
        existingSession.deviceHash !== args.deviceHash
      ) {
        throw new Error("Invite is invalid or revoked.");
      }
      return {
        roomId: capability.roomId,
        inviteVersion: capability.version,
      };
    }
    await enforceRateLimit(context, {
      scope: "invite_exchange_global",
      key: "invite_exchange_global",
      limit: 300,
      windowMs: 60 * 1000,
    });
    await enforceRateLimit(context, {
      scope: "invite_exchange_device",
      key: args.deviceHash,
      limit: 10,
      windowMs: 15 * 60 * 1000,
    });
    await enforceRateLimit(context, {
      scope: "invite_exchange",
      key: args.tokenHash,
      limit: 10,
      windowMs: 15 * 60 * 1000,
    });
    const capability = await context.db
      .query("inviteCapabilities")
      .withIndex("by_token_hash", (query) =>
        query.eq("tokenHash", args.tokenHash),
      )
      .unique();
    if (!capability || capability.status !== "active") {
      throw new Error("Invite is invalid or revoked.");
    }
    const now = Date.now();
    await context.db.insert("clientSessions", {
      roomId: capability.roomId,
      sessionHash: args.sessionHash,
      deviceHash: args.deviceHash,
      inviteVersion: capability.version,
      active: true,
      createdAt: now,
      lastSeenAt: now,
    });
    await recordAudit(context, {
      roomId: capability.roomId,
      actorKind: "client",
      actorId: args.sessionHash,
      deviceHash: args.deviceHash,
      action: "client_invite.exchanged",
      now,
    });
    return { roomId: capability.roomId, inviteVersion: capability.version };
  },
});

export const revokeCapability = mutationGeneric({
  args: { roomId: v.id("projectRooms") },
  handler: async (context, args) => {
    const authorized = await requireFreelancerRoom(context, args.roomId);
    const now = Date.now();
    const capabilities = await context.db
      .query("inviteCapabilities")
      .withIndex("by_room", (query) => query.eq("roomId", args.roomId))
      .collect();
    for (const capability of capabilities.filter(
      (item) => item.status === "active",
    )) {
      await context.db.patch(capability._id, {
        status: "revoked",
        revokedAt: now,
        tokenCiphertext: undefined,
        tokenIv: undefined,
      });
    }
    const sessions = await context.db
      .query("clientSessions")
      .withIndex("by_room", (query) => query.eq("roomId", args.roomId))
      .collect();
    for (const session of sessions.filter((item) => item.active === true)) {
      await context.db.patch(session._id, {
        active: false,
        revokedAt: now,
      });
    }
    await recordAudit(context, {
      roomId: args.roomId,
      actorKind: "freelancer",
      actorId: authorized.actorId,
      action: "client_invite.revoked",
      now,
    });
  },
});
