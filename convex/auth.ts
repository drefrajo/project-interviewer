import { createClient } from "@convex-dev/better-auth";
import type { ComponentApi as BetterAuthComponentApi } from "@convex-dev/better-auth/_generated/component.js";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { componentsGeneric, queryGeneric } from "convex/server";
import authConfig from "./auth.config";
import { authMethodGuard } from "./auth_method_guard";
import { readOAuthProviderConfiguration } from "../src/infrastructure/oauth-provider-configuration";

const components = componentsGeneric();

export const authComponent = createClient(
  components.betterAuth as unknown as BetterAuthComponentApi,
);

const requiredEnvironment = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing Better Auth environment variable: ${name}`);
  }
  return value;
};

export const createAuth = (
  context: Parameters<typeof authComponent.adapter>[0],
) => {
  const siteUrl = requiredEnvironment("SITE_URL");
  const convexSiteUrl = requiredEnvironment("CONVEX_SITE_URL");
  const oauth = readOAuthProviderConfiguration(process.env);

  const options = {
    appName: "Project Interviewer",
    secret: requiredEnvironment("BETTER_AUTH_SECRET"),
    baseURL: convexSiteUrl,
    trustedOrigins: [siteUrl],
    rateLimit: {
      enabled: true,
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/social": { window: 60, max: 10 },
        "/passkey/authenticate": { window: 60, max: 10 },
        "/passkey/register": { window: 60, max: 10 },
      },
    },
    database: authComponent.adapter(context),
    emailAndPassword: { enabled: false },
    socialProviders: oauth.socialProviders,
    account: {
      accountLinking: {
        enabled: true,
        disableImplicitLinking: true,
        allowUnlinkingAll: false,
        trustedProviders: [],
      },
    },
    plugins: [
      passkey({
        rpID: new URL(siteUrl).hostname,
        origin: siteUrl,
        registration: { requireSession: true },
      }),
      authMethodGuard,
      crossDomain({ siteUrl }),
      convex({ authConfig }),
    ],
  } satisfies BetterAuthOptions;

  return betterAuth(options);
};

export const getProviderAvailability = queryGeneric({
  args: {},
  handler: () =>
    readOAuthProviderConfiguration(process.env).availability,
});
