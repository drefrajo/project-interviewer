import { createClient } from "@convex-dev/better-auth";
import type { ComponentApi as BetterAuthComponentApi } from "@convex-dev/better-auth/_generated/component.js";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { APIError } from "better-auth/api";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { componentsGeneric, queryGeneric } from "convex/server";
import authConfig from "./auth.config";
import authSchema from "./betterAuth/schema";
import { isLocalDevelopmentAuthBypassEnabled } from "./lib/environment";
import {
  oauthProviderFromCallbackPath,
  parseCreatorAllowlist,
  readOAuthConfiguration,
} from "./lib/oauth";

const components = componentsGeneric();

export const authComponent = createClient(
  components.betterAuth as unknown as BetterAuthComponentApi,
  { local: { schema: authSchema } },
);

type EnvironmentSource = Readonly<{
  SITE_URL?: string | undefined;
  CONVEX_SITE_URL?: string | undefined;
  BETTER_AUTH_SECRET?: string | undefined;
  CREATOR_ALLOWLIST?: string | undefined;
  LOCAL_DEV_AUTH_BYPASS?: string | undefined;
  GOOGLE_CLIENT_ID?: string | undefined;
  GOOGLE_CLIENT_SECRET?: string | undefined;
  GOOGLE_REDIRECT_URI?: string | undefined;
  GITHUB_CLIENT_ID?: string | undefined;
  GITHUB_CLIENT_SECRET?: string | undefined;
  GITHUB_REDIRECT_URI?: string | undefined;
}>;

const required = (source: EnvironmentSource, name: keyof EnvironmentSource) => {
  const value = source[name];
  if (!value) throw new Error(`Missing Better Auth environment variable: ${name}`);
  return value;
};

const schemaGenerationEnvironment = {
  SITE_URL: "http://localhost:5173",
  CONVEX_SITE_URL: "http://127.0.0.1:3211",
  BETTER_AUTH_SECRET: "schema-generation-secret-at-least-32-characters",
  CREATOR_ALLOWLIST: "creator@example.com",
  GOOGLE_CLIENT_ID: "schema-generation-client",
  GOOGLE_CLIENT_SECRET: "schema-generation-secret",
} satisfies EnvironmentSource;

export const createAuthOptions = (
  context: Parameters<typeof authComponent.adapter>[0],
  source: EnvironmentSource = schemaGenerationEnvironment,
) => {
  const siteUrl = required(source, "SITE_URL");
  const oauth = readOAuthConfiguration(source, {
    allowEmpty: isLocalDevelopmentAuthBypassEnabled(source),
  });
  const allowlist = parseCreatorAllowlist(source.CREATOR_ALLOWLIST);
  const publicRegistration =
    source.CREATOR_ALLOWLIST?.trim().toLowerCase() === "all";
  return {
    appName: "Interview",
    secret: required(source, "BETTER_AUTH_SECRET"),
    baseURL: required(source, "CONVEX_SITE_URL"),
    trustedOrigins: [siteUrl],
    database: authComponent.adapter(context),
    emailAndPassword: { enabled: false },
    socialProviders: oauth.socialProviders,
    user: {
      additionalFields: {
        provider: {
          type: "string",
          required: false,
          input: false,
        },
      },
    },
    account: {
      accountLinking: {
        enabled: false,
        disableImplicitLinking: true,
        allowUnlinkingAll: false,
        trustedProviders: [],
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user, hookContext) => {
            if (
              !user.emailVerified ||
              (!publicRegistration &&
                !allowlist.has(user.email.trim().toLowerCase()))
            ) {
              throw new APIError("FORBIDDEN", {
                message: "Creator registration is not allowed for this email.",
              });
            }
            const provider = oauthProviderFromCallbackPath(
              hookContext?.path,
              hookContext?.params?.id,
            );
            if (!provider) {
              throw new APIError("FORBIDDEN", {
                message: "Creator registration requires Google or GitHub.",
              });
            }
            return { data: { ...user, provider } };
          },
        },
      },
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 60,
      customRules: { "/sign-in/social": { window: 60, max: 10 } },
    },
    plugins: [
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
    readOAuthConfiguration(process.env, {
      allowEmpty: isLocalDevelopmentAuthBypassEnabled(),
    }).availability,
});

export const { getAuthUser } = authComponent.clientApi();
