import { describe, expect, it, vi } from "vitest";
import {
  createHostedApplication,
  type HostedConvexTransport,
} from "./hosted-application";

describe("hosted application adapter", () => {
  it("creates a normalized room and rotates an opaque invite through Convex", async () => {
    const transport: HostedConvexTransport = {
      query: vi.fn(),
      mutation: vi
        .fn()
        .mockResolvedValueOnce("profile_1")
        .mockResolvedValueOnce("room_1"),
      action: vi.fn().mockResolvedValue({
        token: "invite-token",
        version: 1,
      }),
    };
    const application = createHostedApplication(transport);
    const actor = await application.identities.establishFreelancer({
      displayName: "Ada",
    });

    await expect(
      application.rooms.create(actor, {
        title: "Discovery",
        clientLabel: "ACME",
        projectDescription: "A multilingual product.",
        briefLanguage: "en",
        freelancerGuidance: "",
      }),
    ).resolves.toMatchObject({
      room: { id: "room_1", title: "Discovery" },
      inviteToken: "invite-token",
    });
    expect(transport.action).toHaveBeenCalledOnce();
    expect(
      vi.mocked(transport.action).mock.calls[0]?.[1],
    ).toEqual({ roomId: "room_1" });
  });

  it("exchanges only hashes when resolving an account-free invite", async () => {
    const transport: HostedConvexTransport = {
      query: vi.fn().mockResolvedValue({
        id: "room_1",
        title: "Discovery",
        clientLabel: "ACME",
        projectDescription: "A product.",
        briefLanguage: "en",
        discoveryProfileId: "software-project",
        phase: "setup",
        interviewReadiness: "waiting_for_material",
        lastActivityAt: 1,
        createdAt: 1,
        updatedAt: 1,
        freelancerDisplayName: "Ada",
      }),
      mutation: vi.fn().mockResolvedValue({
        roomId: "room_1",
        inviteVersion: 2,
      }),
      action: vi.fn(),
    };
    const application = createHostedApplication(transport, {
      randomToken: () => "client-session",
      hash: async (value) => `hashed:${value}`,
    });

    const access = await application.clientAccess.resolveInvite(
      "raw-invite",
      { deviceId: "device-1" },
    );

    expect(transport.mutation).toHaveBeenCalledWith(
      expect.anything(),
      {
        tokenHash: "hashed:raw-invite",
        sessionHash: "hashed:client-session",
        deviceHash: "hashed:device-1",
      },
    );
    expect(access.actor).toEqual({
      kind: "client",
      roomId: "room_1",
      deviceId: "device-1",
      inviteVersion: 2,
      sessionId: "hashed:client-session",
    });
  });
});
