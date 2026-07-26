import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type ReadCtx = QueryCtx | MutationCtx;

export const requireIdentity = async (ctx: ReadCtx) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated.");
  }
  return identity;
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
