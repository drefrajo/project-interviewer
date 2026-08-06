import { describe, expect, it } from "vitest";
import { createAuthOptions } from "./auth";

const environment = {
  SITE_URL: "http://localhost:5173",
  CONVEX_SITE_URL: "http://127.0.0.1:3211",
  BETTER_AUTH_SECRET: "test-secret-at-least-32-characters-long",
  CREATOR_ALLOWLIST: "creator@example.com",
  GOOGLE_CLIENT_ID: "google-id",
  GOOGLE_CLIENT_SECRET: "google-secret",
  GITHUB_CLIENT_ID: "github-id",
  GITHUB_CLIENT_SECRET: "github-secret",
};

const verifiedCreator = {
  id: "auth-user-id",
  name: "Creator",
  email: "creator@example.com",
  emailVerified: true,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

const getCreateUserHook = (source = environment) => {
  const options = createAuthOptions({} as never, source);
  const hook = options.databaseHooks.user.create.before;
  return { hook, options };
};

describe("Better Auth provider ownership", () => {
  it.each(["google", "github"] as const)(
    "persists %s as the first provider during OAuth registration",
    async (provider) => {
      const { hook } = getCreateUserHook();
      const result = await hook(verifiedCreator, {
        path: "/callback/:id",
        params: { id: provider },
      } as never);

      expect(result).toEqual({
        data: expect.objectContaining({ provider }),
      });
    },
  );

  it("keeps account linking disabled", () => {
    const { options } = getCreateUserHook();

    expect(options.account.accountLinking).toMatchObject({
      enabled: false,
      disableImplicitLinking: true,
      trustedProviders: [],
    });
  });

  it("rejects a provider outside the supported callback set", async () => {
    const { hook } = getCreateUserHook();

    await expect(
      hook(verifiedCreator, {
        path: "/callback/:id",
        params: { id: "unknown" },
      } as never),
    ).rejects.toThrow("Creator registration requires Google or GitHub.");
  });

  it("still rejects a verified email outside the allowlist", async () => {
    const { hook } = getCreateUserHook();

    await expect(
      hook(
        { ...verifiedCreator, email: "not-allowed@example.com" },
        {
          path: "/callback/:id",
          params: { id: "google" },
        } as never,
      ),
    ).rejects.toThrow("Creator registration is not allowed for this email.");
  });

  it("allows any verified OAuth email when the allowlist is set to all", async () => {
    const { hook } = getCreateUserHook({
      ...environment,
      CREATOR_ALLOWLIST: "all",
    });

    const result = await hook(
      { ...verifiedCreator, email: "new-creator@example.com" },
      {
        path: "/callback/:id",
        params: { id: "github" },
      } as never,
    );

    expect(result).toEqual({
      data: expect.objectContaining({
        email: "new-creator@example.com",
        provider: "github",
      }),
    });
  });

  it("still requires a verified email in public registration mode", async () => {
    const { hook } = getCreateUserHook({
      ...environment,
      CREATOR_ALLOWLIST: "all",
    });

    await expect(
      hook(
        { ...verifiedCreator, emailVerified: false },
        {
          path: "/callback/:id",
          params: { id: "google" },
        } as never,
      ),
    ).rejects.toThrow("Creator registration is not allowed for this email.");
  });
});
