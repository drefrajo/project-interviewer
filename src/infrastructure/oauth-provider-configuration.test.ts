import { describe, expect, it } from "vitest";
import {
  OAuthProviderConfigurationError,
  readOAuthProviderConfiguration,
} from "./oauth-provider-configuration";

describe("OAuth provider configuration", () => {
  it("allows GitHub to bootstrap sign-in before Google is configured", () => {
    expect(
      readOAuthProviderConfiguration({
        GITHUB_CLIENT_ID: "github-client",
        GITHUB_CLIENT_SECRET: "github-secret",
      }),
    ).toEqual({
      availability: { google: false, github: true },
      socialProviders: {
        github: {
          clientId: "github-client",
          clientSecret: "github-secret",
        },
      },
    });
  });

  it("enables Google later without changing the GitHub configuration", () => {
    expect(
      readOAuthProviderConfiguration({
        GOOGLE_CLIENT_ID: "google-client",
        GOOGLE_CLIENT_SECRET: "google-secret",
        GITHUB_CLIENT_ID: "github-client",
        GITHUB_CLIENT_SECRET: "github-secret",
      }).availability,
    ).toEqual({ google: true, github: true });
  });

  it("rejects incomplete credential pairs and deployments with no bootstrap provider", () => {
    expect(() =>
      readOAuthProviderConfiguration({
        GITHUB_CLIENT_ID: "github-client",
      }),
    ).toThrow(/GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET/);
    expect(() => readOAuthProviderConfiguration({})).toThrow(
      OAuthProviderConfigurationError,
    );
  });
});
