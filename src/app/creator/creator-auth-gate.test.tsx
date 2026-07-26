import { describe, expect, it } from "vitest";
import { friendlyAuthError } from "./creator-auth-gate";

describe("Creator OAuth errors", () => {
  it.each([
    ["google", "GitHub"],
    ["github", "Google"],
  ] as const)(
    "names the original provider after a rejected %s sign-in",
    (attemptedProvider, expectedProvider) => {
      expect(friendlyAuthError("account_not_linked", attemptedProvider)).toBe(
        `This email already belongs to an account created with ${expectedProvider}. Continue with ${expectedProvider}.`,
      );
    },
  );

  it("does not mislabel unrelated provider errors as account ownership errors", () => {
    expect(friendlyAuthError("oauth_provider_not_found", "google")).toBe(
      "oauth_provider_not_found",
    );
  });
});
