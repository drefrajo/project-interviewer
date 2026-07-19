"use node";

import {
  actionGeneric,
  makeFunctionReference,
} from "convex/server";
import { v, type GenericId } from "convex/values";
import {
  createCapabilityToken,
  hashCapability,
  openCapabilityToken,
  sealCapabilityToken,
} from "./lib/capability_crypto";

const createCapabilityRecordReference = makeFunctionReference<
  "mutation",
  {
    roomId: GenericId<"projectRooms">;
    authUserId: string;
    tokenHash: string;
    tokenCiphertext: string;
    tokenIv: string;
  },
  number
>("invites:createCapabilityRecord");

const currentCapabilityRecordReference = makeFunctionReference<
  "query",
  {
    roomId: GenericId<"projectRooms">;
    authUserId: string;
  },
  | {
      status: "active" | "revoked";
      version: number;
      tokenCiphertext?: string;
      tokenIv?: string;
    }
  | null
>("invites:currentCapabilityRecord");

const requiredEnvironment = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing invite encryption environment variable: ${name}`);
  }
  return value;
};

export const createCapability = actionGeneric({
  args: { roomId: v.id("projectRooms") },
  handler: async (context, args) => {
    const identity = await context.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required.");
    }
    const token = createCapabilityToken();
    const tokenHash = await hashCapability(token);
    const sealed = await sealCapabilityToken(
      token,
      requiredEnvironment("BETTER_AUTH_SECRET"),
      String(args.roomId),
    );
    const version = await context.runMutation(
      createCapabilityRecordReference,
      {
        roomId: args.roomId,
        authUserId: identity.subject,
        tokenHash,
        tokenCiphertext: sealed.ciphertext,
        tokenIv: sealed.iv,
      },
    );
    return { token, version };
  },
});

export const getCapability = actionGeneric({
  args: { roomId: v.id("projectRooms") },
  handler: async (context, args) => {
    const identity = await context.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required.");
    }
    const capability = await context.runQuery(
      currentCapabilityRecordReference,
      {
        roomId: args.roomId,
        authUserId: identity.subject,
      },
    );
    if (!capability) {
      return { status: "revoked" as const, version: 0 };
    }
    if (capability.status === "revoked") {
      return {
        status: "revoked" as const,
        version: capability.version,
      };
    }
    if (!capability.tokenCiphertext || !capability.tokenIv) {
      return {
        status: "unavailable" as const,
        version: capability.version,
      };
    }
    try {
      return {
        status: "active" as const,
        token: await openCapabilityToken(
          {
            ciphertext: capability.tokenCiphertext,
            iv: capability.tokenIv,
          },
          requiredEnvironment("BETTER_AUTH_SECRET"),
          String(args.roomId),
        ),
        version: capability.version,
      };
    } catch {
      return {
        status: "unavailable" as const,
        version: capability.version,
      };
    }
  },
});
