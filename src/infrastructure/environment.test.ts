import { describe, expect, it } from "vitest";
import {
  EnvironmentConfigurationError,
  readConvexServerEnvironment,
  readDeploymentEnvironment,
  readApplicationEnvironment,
} from "./environment";

describe("application environment boundary", () => {
  it("runs the complete local application without third-party credentials", () => {
    expect(readApplicationEnvironment({})).toEqual({
      mode: "local",
    });
  });

  it("requires only public hosted configuration in the browser boundary", () => {
    expect(() =>
      readApplicationEnvironment({ VITE_APP_MODE: "production" }),
    ).toThrow(EnvironmentConfigurationError);

    expect(
      readApplicationEnvironment({
        VITE_APP_MODE: "production",
        VITE_CONVEX_URL: "https://example.convex.cloud",
        VITE_CONVEX_SITE_URL: "https://example.convex.site",
        VITE_SITE_URL: "https://discovery.example.test",
      }),
    ).toMatchObject({
      mode: "production",
      public: {
        convexUrl: "https://example.convex.cloud",
        siteUrl: "https://discovery.example.test",
      },
    });
  });

  it("validates server-only Convex AI and auth configuration separately", () => {
    expect(() => readConvexServerEnvironment({})).toThrow(
      EnvironmentConfigurationError,
    );
    expect(
      readConvexServerEnvironment({
        BETTER_AUTH_SECRET: "better-auth-secret-with-32-characters",
        SITE_URL: "https://discovery.example.test",
        GOOGLE_CLIENT_ID: "google-client",
        GOOGLE_CLIENT_SECRET: "google-secret",
        GITHUB_CLIENT_ID: "github-client",
        GITHUB_CLIENT_SECRET: "github-secret",
        OPENROUTER_API_KEY: "openrouter-secret",
        OPENROUTER_ALLOWED_PROVIDERS: "openai,anthropic",
        AI_MODEL_FILE_ANALYZER: "openai/gpt-5-mini",
        AI_MODEL_INTERVIEW_PLANNER: "openai/gpt-5",
        AI_MODEL_INTERVIEW_AGENT: "openai/gpt-5",
        AI_MODEL_INTERVIEW_REVIEWER: "anthropic/claude-sonnet-4",
        AI_MODEL_BRIEF_GENERATOR: "openai/gpt-5",
        AI_MODEL_EMBEDDINGS: "openai/text-embedding-3-small",
      }),
    ).toMatchObject({
      ai: {
        allowedProviders: ["openai", "anthropic"],
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
        VITE_OPENROUTER_API_KEY: "must-never-be-public",
      }),
    ).toThrow(/public VITE_/i);
  });
});
