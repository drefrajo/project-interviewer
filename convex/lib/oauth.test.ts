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
    expect(configuration.socialProviders.github).not.toHaveProperty(
      "mapProfileToUser",
    );
  });
});
