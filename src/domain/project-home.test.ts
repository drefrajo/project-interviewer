import { describe, expect, it } from "vitest";
import {
  AuthorizationError,
  createProjectInterviewer,
  ValidationError,
  type ProjectInterviewerDependencies,
} from "./project-interviewer";

const createDependencies = (
  overrides: Partial<ProjectInterviewerDependencies> = {},
): ProjectInterviewerDependencies => {
  let id = 0;
  let token = 0;
  let now = 1_800_000_000_000;
  return {
    ids: {
      next: (prefix) => `${prefix}_${++id}`,
      inviteToken: () => `invite-${++token}`,
      deviceId: () => "device",
    },
    clock: { now: () => ++now },
    inviteTokens: { hash: async (value) => `digest:${value}` },
    ...overrides,
  };
};

const createRoomWithClient = async () => {
  const application = createProjectInterviewer(createDependencies());
  const freelancer =
    await application.identities.createDevelopmentFreelancer({
      displayName: "Ada",
    });
  const created = await application.rooms.create(freelancer, {
    title: "Alpine Portal",
    clientLabel: "Alpine",
    projectDescription: "A self-service portal.",
    briefLanguage: "en",
    freelancerGuidance: "",
  });
  const access = await application.clientAccess.resolveInvite(
    created.inviteToken,
    { deviceId: "client-device" },
  );
  await application.clientAccess.onboard(access.actor, {
    displayName: "Casey",
    interviewLanguage: "en",
    acknowledgedDisclosure: true,
  });
  return {
    application,
    freelancer,
    client: access.actor,
    room: created.room,
  };
};

describe("Project Home public service", () => {
  it("shows Freelancer-managed non-secret Shared Resources to the Client immediately", async () => {
    const { application, freelancer, client, room } =
      await createRoomWithClient();

    const created = await application.projectHome.resources.create(
      freelancer,
      room.id,
      {
        label: "Staging",
        url: "https://staging.example.test",
        note: "Use the shared demo data.",
        accountIdentifier: "casey@example.test",
      },
    );

    expect(
      await application.projectHome.resources.list(client, room.id),
    ).toEqual([
      expect.objectContaining({
        id: created.id,
        label: "Staging",
        url: "https://staging.example.test",
        note: "Use the shared demo data.",
        accountIdentifier: "casey@example.test",
        order: 0,
      }),
    ]);
    await expect(
      application.projectHome.resources.create(client, room.id, {
        label: "Client edit",
        note: "Must not be accepted.",
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      application.projectHome.resources.create(freelancer, room.id, {
        label: "Production token",
        note: "API_KEY=sk-live-0123456789abcdef",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      application.projectHome.resources.create(freelancer, room.id, {
        label: "Password in URL",
        url: "https://alice:hunter2@example.test/dashboard",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      application.projectHome.resources.create(freelancer, room.id, {
        label: "Token in URL",
        url: "https://example.test/dashboard?access_token=opaque",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("refreshes Shared Resources from the persisted local boundary across application instances", async () => {
    let persisted:
      | ReturnType<
          ReturnType<typeof createProjectInterviewer>["inspectState"]
        >
      | undefined;
    const first = createProjectInterviewer(
      createDependencies({
        loadLatestState: () => persisted,
        persist: (snapshot) => {
          persisted = structuredClone(snapshot);
        },
      }),
    );
    const freelancer =
      await first.identities.createDevelopmentFreelancer({
        displayName: "Ada",
      });
    const created = await first.rooms.create(freelancer, {
      title: "Two local tabs",
      clientLabel: "Alpine",
      projectDescription: "Local state remains live.",
      briefLanguage: "en",
      freelancerGuidance: "",
    });
    const second = createProjectInterviewer(
      createDependencies({
        initialState: persisted!,
        loadLatestState: () => persisted,
        persist: (snapshot) => {
          persisted = structuredClone(snapshot);
        },
      }),
    );
    const access = await second.clientAccess.resolveInvite(
      created.inviteToken,
      { deviceId: "second-tab-client" },
    );
    await second.clientAccess.onboard(access.actor, {
      displayName: "Casey",
      interviewLanguage: "en",
      acknowledgedDisclosure: true,
    });

    await first.projectHome.resources.create(
      freelancer,
      created.room.id,
      {
        label: "Cross-tab handover",
        note: "Visible without rebuilding the Client application.",
      },
    );

    expect(
      await second.projectHome.resources.list(
        access.actor,
        created.room.id,
      ),
    ).toEqual([
      expect.objectContaining({ label: "Cross-tab handover" }),
    ]);
    await first.projectHome.lifecycle.delete(
      freelancer,
      created.room.id,
    );
    await expect(
      second.interviews.start(access.actor, created.room.id),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("updates, reorders, and removes Shared Resources within one Project Room", async () => {
    const { application, freelancer, client, room } =
      await createRoomWithClient();
    const staging = await application.projectHome.resources.create(
      freelancer,
      room.id,
      {
        label: "Staging",
        url: "https://staging.example.test",
      },
    );
    const handbook = await application.projectHome.resources.create(
      freelancer,
      room.id,
      {
        label: "Handbook",
        note: "Read before reviewing the build.",
      },
    );

    await application.projectHome.resources.update(
      freelancer,
      room.id,
      staging.id,
      {
        label: "Staging application",
        url: "https://staging.example.test",
        note: "Demo data resets nightly.",
      },
    );
    await application.projectHome.resources.reorder(
      freelancer,
      room.id,
      [handbook.id, staging.id],
    );

    expect(
      (await application.projectHome.resources.list(client, room.id)).map(
        ({ label, order }) => [label, order],
      ),
    ).toEqual([
      ["Handbook", 0],
      ["Staging application", 1],
    ]);

    await application.projectHome.resources.remove(
      freelancer,
      room.id,
      handbook.id,
    );
    expect(
      await application.projectHome.resources.list(client, room.id),
    ).toEqual([
      expect.objectContaining({
        id: staging.id,
        order: 0,
      }),
    ]);
    await expect(
      application.projectHome.resources.remove(
        client,
        room.id,
        staging.id,
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("archives a Project Room as a retained read-only Client home and restores its prior phase", async () => {
    const { application, freelancer, client, room } =
      await createRoomWithClient();
    await application.projectHome.resources.create(freelancer, room.id, {
      label: "Handover notes",
      note: "The approved operating notes remain available.",
    });
    await application.materials.continueWithoutFiles(
      freelancer,
      room.id,
    );

    await application.projectHome.lifecycle.archive(
      freelancer,
      room.id,
    );

    expect(await application.projectHome.get(client, room.id)).toMatchObject({
      room: { phase: "archived" },
      readOnly: true,
      nextAction: "view_archived_project_home",
      resources: [{ label: "Handover notes" }],
    });
    expect(
      await application.projectHome.get(freelancer, room.id),
    ).toMatchObject({
      room: { phase: "archived" },
      readOnly: false,
      nextAction: "restore_project_room",
    });
    await application.projectHome.resources.create(
      freelancer,
      room.id,
      {
        label: "Archived handover",
        note: "Shared Resources remain manageable in every phase.",
      },
    );
    expect(
      await application.projectHome.resources.list(client, room.id),
    ).toHaveLength(2);
    await expect(
      application.materials.continueWithoutFiles(client, room.id),
    ).rejects.toThrow(/read-only/i);
    await expect(
      application.interviews.start(client, room.id),
    ).rejects.toThrow(/read-only/i);

    await application.projectHome.lifecycle.restoreArchived(
      freelancer,
      room.id,
    );
    expect(await application.projectHome.get(client, room.id)).toMatchObject({
      room: { phase: "discovery" },
      readOnly: false,
      nextAction: "continue_discovery",
    });
    expect(
      application
        .inspectState()
        .auditEvents.filter(({ roomId }) => roomId === room.id)
        .map(({ action }) => action),
    ).toEqual(
      expect.arrayContaining([
        "project_room.archived",
        "project_room.restored_from_archive",
      ]),
    );
  });

  it("revokes a deleted room immediately, supports seven-day recovery, and purges only that room", async () => {
    let now = 1_800_000_000_000;
    const removedFiles: string[] = [];
    const application = createProjectInterviewer(
      createDependencies({
        clock: { now: () => now },
        materialFiles: {
          inspect: async (_reference, scope) => ({
            size: scope.claimedSize,
            contentType: scope.declaredContentType,
          }),
          read: async () => new Uint8Array(),
          remove: async (reference) => {
            removedFiles.push(reference);
          },
        },
      }),
    );
    const freelancer =
      await application.identities.createDevelopmentFreelancer({
        displayName: "Ada",
      });
    const deletedRoom = await application.rooms.create(freelancer, {
      title: "Delete me",
      clientLabel: "Alpine",
      projectDescription: "A temporary project.",
      briefLanguage: "en",
      freelancerGuidance: "",
    });
    const retainedRoom = await application.rooms.create(freelancer, {
      title: "Keep me",
      clientLabel: "Beacon",
      projectDescription: "A retained project.",
      briefLanguage: "en",
      freelancerGuidance: "",
    });
    const access = await application.clientAccess.resolveInvite(
      deletedRoom.inviteToken,
      { deviceId: "client-device" },
    );
    await application.projectHome.resources.create(
      freelancer,
      deletedRoom.room.id,
      { label: "Delete resource", note: "Delete this too." },
    );
    await application.projectHome.resources.create(
      freelancer,
      retainedRoom.room.id,
      { label: "Keep resource", note: "Keep this." },
    );
    await application.materials.accept(
      freelancer,
      deletedRoom.room.id,
      {
        name: "delete.txt",
        size: 5,
        declaredContentType: "text/plain",
        fileReference: "storage-delete",
        uploader: "freelancer",
      },
    );

    const deleted = await application.projectHome.lifecycle.delete(
      freelancer,
      deletedRoom.room.id,
    );

    expect(deleted).toMatchObject({
      deletedAt: now,
      purgeAfter: now + 7 * 24 * 60 * 60 * 1_000,
    });
    await expect(
      application.rooms.get(access.actor, deletedRoom.room.id),
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect(
      (await application.rooms.list(freelancer)).map(({ title }) => title),
    ).toEqual(["Keep me"]);
    expect(
      await application.projectHome.lifecycle.listRecentlyDeleted(
        freelancer,
      ),
    ).toEqual([
      expect.objectContaining({
        id: deletedRoom.room.id,
        title: "Delete me",
      }),
    ]);

    now += 2 * 24 * 60 * 60 * 1_000;
    await application.projectHome.lifecycle.recover(
      freelancer,
      deletedRoom.room.id,
    );
    expect(
      (
        await application.clientAccess.resolveInvite(
          deletedRoom.inviteToken,
          { deviceId: "restored-client-device" },
        )
      ).room.id,
    ).toBe(deletedRoom.room.id);
    expect(
      (await application.rooms.list(freelancer)).map(({ title }) => title),
    ).toEqual(["Delete me", "Keep me"]);

    await application.projectHome.lifecycle.delete(
      freelancer,
      deletedRoom.room.id,
    );
    now += 8 * 24 * 60 * 60 * 1_000;
    expect(
      await application.projectHome.lifecycle.purgeExpired(),
    ).toEqual([deletedRoom.room.id]);
    expect(removedFiles).toEqual(["storage-delete"]);
    const snapshot = application.inspectState();
    expect(
      Object.values(snapshot)
        .filter(Array.isArray)
        .flat()
        .filter(
          (record): record is { roomId: string } =>
            typeof record === "object" &&
            record !== null &&
            "roomId" in record,
        )
        .some(({ roomId }) => roomId === deletedRoom.room.id),
    ).toBe(false);
    expect(
      await application.projectHome.resources.list(
        freelancer,
        retainedRoom.room.id,
      ),
    ).toEqual([expect.objectContaining({ label: "Keep resource" })]);
  });

  it("reopens the existing Discovery Interview, preserves its plan and history, and invalidates only unapproved review state", async () => {
    const dependencies = createDependencies();
    const initialApplication = createProjectInterviewer(dependencies);
    const firstFreelancer =
      await initialApplication.identities.createDevelopmentFreelancer({
        displayName: "Ada",
      });
    const created = await initialApplication.rooms.create(
      firstFreelancer,
      {
        title: "Reopen discovery",
        clientLabel: "Alpine",
        projectDescription: "A portal.",
        briefLanguage: "en",
        freelancerGuidance: "",
      },
    );
    const snapshot = initialApplication.inspectState();
    snapshot.rooms[0]!.phase = "client_review";
    snapshot.interviewPlans.push({
      id: "plan-existing",
      roomId: created.room.id,
      profileId: "software-project",
      profileVersion: "software-project-v1",
      language: "en",
      coverageAreas: [
        {
          id: "scope",
          label: "Scope",
          rubric: "Clarify scope.",
          status: "partial",
          evidence: [],
          rationale: "Needs another pass.",
          openQuestions: ["Which workflows remain in scope?"],
          required: true,
        },
      ],
      knownRisks: [],
      openGoals: ["Clarify remaining scope."],
      model: "fixture",
      provider: "fixture",
      promptVersion: "software-project-interview-planner-v1",
      schemaVersion: "interview-plan-v1",
      createdAt: 1,
      updatedAt: 2,
    });
    snapshot.discoveryInterviews.push({
      id: "interview-existing",
      roomId: created.room.id,
      planId: "plan-existing",
      language: "en",
      status: "completed",
      operationStatus: "idle",
      answerCount: 1,
      unresolvedTopics: [],
      completionRationale: "Previously complete.",
      reviewerBlockers: [],
      usageReviewTriggered: false,
      createdAt: 1,
      updatedAt: 2,
    });
    snapshot.interviewTurns.push({
      id: "turn-existing",
      roomId: created.room.id,
      interviewId: "interview-existing",
      sequence: 1,
      question: {
        id: "question-existing",
        text: "What matters?",
        coverageAreaId: "scope",
        kind: "primary",
        reason: "Clarify scope.",
        askedAt: 1,
      },
      answer: "The client portal matters.",
      answerKind: "answer",
      idempotencyKey: "turn-1",
      contextPackRevisionId: null,
      contextPackRevision: null,
      acceptedAt: 2,
    });
    snapshot.reviewVersions.push(
      {
        id: "review-approved",
        roomId: created.room.id,
        sourceDraftId: "draft-1",
        version: 1,
        language: "en",
        status: "approved",
        sections: [],
        sentAt: 3,
        approval: {
          displayName: "Casey",
          deviceId: "client-device",
          approvedAt: 4,
          agreedRequirementIds: [],
        },
      },
      {
        id: "review-pending",
        roomId: created.room.id,
        sourceDraftId: "draft-2",
        version: 2,
        language: "en",
        status: "awaiting_client",
        sections: [],
        sentAt: 5,
      },
    );
    const application = createProjectInterviewer(
      createDependencies({ initialState: snapshot }),
    );
    const freelancer =
      await application.identities.resumeDevelopmentFreelancer(
        firstFreelancer.freelancerId,
      );

    await application.projectHome.lifecycle.reopenDiscovery(
      freelancer,
      created.room.id,
    );

    const reopened = application.inspectState();
    expect(reopened.rooms[0]!.phase).toBe("discovery");
    expect(reopened.discoveryInterviews).toEqual([
      expect.objectContaining({
        id: "interview-existing",
        planId: "plan-existing",
        status: "active",
        answerCount: 1,
        currentQuestion: expect.objectContaining({
          coverageAreaId: "scope",
          kind: "follow_up",
        }),
      }),
    ]);
    expect(reopened.interviewPlans[0]!.id).toBe("plan-existing");
    expect(reopened.interviewTurns[0]!.id).toBe("turn-existing");
    expect(
      reopened.reviewVersions.map(({ id, status }) => [id, status]),
    ).toEqual([
      ["review-approved", "approved"],
      ["review-pending", "invalidated"],
    ]);
    expect(
      reopened.auditEvents.map(({ action }) => action),
    ).toContain("interview.reopened");
    expect(
      (await application.projectHome.get(freelancer, created.room.id))
        .approvedVersions.map(({ id }) => id),
    ).toEqual(["review-approved"]);
  });

  it("orders the Freelancer Workspace by last activity with phase-aware next actions", async () => {
    let now = 100;
    const application = createProjectInterviewer(
      createDependencies({ clock: { now: () => now } }),
    );
    const freelancer =
      await application.identities.createDevelopmentFreelancer({
        displayName: "Ada",
      });
    const older = await application.rooms.create(freelancer, {
      title: "Older room",
      clientLabel: "Alpine",
      projectDescription: "First room.",
      briefLanguage: "en",
      freelancerGuidance: "",
    });
    now = 200;
    await application.rooms.create(freelancer, {
      title: "Newer room",
      clientLabel: "Beacon",
      projectDescription: "Second room.",
      briefLanguage: "en",
      freelancerGuidance: "",
    });
    now = 300;
    await application.projectHome.resources.create(
      freelancer,
      older.room.id,
      { label: "Latest note", note: "This is the newest activity." },
    );

    expect(
      (await application.rooms.list(freelancer)).map(
        ({ title, lastActivityAt, nextAction }) => ({
          title,
          lastActivityAt,
          nextAction,
        }),
      ),
    ).toEqual([
      {
        title: "Older room",
        lastActivityAt: 300,
        nextAction: "share_invite",
      },
      {
        title: "Newer room",
        lastActivityAt: 200,
        nextAction: "share_invite",
      },
    ]);
  });

  it("keeps an archived first visit archived after onboarding", async () => {
    const application = createProjectInterviewer(createDependencies());
    const freelancer =
      await application.identities.createDevelopmentFreelancer({
        displayName: "Ada",
      });
    const created = await application.rooms.create(freelancer, {
      title: "Archived before visit",
      clientLabel: "Alpine",
      projectDescription: "A retained room.",
      briefLanguage: "en",
      freelancerGuidance: "",
    });
    const access = await application.clientAccess.resolveInvite(
      created.inviteToken,
      { deviceId: "first-visit" },
    );
    await application.projectHome.lifecycle.archive(
      freelancer,
      created.room.id,
    );

    expect(
      (
        await application.clientAccess.onboard(access.actor, {
          displayName: "Casey",
          interviewLanguage: "en",
          acknowledgedDisclosure: true,
        })
      ).phase,
    ).toBe("archived");
  });

  it("uses configurable recovery timing and cancels every pending room operation on delete", async () => {
    const now = 5_000;
    const initial = createProjectInterviewer(
      createDependencies({ clock: { now: () => now } }),
    );
    const firstFreelancer =
      await initial.identities.createDevelopmentFreelancer({
        displayName: "Ada",
      });
    const created = await initial.rooms.create(firstFreelancer, {
      title: "Pending work",
      clientLabel: "Alpine",
      projectDescription: "Work is running.",
      briefLanguage: "en",
      freelancerGuidance: "",
    });
    const snapshot = initial.inspectState();
    snapshot.durableOperations.push({
      id: "material-operation",
      roomId: created.room.id,
      operationType: "file_processing",
      idempotencyKey: "material",
      status: "running",
      stage: "analyzing",
      attemptCount: 1,
      promptVersion: "fixture",
      schemaVersion: "fixture",
      createdAt: now,
      updatedAt: now,
    });
    snapshot.interviewOperations.push({
      id: "interview-operation",
      roomId: created.room.id,
      interviewId: "interview",
      operationType: "interview_turn",
      idempotencyKey: "interview",
      status: "running",
      stage: "reasoning",
      attemptCount: 1,
      promptVersion: "fixture",
      schemaVersion: "fixture",
      createdAt: now,
      updatedAt: now,
    });
    snapshot.briefOperations.push({
      id: "brief-operation",
      roomId: created.room.id,
      operationType: "brief_generation",
      idempotencyKey: "brief",
      status: "running",
      stage: "generating",
      attemptCount: 1,
      promptVersion: "software-project-brief-generator-v1",
      schemaVersion: "project-brief-v1",
      createdAt: now,
      updatedAt: now,
    });
    const application = createProjectInterviewer(
      createDependencies({
        clock: { now: () => now },
        deletionRecoveryMs: 1_000,
        initialState: snapshot,
      }),
    );
    const freelancer =
      await application.identities.resumeDevelopmentFreelancer(
        firstFreelancer.freelancerId,
      );

    expect(
      await application.projectHome.lifecycle.delete(
        freelancer,
        created.room.id,
      ),
    ).toMatchObject({ deletedAt: 5_000, purgeAfter: 6_000 });
    const deleted = application.inspectState();
    expect(deleted.durableOperations[0]).toMatchObject({
      status: "cancelled",
      errorCode: "project_room_deleted",
    });
    expect(deleted.interviewOperations[0]).toMatchObject({
      status: "cancelled",
      errorCode: "project_room_deleted",
    });
    expect(deleted.briefOperations[0]).toMatchObject({
      status: "cancelled",
      errorCode: "project_room_deleted",
    });
  });
});
