/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { hashCapability } from "./lib/capability_crypto";

const modules = import.meta.glob("./**/*.ts");

const seed = async (identityKind: "none" | "contact" | "full") => {
  const t = convexTest(schema, modules);
  const tokenIdentifier = "test|privacy-creator";
  const token = "privacy-interview-token";
  const linkHash = await hashCapability(token);
  const { creatorId, interviewId } = await t.run(async (ctx) => {
    const creatorId = await ctx.db.insert("creatorProfiles", {
      authUserId: "privacy-auth-user",
      tokenIdentifier,
      email: "private-oauth@example.test",
      displayName: "Studio Privacy",
      ...(identityKind !== "none"
        ? {
            contactEmail: "hello@studio.example",
            ...(identityKind === "full"
              ? { privacyPolicyUrl: "https://studio.example/privacy" }
              : {}),
          }
        : {}),
      createdAt: 1,
      updatedAt: 1,
    });
    const interviewId = await ctx.db.insert("interviews", {
      creatorId,
      agentThreadId: "privacy-thread",
      linkHash,
      linkTokenCiphertext: "ciphertext",
      linkTokenIv: "iv",
      linkVersion: 1,
      projectName: "Private project",
      clientLanguage: "en",
      model: "gpt-5.6-terra",
      instructions: "Interview the Client.",
      passState: "reserved",
      passReservationKey: "privacy-reservation",
      passReservationVersion: 1,
      createdAt: 1,
      updatedAt: 1,
      step: "interview",
      clientMessageCount: 0,
      documentRevisionCount: 0,
      concepts: [],
      usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
    });
    return { creatorId, interviewId };
  });
  return { t, token, tokenIdentifier, creatorId, interviewId };
};

describe("Creator public privacy identity", () => {
  it("returns only Creator-selected public identity to a Client", async () => {
    const { t, token } = await seed("full");

    const view = await t.query(api.client.getByLink, { token });

    expect(view?.creator).toEqual({
      displayName: "Studio Privacy",
      contactEmail: "hello@studio.example",
      privacyPolicyUrl: "https://studio.example/privacy",
    });
    expect(view?.creatorIdentityReady).toBe(true);
    expect(JSON.stringify(view)).not.toContain("private-oauth@example.test");
  });

  it("never falls back to OAuth email when public identity is incomplete", async () => {
    const { t, token } = await seed("none");

    const view = await t.query(api.client.getByLink, { token });

    expect(view?.creator).toBeNull();
    expect(view?.creatorIdentityReady).toBe(false);
    expect(JSON.stringify(view)).not.toContain("private-oauth@example.test");
    await expect(t.mutation(api.client.start, { token })).rejects.toThrow(
      "Complete your public display name",
    );
  });

  it("blocks Interview creation before any data is created when public identity is incomplete", async () => {
    const { t, tokenIdentifier } = await seed("none");
    const before = await t.run(async (ctx) =>
      await ctx.db.query("interviews").collect(),
    );

    await expect(
      t.withIdentity({ tokenIdentifier }).mutation(api.interviews.create, {
        projectName: "Blocked project",
        clientLanguage: "en",
        instructions: "Interview the Client.",
      }),
    ).rejects.toThrow("before creating or sharing Interviews");

    const after = await t.run(async (ctx) =>
      await ctx.db.query("interviews").collect(),
    );
    expect(after).toHaveLength(before.length);
  });

  it("validates and persists the Creator-selected contact and policy", async () => {
    const { t, token, tokenIdentifier } = await seed("none");
    const identity = { tokenIdentifier };

    await expect(
      t.withIdentity(identity).mutation(api.creator_profiles.updateSettings, {
        displayName: " Studio Privacy ",
        contactEmail: " Hello@Studio.Example ",
        privacyPolicyUrl: "https://studio.example/privacy",
        language: "en",
      }),
    ).resolves.toMatchObject({
      displayName: "Studio Privacy",
      contactEmail: "hello@studio.example",
      privacyPolicyUrl: "https://studio.example/privacy",
    });

    const cleared = await t
      .withIdentity(identity)
      .mutation(api.creator_profiles.updateSettings, {
        displayName: "Studio Privacy",
        contactEmail: "hello@studio.example",
        language: "en",
      });
    expect(cleared).not.toHaveProperty("privacyPolicyUrl");
    expect((await t.query(api.client.getByLink, { token }))?.creator).toEqual({
      displayName: "Studio Privacy",
      contactEmail: "hello@studio.example",
    });

    await expect(
      t.withIdentity(identity).mutation(api.creator_profiles.updateSettings, {
        displayName: "Studio Privacy",
        contactEmail: "not-an-email",
        privacyPolicyUrl: "javascript:alert(1)",
        language: "en",
      }),
    ).rejects.toThrow("valid email address");
    await expect(
      t.withIdentity(identity).mutation(api.creator_profiles.updateSettings, {
        displayName: "Studio Privacy",
        contactEmail: "hello@studio.example",
        privacyPolicyUrl: "http://studio.example/privacy",
        language: "en",
      }),
    ).rejects.toThrow("valid HTTPS URL");
  });

  it("allows a Creator to publish a contact email without a privacy policy", async () => {
    const { t, token, tokenIdentifier } = await seed("contact");

    const view = await t.query(api.client.getByLink, { token });
    expect(view?.creator).toEqual({
      displayName: "Studio Privacy",
      contactEmail: "hello@studio.example",
    });
    expect(view?.creatorIdentityReady).toBe(true);

    await expect(
      t.withIdentity({ tokenIdentifier }).mutation(api.creator_profiles.updateSettings, {
        displayName: "Studio Privacy",
        contactEmail: "hello@studio.example",
        language: "en",
      }),
    ).resolves.toMatchObject({
      displayName: "Studio Privacy",
      contactEmail: "hello@studio.example",
    });
  });
});
