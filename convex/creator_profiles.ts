import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";
import { isLocalDevelopmentAuthBypassEnabled } from "./lib/environment";
import { getCreatorProfile, requireIdentity } from "./lib/auth";
import {
  assertEmailAddress,
  assertLength,
  assertPrivacyPolicyUrl,
} from "./lib/domain";
import { isOAuthProviderId } from "./lib/oauth";
import { ensureIntroductoryPass } from "./lib/pass_accounting";
import { creatorLanguage } from "./schema";

const provider = v.union(v.literal("google"), v.literal("github"), v.null());
const creatorProfileView = v.object({
  id: v.id("creatorProfiles"),
  displayName: v.string(),
  email: v.string(),
  contactEmail: v.optional(v.string()),
  privacyPolicyUrl: v.optional(v.string()),
  language: creatorLanguage,
  provider,
});

const profileView = (profile: {
  _id: typeof creatorProfileView.type["id"];
  displayName: string;
  email: string;
  contactEmail?: string;
  privacyPolicyUrl?: string | undefined;
  language?: "en" | "de";
  emailLanguage?: "en" | "de";
  provider?: "google" | "github";
}) => ({
  id: profile._id,
  displayName: profile.displayName,
  email: profile.email,
  ...(profile.contactEmail ? { contactEmail: profile.contactEmail } : {}),
  ...(profile.privacyPolicyUrl
    ? { privacyPolicyUrl: profile.privacyPolicyUrl }
    : {}),
  language: profile.language ?? profile.emailLanguage ?? "en",
  provider: profile.provider ?? null,
});

export const getCurrent = query({
  args: {},
  returns: v.union(creatorProfileView, v.null()),
  handler: async (ctx) => {
    const profile = await getCreatorProfile(ctx);
    return profile ? profileView(profile) : null;
  },
});

export const upsertCurrent = mutation({
  args: {
    displayName: v.optional(v.string()),
    language: v.optional(creatorLanguage),
  },
  returns: creatorProfileView,
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    if (!identity.email) {
      throw new Error("A verified email is required.");
    }
    const email = identity.email.toLowerCase();
    const now = Date.now();
    const current = await ctx.db
      .query("creatorProfiles")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    const authUser = isLocalDevelopmentAuthBypassEnabled()
      ? null
      : await authComponent.getAuthUser(ctx);
    const provider = isOAuthProviderId(authUser?.provider)
      ? authUser.provider
      : current?.provider;
    const language =
      current?.language ?? current?.emailLanguage ?? args.language ?? "en";
    const displayName = current
      ? current.displayName
      : assertLength(
          "Display name",
          args.displayName ?? identity.name ?? "Creator",
          120,
        );
    const id = current
      ? (await ctx.db.patch("creatorProfiles", current._id, {
          displayName,
          email,
          language,
          ...(provider ? { provider } : {}),
          updatedAt: now,
        }),
        current._id)
        : await ctx.db.insert("creatorProfiles", {
          authUserId: identity.subject,
          tokenIdentifier: identity.tokenIdentifier,
          email,
          displayName,
          language,
          ...(provider ? { provider } : {}),
          createdAt: now,
          updatedAt: now,
        });

    await ensureIntroductoryPass(ctx, id);
    const stored = await ctx.db.get("creatorProfiles", id);
    if (!stored) throw new Error("Creator profile could not be saved.");
    return profileView(stored);
  },
});

export const updateDisplayName = mutation({
  args: { displayName: v.string() },
  returns: creatorProfileView,
  handler: async (ctx, args) => {
    const profile = await getCreatorProfile(ctx);
    if (!profile) throw new Error("Creator profile required.");
    const displayName = assertLength("Display name", args.displayName, 120);
    await ctx.db.patch("creatorProfiles", profile._id, {
      displayName,
      updatedAt: Date.now(),
    });
    return profileView({ ...profile, displayName });
  },
});

export const updateSettings = mutation({
  args: {
    displayName: v.string(),
    contactEmail: v.string(),
    privacyPolicyUrl: v.optional(v.string()),
    language: creatorLanguage,
  },
  returns: creatorProfileView,
  handler: async (ctx, args) => {
    const profile = await getCreatorProfile(ctx);
    if (!profile) throw new Error("Creator profile required.");
    const displayName = assertLength("Display name", args.displayName, 120);
    const contactEmail = assertEmailAddress(
      "Contact email",
      args.contactEmail,
    );
    const privacyPolicyUrl = args.privacyPolicyUrl?.trim()
      ? assertPrivacyPolicyUrl(args.privacyPolicyUrl)
      : undefined;
    await ctx.db.patch("creatorProfiles", profile._id, {
      displayName,
      contactEmail,
      ...(privacyPolicyUrl
        ? { privacyPolicyUrl }
        : { privacyPolicyUrl: undefined }),
      language: args.language,
      updatedAt: Date.now(),
    });
    return profileView({
      ...profile,
      displayName,
      contactEmail,
      language: args.language,
      ...(privacyPolicyUrl
        ? { privacyPolicyUrl }
        : { privacyPolicyUrl: undefined }),
    });
  },
});
