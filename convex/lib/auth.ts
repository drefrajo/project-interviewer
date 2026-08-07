import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { isLocalDevelopmentAuthBypassEnabled } from "./environment";

type ReadCtx = QueryCtx | MutationCtx;

type AuthIdentity = NonNullable<
  Awaited<ReturnType<QueryCtx["auth"]["getUserIdentity"]>>
>;

const localDevelopmentIdentity = {
  tokenIdentifier: "local-development:creator",
  subject: "local-development-creator",
  issuer: "local-development",
  name: "Local Creator",
  email: "local@example.com",
  emailVerified: true,
} satisfies AuthIdentity;

export const requireIdentity = async (ctx: ReadCtx) => {
  const identity = await ctx.auth.getUserIdentity();
  if (identity) return identity;
  if (isLocalDevelopmentAuthBypassEnabled()) return localDevelopmentIdentity;
  throw new Error("Not authenticated.");
};

export const getCreatorProfile = async (
  ctx: ReadCtx,
): Promise<Doc<"creatorProfiles"> | null> => {
  const identity = await requireIdentity(ctx);
  return await ctx.db
    .query("creatorProfiles")
    .withIndex("by_tokenIdentifier", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();
};

export const requireCreatorProfile = async (
  ctx: ReadCtx,
): Promise<Doc<"creatorProfiles">> => {
  const profile = await getCreatorProfile(ctx);
  if (!profile) {
    throw new Error("Creator profile required.");
  }
  return profile;
};
