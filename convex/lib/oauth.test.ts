import { describe, expect, it } from "vitest";
import {
  oauthProviderFromCallbackPath,
  readOAuthConfiguration,
} from "./oauth";

describe("OAuth provider ownership", () => {
  it.each([
    ["/callback/:id", "google", "google"],
    ["/callback/:id", "github", "github"],
    ["/callback/google", undefined, "google"],
    ["/callback/github", undefined, "github"],
    ["/callback/google/extra", undefined, null],
    ["/callback/:id", "unknown", null],
    [undefined, undefined, null],
  ] as const)(
    "recognizes callback endpoint %s with route provider %s",
    (path, routeProvider, expected) => {
      expect(oauthProviderFromCallbackPath(path, routeProvider)).toBe(expected);
    },
  );

  it("does not allow provider profile mapping to override ownership", () => {
    const configuration = readOAuthConfiguration({
      GOOGLE_CLIENT_ID: "google-id",
      GOOGLE_CLIENT_SECRET: "google-secret",
      GITHUB_CLIENT_ID: "github-id",
      GITHUB_CLIENT_SECRET: "github-secret",
    });

    expect(configuration.socialProviders.google).not.toHaveProperty(
      "mapProfileToUser",
    );
    expect(configuration.socialProviders.google).not.toHaveProperty(
      "redirectURI",
    );
    expect(configuration.socialProviders.github).not.toHaveProperty(
      "mapProfileToUser",
    );
  });

  it("uses the production Google callback only when explicitly configured", () => {
    const configuration = readOAuthConfiguration({
      GOOGLE_CLIENT_ID: "google-id",
      GOOGLE_CLIENT_SECRET: "google-secret",
      GOOGLE_REDIRECT_URI:
        "https://interview.drefrajo.dev/api/auth/callback/google",
    });

    expect(configuration.socialProviders.google).toMatchObject({
      redirectURI: "https://interview.drefrajo.dev/api/auth/callback/google",
    });
  });

  it("rejects a Google callback outside the expected HTTPS route", () => {
    expect(() =>
      readOAuthConfiguration({
        GOOGLE_CLIENT_ID: "google-id",
        GOOGLE_CLIENT_SECRET: "google-secret",
        GOOGLE_REDIRECT_URI: "https://interview.drefrajo.dev/auth/callback",
      }),
    ).toThrow(
      "GOOGLE_REDIRECT_URI must be an absolute HTTPS callback URL at /api/auth/callback/google.",
    );
  });
});
