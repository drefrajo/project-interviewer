import { createClient } from "@convex-dev/better-auth";
import type { ComponentApi as BetterAuthComponentApi } from "@convex-dev/better-auth/_generated/component.js";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { componentsGeneric, queryGeneric } from "convex/server";
import authConfig from "./auth.config";
import { authMethodGuard } from "./auth_method_guard";
import authSchema from "./betterAuth/schema";
import { readOAuthProviderConfiguration } from "../src/infrastructure/oauth-provider-configuration";

const components = componentsGeneric();

export const authComponent = createClient(
  components.betterAuth as unknown as BetterAuthComponentApi,
  {
    local: {
      schema: authSchema,
    },
  },
);

type EnvironmentSource = Readonly<
  Record<string, string | undefined>
>;

const requiredEnvironment = (
  source: EnvironmentSource,
  name: string,
): string => {
  const value = source[name];
  if (!value) {
    throw new Error(`Missing Better Auth environment variable: ${name}`);
  }
  return value;
};

const schemaGenerationEnvironment = {
  SITE_URL: "http://localhost:5173",
  CONVEX_SITE_URL: "http://127.0.0.1:3211",
  BETTER_AUTH_SECRET: "schema-generation-secret-at-least-32-chars",
  GOOGLE_CLIENT_ID: "schema-generation-client",
  GOOGLE_CLIENT_SECRET: "schema-generation-secret",
} satisfies EnvironmentSource;

export const createAuthOptions = (
  context: Parameters<typeof authComponent.adapter>[0],
  source: EnvironmentSource = schemaGenerationEnvironment,
) => {
  const siteUrl = requiredEnvironment(source, "SITE_URL");
  const convexSiteUrl = requiredEnvironment(
    source,
    "CONVEX_SITE_URL",
  );
  const oauth = readOAuthProviderConfiguration(source);

  return {
    appName: "Project Interviewer",
    secret: requiredEnvironment(source, "BETTER_AUTH_SECRET"),
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
};

export const createAuth = (
  context: Parameters<typeof authComponent.adapter>[0],
) => betterAuth(createAuthOptions(context, process.env));

export const getProviderAvailability = queryGeneric({
  args: {},
  handler: () =>
    readOAuthProviderConfiguration(process.env).availability,
});
