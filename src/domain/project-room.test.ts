import { describe, expect, it } from "vitest";
import {
  AuthorizationError,
  createProjectInterviewer,
  type ProjectInterviewerDependencies,
} from "./project-interviewer";

const dependencies = (): ProjectInterviewerDependencies => {
  let id = 0;
  let tokenId = 0;
  let now = 1_800_000_000_000;

  return {
    ids: {
      next: (prefix) => `${prefix}_${++id}`,
      inviteToken: () => `unguessable-client-capability-${++tokenId}`,
      deviceId: () => "device_primary",
    },
    clock: { now: () => ++now },
    inviteTokens: {
      hash: async (token) =>
        token.endsWith("-1") ? "sha256:digest-one" : "sha256:digest-two",
    },
  };
};

describe("Project Room public service", () => {
  it("creates a canonical Project Room and returns the Invite Link secret only once", async () => {
    const app = createProjectInterviewer(dependencies());
    const freelancer = await app.identities.createDevelopmentFreelancer({
      displayName: "Ada Freelancer",
    });

    const created = await app.rooms.create(freelancer, {
      title: "Müller Portal",
      clientLabel: "Müller GmbH",
      projectDescription:
        "A client portal for service requests and document exchange.",
      briefLanguage: "de",
      freelancerGuidance: "Exclude ongoing content maintenance.",
    });

    expect(created.room).toMatchObject({
      title: "Müller Portal",
      clientLabel: "Müller GmbH",
      projectDescription:
        "A client portal for service requests and document exchange.",
      briefLanguage: "de",
      discoveryProfileId: "software-project",
      phase: "setup",
    });
    expect(created.inviteToken).toBe("unguessable-client-capability-1");
    expect(created.room.invite).toEqual({
      tokenHash: "sha256:digest-one",
      status: "active",
      version: 1,
    });
    expect(JSON.stringify(app.inspectState())).not.toContain(
      "unguessable-client-capability-1",
    );
  });

  it("onboards a Client once and resolves repeat visits to the same Project Home", async () => {
    const app = createProjectInterviewer(dependencies());
    const freelancer = await app.identities.createDevelopmentFreelancer({
      displayName: "Ada Freelancer",
    });
    const { room, inviteToken } = await app.rooms.create(freelancer, {
      title: "Field Service App",
      clientLabel: "Northwind",
      projectDescription: "Replace paper field reports.",
      briefLanguage: "en",
      freelancerGuidance: "",
    });

    const firstVisit = await app.clientAccess.resolveInvite(inviteToken, {
      deviceId: "device_client",
    });
    expect(firstVisit.onboardingRequired).toBe(true);
    expect(firstVisit.room).not.toHaveProperty("freelancerGuidance");
    expect(firstVisit.room).not.toHaveProperty("invite");
    expect(firstVisit.room).not.toHaveProperty("freelancerId");
    expect(firstVisit.room.freelancerDisplayName).toBe("Ada Freelancer");

    await app.clientAccess.onboard(firstVisit.actor, {
      displayName: "Casey",
      interviewLanguage: "de",
      acknowledgedDisclosure: true,
    });

    const repeatVisit = await app.clientAccess.resolveInvite(inviteToken, {
      deviceId: "device_client",
    });
    expect(repeatVisit).toMatchObject({
      onboardingRequired: false,
      room: { id: room.id },
      client: {
        displayName: "Casey",
        interviewLanguage: "de",
      },
    });

    await expect(
      app.clientAccess.onboard(repeatVisit.actor, {
        displayName: "Another Client",
        interviewLanguage: "en",
        acknowledgedDisclosure: true,
      }),
    ).rejects.toThrow(/already complete/i);
  });

  it("rotates and revokes Invite Links without retaining usable old tokens", async () => {
    const app = createProjectInterviewer(dependencies());
    const freelancer = await app.identities.createDevelopmentFreelancer({
      displayName: "Ada Freelancer",
    });
    const { room, inviteToken } = await app.rooms.create(freelancer, {
      title: "Website",
      clientLabel: "Client",
      projectDescription: "A public marketing site.",
      briefLanguage: "en",
      freelancerGuidance: "",
    });

    const rotated = await app.clientAccess.rotateInvite(freelancer, room.id);
    await expect(
      app.clientAccess.resolveInvite(inviteToken, { deviceId: "old-device" }),
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect(rotated.inviteVersion).toBe(2);

    await app.clientAccess.revokeInvite(freelancer, room.id);
    await expect(
      app.clientAccess.resolveInvite(rotated.inviteToken, {
        deviceId: "new-device",
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("isolates every Project Room operation to its resolved actor", async () => {
    const app = createProjectInterviewer(dependencies());
    const ada = await app.identities.createDevelopmentFreelancer({
      displayName: "Ada",
    });
    const grace = await app.identities.createDevelopmentFreelancer({
      displayName: "Grace",
    });
    const adaRoom = await app.rooms.create(ada, {
      title: "Ada Room",
      clientLabel: "A",
      projectDescription: "Ada project.",
      briefLanguage: "en",
      freelancerGuidance: "",
    });

    await expect(app.rooms.get(grace, adaRoom.room.id)).rejects.toBeInstanceOf(
      AuthorizationError,
    );
    expect(await app.rooms.get(ada, adaRoom.room.id)).toMatchObject({
      id: adaRoom.room.id,
    });

    await expect(
      app.rooms.get(
        {
          kind: "client",
          roomId: adaRoom.room.id,
          deviceId: "forged",
          inviteVersion: 1,
          sessionId: "forged",
        },
        adaRoom.room.id,
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      app.rooms.list(
        {
          kind: "freelancer",
          freelancerId: ada.freelancerId,
          sessionId: "forged",
        },
        {},
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("lists rooms by search and phase with a current next action", async () => {
    const app = createProjectInterviewer(dependencies());
    const freelancer = await app.identities.createDevelopmentFreelancer({
      displayName: "Ada",
    });
    await app.rooms.create(freelancer, {
      title: "Mobile Checkout",
      clientLabel: "Alpine",
      projectDescription: "Checkout replacement.",
      briefLanguage: "en",
      freelancerGuidance: "",
    });
    await app.rooms.create(freelancer, {
      title: "CRM Integration",
      clientLabel: "Beacon",
      projectDescription: "Synchronize contacts.",
      briefLanguage: "en",
      freelancerGuidance: "",
    });

    expect(
      await app.rooms.list(freelancer, {
        search: "alpine",
        phase: "setup",
      }),
    ).toEqual([
      expect.objectContaining({
        title: "Mobile Checkout",
        nextAction: "Share Invite Link",
      }),
    ]);
  });
});
