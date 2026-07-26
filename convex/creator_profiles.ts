import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";
import { getCreatorProfile, requireIdentity } from "./lib/auth";
import { assertLength } from "./lib/domain";
import { isOAuthProviderId } from "./lib/oauth";
import { BUILT_IN_TEMPLATES } from "./lib/templates";

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

    for (const template of BUILT_IN_TEMPLATES) {
      for (const sourceLanguage of ["en", "de"] as const) {
        const existing = await ctx.db
          .query("interviewTemplates")
          .withIndex("by_builtInKey_and_sourceLanguage", (q) =>
            q
              .eq("builtInKey", template.key)
              .eq("sourceLanguage", sourceLanguage),
          )
          .unique();
        if (!existing) {
          await ctx.db.insert("interviewTemplates", {
            kind: "built_in",
            builtInKey: template.key,
            name: template.name,
            sourceLanguage,
            instructions: template[sourceLanguage],
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    }
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
