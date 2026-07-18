import { describe, expect, it } from "vitest";
import {
  accountMethodPolicy,
  authMethodConfiguration,
} from "./auth-method-policy";

describe("Freelancer authentication method policy", () => {
  it("allows only Google/GitHub registration and requires explicit provider linking", () => {
    expect(authMethodConfiguration).toMatchObject({
      registrationProviders: ["google", "github"],
      passwordEnabled: false,
      implicitAccountLinking: false,
      passkeysArePrimary: true,
    });
  });

  it("requires two passkeys before the final OAuth method may be removed", () => {
    expect(
      accountMethodPolicy.canRemove(
        { oauthProviders: ["google"], passkeyIds: ["one"] },
        { kind: "oauth", id: "google" },
      ),
    ).toMatchObject({ allowed: false, reason: "two_passkeys_required" });
    expect(
      accountMethodPolicy.canRemove(
        {
          oauthProviders: ["google"],
          passkeyIds: ["one", "two"],
        },
        { kind: "oauth", id: "google" },
      ),
    ).toEqual({ allowed: true });
  });

  it("protects the final authentication method while allowing redundant passkeys to be removed", () => {
    expect(
      accountMethodPolicy.canRemove(
        { oauthProviders: [], passkeyIds: ["only"] },
        { kind: "passkey", id: "only" },
      ),
    ).toMatchObject({ allowed: false, reason: "last_method" });
    expect(
      accountMethodPolicy.canRemove(
        { oauthProviders: [], passkeyIds: ["one", "two"] },
        { kind: "passkey", id: "one" },
      ),
    ).toEqual({ allowed: true });
  });
});
