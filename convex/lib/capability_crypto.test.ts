import { describe, expect, it } from "vitest";
import {
  openCapabilityToken,
  sealCapabilityToken,
} from "./capability_crypto";

describe("capability token encryption", () => {
  it("round-trips an Invite Link token without storing it as plaintext", async () => {
    const token = "unguessable-client-capability";
    const sealed = await sealCapabilityToken(
      token,
      "better-auth-secret-with-32-characters",
      "room_1",
    );

    expect(sealed.ciphertext).not.toContain(token);
    await expect(
      openCapabilityToken(
        sealed,
        "better-auth-secret-with-32-characters",
        "room_1",
      ),
    ).resolves.toBe(token);
  });

  it("cannot decrypt with another deployment secret", async () => {
    const sealed = await sealCapabilityToken(
      "unguessable-client-capability",
      "first-better-auth-secret-with-32-characters",
      "room_1",
    );

    await expect(
      openCapabilityToken(
        sealed,
        "second-better-auth-secret-with-32-characters",
        "room_1",
      ),
    ).rejects.toThrow();
  });

  it("binds encrypted Invite Links to their Project Room", async () => {
    const sealed = await sealCapabilityToken(
      "unguessable-client-capability",
      "better-auth-secret-with-32-characters",
      "room_1",
    );

    await expect(
      openCapabilityToken(
        sealed,
        "better-auth-secret-with-32-characters",
        "room_2",
      ),
    ).rejects.toThrow();
  });
});
