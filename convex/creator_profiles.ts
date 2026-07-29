import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";
import { getCreatorProfile, requireIdentity } from "./lib/auth";
import { assertLength } from "./lib/domain";
import { isOAuthProviderId } from "./lib/oauth";

export const getCurrent = query({
  args: {},
  handler: async (ctx) => {
    const profile = await getCreatorProfile(ctx);
    return profile
      ? {
          id: profile._id,
          displayName: profile.displayName,
          email: profile.email,
          provider: profile.provider ?? null,
        }
      : null;
  },
});

export const upsertCurrent = mutation({
  args: { displayName: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const authUser = await authComponent.getAuthUser(ctx);
    if (!identity.email) {
      throw new Error("A verified email is required.");
    }
    const email = identity.email.toLowerCase();
    const displayName = assertLength(
      "Display name",
      args.displayName ?? identity.name ?? email.split("@")[0] ?? "Creator",
      120,
    );
    const now = Date.now();
    const current = await ctx.db
      .query("creatorProfiles")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    const provider = isOAuthProviderId(authUser.provider)
      ? authUser.provider
      : current?.provider;
    const id = current
      ? (await ctx.db.patch("creatorProfiles", current._id, {
          displayName,
          email,
          ...(provider ? { provider } : {}),
          updatedAt: now,
        }),
        current._id)
      : await ctx.db.insert("creatorProfiles", {
          authUserId: identity.subject,
          tokenIdentifier: identity.tokenIdentifier,
          email,
          displayName,
          ...(provider ? { provider } : {}),
          createdAt: now,
          updatedAt: now,
        });

    return { id, displayName, email };
  },
});

export const updateDisplayName = mutation({
  args: { displayName: v.string() },
  handler: async (ctx, args) => {
    const profile = await getCreatorProfile(ctx);
    if (!profile) throw new Error("Creator profile required.");
    const displayName = assertLength("Display name", args.displayName, 120);
    await ctx.db.patch("creatorProfiles", profile._id, {
      displayName,
      updatedAt: Date.now(),
    });
    return {
      displayName,
      email: profile.email,
      provider: profile.provider ?? undefined,
    };
  },
});
