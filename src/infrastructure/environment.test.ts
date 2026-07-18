import { describe, expect, it } from "vitest";
import {
  EnvironmentConfigurationError,
  readConvexServerEnvironment,
  readDeploymentEnvironment,
  readApplicationEnvironment,
} from "./environment";
import { AI_MODELS } from "./ai-model-configuration";

describe("application environment boundary", () => {
  it.each([
    ["local-development", "local"],
    ["development", "development"],
    ["production", "production"],
  ] as const)(
    "uses the same Convex browser configuration in %s mode",
    (viteMode, environment) => {
      expect(
        readApplicationEnvironment({
          MODE: viteMode,
          VITE_CONVEX_URL: "https://example.convex.cloud",
          VITE_CONVEX_SITE_URL: "https://example.convex.site",
        }),
      ).toEqual({
        mode: environment,
        public: {
          convexUrl: "https://example.convex.cloud",
          convexSiteUrl: "https://example.convex.site",
        },
      });
    },
  );

  it("never falls back to an in-browser application mode", () => {
    expect(() =>
      readApplicationEnvironment({ MODE: "local-development" }),
    ).toThrow(
      /VITE_CONVEX_URL.*VITE_CONVEX_SITE_URL/,
    );
    expect(() => readApplicationEnvironment({ MODE: "test" })).toThrow(
      /runtime mode/i,
    );
  });

  it("validates server-only Convex AI and auth configuration separately", () => {
    expect(() => readConvexServerEnvironment({})).toThrow(
      EnvironmentConfigurationError,
    );
    expect(
      readConvexServerEnvironment({
        CONVEX_SITE_URL: "https://example.convex.site",
        BETTER_AUTH_SECRET: "better-auth-secret-with-32-characters",
        SITE_URL: "https://discovery.example.test",
        GOOGLE_CLIENT_ID: "google-client",
        GOOGLE_CLIENT_SECRET: "google-secret",
        GITHUB_CLIENT_ID: "github-client",
        GITHUB_CLIENT_SECRET: "github-secret",
        OPENROUTER_API_KEY: "openrouter-secret",
      }),
    ).toMatchObject({
      convexSiteUrl: "https://example.convex.site",
      auth: {
        providers: {
          availability: { google: true, github: true },
        },
      },
      ai: {
        baseUrl: "https://openrouter.ai/api/v1",
        models: AI_MODELS,
      },
    });
  });

  it("requires only the Convex deploy credential on the deploy machine", () => {
    expect(() => readDeploymentEnvironment({})).toThrow(
      EnvironmentConfigurationError,
    );
    expect(
      readDeploymentEnvironment({ CONVEX_DEPLOY_KEY: "deploy-key" }),
    ).toEqual({ deployKeyPresent: true });
  });

  it("rejects secrets exposed through Vite's public environment prefix", () => {
    expect(() =>
      readApplicationEnvironment({
        MODE: "local-development",
        VITE_CONVEX_URL: "https://example.convex.cloud",
        VITE_CONVEX_SITE_URL: "https://example.convex.site",
        VITE_OPENROUTER_API_KEY: "must-never-be-public",
      }),
    ).toThrow(/public VITE_/i);
  });
});
