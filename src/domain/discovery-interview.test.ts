import { describe, expect, it, vi } from "vitest";
import {
  createProjectInterviewer,
  type ProjectInterviewerDependencies,
} from "./project-interviewer";
import type {
  CoverageArea,
  InterviewAgentDelta,
  InterviewAdapters,
} from "./discovery-interview";

const requiredCoverageAreas = (): CoverageArea[] =>
  [
    ["goals-users", "Goals and users"],
    ["scope", "Scope"],
    ["constraints", "Constraints"],
    ["success", "Success"],
    ["delivery", "Delivery"],
  ].map(([id, label]) => ({
    id: id!,
    label: label!,
    rubric: `Establish ${label!.toLocaleLowerCase()}.`,
    status: "uncovered" as const,
    evidence: [],
    rationale: "Not established yet.",
    openQuestions: [`What should we establish about ${label}?`],
    required: true,
  }));

const sufficientCoverageUpdates = (turnId: string) =>
  requiredCoverageAreas().map(({ id }) => ({
    id,
    status: "sufficient" as const,
    evidence: [{ type: "turn" as const, turnId }],
    rationale: "Required coverage is sufficient.",
    openQuestions: [],
  }));

const createInterviewHarness = async (overrides?: {
  planner?: InterviewAdapters["planner"];
  agent?: InterviewAdapters["agent"];
  reviewer?: InterviewAdapters["reviewer"];
  language?: "en" | "de";
}) => {
  let id = 0;
  let now = 1_900_000_000_000;
  const dependencies = {
    ids: {
      next: (prefix: string) => `${prefix}_${++id}`,
      inviteToken: () => `invite_${id}`,
      deviceId: () => "generated-device",
    },
    clock: { now: () => ++now },
    inviteTokens: { hash: async (token: string) => `hash:${token}` },
    materialFiles: {
      inspect: async (
        _reference: string,
        scope: {
          claimedSize: number;
          declaredContentType: string;
        },
      ) => ({
        size: scope.claimedSize,
        contentType: scope.declaredContentType,
      }),
      read: async () =>
        new TextEncoder().encode(
          "Launch in October with a fixed budget of EUR 20,000.",
        ),
      remove: async () => undefined,
    },
    contentInspector: {
      detect: async ({
        declaredContentType,
      }: {
        declaredContentType: string;
      }) => declaredContentType,
    },
    parser: {
      extract: async () => ({
        language: "en",
        method: "plain-text",
        segments: [
          {
            text: "Launch in October with a fixed budget of EUR 20,000.",
            locator: {
              kind: "paragraph",
              label: "Paragraph 1",
              paragraph: 1,
            },
          },
        ],
      }),
    },
    fileAnalyzer: {
      analyze: async () => ({
        summary: "The source sets an October launch and EUR 20,000 budget.",
        summaryLanguage: "en",
        primaryCategory: "timeline",
        secondaryCategories: ["commercial"],
        confidence: 0.95,
        language: "en",
        signals: [
          {
            text: "October launch and fixed budget.",
            locator: {
              kind: "paragraph",
              label: "Paragraph 1",
              paragraph: 1,
            },
          },
        ],
        model: "analyzer-fixture",
        provider: "test",
      }),
    },
    embeddings: {
      embed: async (texts: string[]) => texts.map(() => [1, 0]),
    },
    interviewPlanner: overrides?.planner ?? {
      plan: async () => ({
        profileId: "software-project",
        profileVersion: "software-project-v1",
        coverageAreas: requiredCoverageAreas(),
        knownRisks: [],
        openGoals: ["Establish goals and users"],
        firstQuestion: {
          text: "What should improve for the people using this product?",
          coverageAreaId: "goals-users",
          kind: "primary",
          reason: "No evidence establishes the desired outcome.",
        },
        model: "planner-fixture",
        provider: "test",
        usage: {
          inputTokens: 12,
          outputTokens: 8,
          estimatedCostUsd: 0.001,
        },
      }),
    },
    interviewAgent: overrides?.agent ?? {
      advance: async ({ acceptedTurn }) => ({
        coverageUpdates: [
          {
            id: "goals-users",
            status: "sufficient",
            evidence: [{ type: "turn", turnId: acceptedTurn.id }],
            rationale: "The Client established the desired outcome.",
            openQuestions: [],
          },
        ],
        findings: [
          {
            type: "candidate_requirement",
            statement: "The Client needs a simpler customer workflow.",
            sources: [{ type: "turn", turnId: acceptedTurn.id }],
          },
        ],
        unresolvedTopics: [],
        nextQuestion: {
          text: "Which outcome would make the first release successful?",
          coverageAreaId: "goals-users",
          kind: "primary",
          reason: "Clarify measurable success.",
        },
        completionAssessment: {
          proposeCompletion: false,
          rationale: "Success criteria remain open.",
        },
        model: "agent-fixture",
        provider: "test",
        usage: {
          inputTokens: 20,
          outputTokens: 10,
          estimatedCostUsd: 0.002,
        },
      }),
    },
    interviewReviewer: overrides?.reviewer,
  } as unknown as ProjectInterviewerDependencies;
  const app = createProjectInterviewer(dependencies);
  const freelancer = await app.identities.createDevelopmentFreelancer({
    displayName: "Ada",
  });
  const created = await app.rooms.create(freelancer, {
    title: "Portal",
    clientLabel: "Alpine",
    projectDescription: "A Client portal.",
    briefLanguage: "en",
    freelancerGuidance: "",
  });
  await app.materials.continueWithoutFiles(freelancer, created.room.id);
  const access = await app.clientAccess.resolveInvite(created.inviteToken, {
    deviceId: "client-device-a",
  });
  await app.clientAccess.onboard(access.actor, {
    displayName: "Chris",
    interviewLanguage: overrides?.language ?? "en",
    acknowledgedDisclosure: true,
  });
  return {
    app,
    freelancer,
    room: created.room,
    client: access.actor,
    inviteToken: created.inviteToken,
  };
};

describe("Discovery Interview public service", () => {
  it("claims the Responding Device only when Start creates the plan and first question", async () => {
    const { app, room, client } = await createInterviewHarness();

    expect(await app.interviews.get(client, room.id)).toBeNull();

    const started = await app.interviews.start(client, room.id);

    expect(started).toMatchObject({
      status: "active",
      respondingDevice: true,
      plan: {
        profileId: "software-project",
        profileVersion: "software-project-v1",
      },
      currentQuestion: {
        text: "What should improve for the people using this product?",
        coverageAreaId: "goals-users",
      },
      operation: {
        operationType: "interview_planning",
        status: "succeeded",
        attemptCount: 1,
        inputTokens: 12,
        outputTokens: 8,
      },
    });
  });

  it("recovers a failed planning provider without losing the claimed interview", async () => {
    const fallbackPlan = {
      profileId: "software-project" as const,
      profileVersion: "software-project-v1" as const,
      coverageAreas: requiredCoverageAreas(),
      knownRisks: [],
      openGoals: ["Establish goals"],
      firstQuestion: {
        text: "What should improve?",
        coverageAreaId: "goals-users",
        kind: "primary" as const,
        reason: "Goals remain open.",
      },
      model: "planner-fixture",
      provider: "test",
    };
    const planner = {
      plan: vi
        .fn<NonNullable<InterviewAdapters["planner"]>["plan"]>()
        .mockRejectedValueOnce(new Error("provider unavailable"))
        .mockResolvedValue(fallbackPlan),
    };
    const { app, room, client } = await createInterviewHarness({
      planner,
    });

    await expect(
      app.interviews.start(client, room.id),
    ).rejects.toThrow(/planning failed/i);
    expect(await app.interviews.get(client, room.id)).toMatchObject({
      status: "retryable",
      respondingDevice: true,
    });
    expect(
      (await app.interviews.retryPending(client, room.id)).status,
    ).toBe("active");
    expect(planner.plan).toHaveBeenCalledTimes(2);
  });

  it("repairs a plan that omits required profile coverage before committing it", async () => {
    const completePlan = {
      profileId: "software-project" as const,
      profileVersion: "software-project-v1" as const,
      coverageAreas: requiredCoverageAreas(),
      knownRisks: [],
      openGoals: ["Establish goals"],
      firstQuestion: {
        text: "What should improve?",
        coverageAreaId: "goals-users",
        kind: "primary" as const,
        reason: "Goals remain open.",
      },
      model: "planner-fixture",
      provider: "test",
    };
    const planner = {
      plan: vi
        .fn<NonNullable<InterviewAdapters["planner"]>["plan"]>()
        .mockResolvedValueOnce({
          ...completePlan,
          coverageAreas: requiredCoverageAreas().slice(0, 1),
        })
        .mockResolvedValueOnce(completePlan),
    };
    const { app, room, client } = await createInterviewHarness({
      planner,
    });

    const started = await app.interviews.start(client, room.id);
    expect(started.status).toBe("active");
    expect(planner.plan).toHaveBeenCalledTimes(2);
    expect(planner.plan.mock.calls[1]?.[0].repairErrors).toEqual([
      "Interview Plan does not match its schema.",
    ]);
    expect(started.operation?.attemptCount).toBe(2);
  });

  it("rejects planner evidence that is not authorized by the current Context Pack", async () => {
    const completePlan = {
      profileId: "software-project" as const,
      profileVersion: "software-project-v1" as const,
      coverageAreas: requiredCoverageAreas(),
      knownRisks: [],
      openGoals: ["Establish goals"],
      firstQuestion: {
        text: "What should improve?",
        coverageAreaId: "goals-users",
        kind: "primary" as const,
        reason: "Goals remain open.",
      },
      model: "planner-fixture",
      provider: "test",
    };
    const invalidAreas = requiredCoverageAreas();
    invalidAreas[0] = {
      ...invalidAreas[0]!,
      status: "partial",
      evidence: [
        {
          type: "material" as const,
          materialId: "cross-room-material",
          locator: {
            kind: "paragraph" as const,
            label: "Paragraph 1",
            paragraph: 1,
          },
        },
      ],
    };
    const planner = {
      plan: vi
        .fn<NonNullable<InterviewAdapters["planner"]>["plan"]>()
        .mockResolvedValueOnce({
          ...completePlan,
          coverageAreas: invalidAreas,
        })
        .mockResolvedValueOnce(completePlan),
    };
    const { app, room, client } = await createInterviewHarness({
      planner,
    });

    const started = await app.interviews.start(client, room.id);
    expect(started.status).toBe("active");
    expect(planner.plan.mock.calls[1]?.[0].repairErrors).toEqual([
      "Coverage Area does not match its schema.",
    ]);
    expect(
      app.inspectState().interviewPlans[0]?.coverageAreas[0]?.evidence,
    ).toEqual([]);
  });

  it("keeps other devices read-only until an acknowledged takeover", async () => {
    const { app, room, client, inviteToken } =
      await createInterviewHarness();
    const started = await app.interviews.start(client, room.id);
    const observerAccess = await app.clientAccess.resolveInvite(
      inviteToken,
      { deviceId: "client-device-b" },
    );

    expect(
      await app.interviews.get(observerAccess.actor, room.id),
    ).toMatchObject({ respondingDevice: false });
    await expect(
      app.interviews.start(observerAccess.actor, room.id),
    ).rejects.toThrow(/another device/i);
    await expect(
      app.interviews.takeover(observerAccess.actor, room.id, {
        acknowledgedDraftLoss: false,
      }),
    ).rejects.toThrow(/acknowledg/i);

    const takenOver = await app.interviews.takeover(
      observerAccess.actor,
      room.id,
      { acknowledgedDraftLoss: true },
    );

    expect(takenOver).toMatchObject({
      respondingDevice: true,
      leaseVersion: 2,
    });
    await expect(
      app.interviews.submitAnswer(client, room.id, {
        questionId: started.currentQuestion!.id,
        answer: "It should be simpler.",
        idempotencyKey: "answer-old-device",
        contextPackRevisionId: (
          await app.contextPacks.latest(client, room.id)
        )?.id ?? null,
      }),
    ).rejects.toThrow(/response permission/i);
  });

  it("persists the accepted answer before AI work and commits exactly one idempotent next question", async () => {
    let resolveAgent:
      | ((delta: InterviewAgentDelta) => void)
      | undefined;
    const agentStarted = vi.fn();
    const agent = {
      advance: async ({ acceptedTurn }) => {
        agentStarted();
        return new Promise<InterviewAgentDelta>((resolve) => {
          resolveAgent = resolve;
        }).then((delta) => ({
          ...delta,
          findings: delta.findings.map((finding) => ({
            ...finding,
            sources: [{ type: "turn", turnId: acceptedTurn.id }],
          })),
          coverageUpdates: delta.coverageUpdates.map((update) => ({
            ...update,
            evidence: [{ type: "turn", turnId: acceptedTurn.id }],
          })),
        }));
      },
    } satisfies NonNullable<InterviewAdapters["agent"]>;
    const { app, room, client } = await createInterviewHarness({
      agent,
    });
    const started = await app.interviews.start(client, room.id);
    const contextPack = await app.contextPacks.latest(client, room.id);
    const input = {
      questionId: started.currentQuestion!.id,
      answer: "Customers should finish registration without support.",
      idempotencyKey: "answer-1",
      contextPackRevisionId: contextPack?.id ?? null,
    };

    const firstCall = app.interviews.submitAnswer(
      client,
      room.id,
      input,
    );
    await vi.waitFor(() => expect(agentStarted).toHaveBeenCalledOnce());
    const acceptedTurn = structuredClone(
      app.inspectState().interviewTurns[0],
    );
    expect(app.inspectState()).toMatchObject({
      interviewTurns: [
        {
          answer: input.answer,
          contextPackRevisionId: contextPack?.id,
        },
      ],
      interviewOperations: expect.arrayContaining([
        expect.objectContaining({
          status: "running",
          operationType: "interview_turn",
        }),
      ]),
    });
    const repeatedCall = app.interviews.submitAnswer(
      client,
      room.id,
      input,
    );
    await expect(
      app.interviews.retryPending(client, room.id),
    ).rejects.toThrow(/still running/i);
    await expect(
      app.interviews.correct(client, room.id, {
        turnId: app.inspectState().interviewTurns[0]!.id,
        correctedAnswer: "A corrected answer.",
        reason: "Correction during processing.",
      }),
    ).rejects.toThrow(/finish processing/i);
    await expect(
      app.interviews.finishEarly(client, room.id, {
        confirmed: true,
      }),
    ).rejects.toThrow(/operation is running/i);
    resolveAgent?.({
      coverageUpdates: [
        {
          id: "goals-users",
          status: "sufficient",
          evidence: [],
          rationale: "The desired outcome is established.",
          openQuestions: [],
        },
      ],
      findings: [
        {
          type: "candidate_requirement",
          statement: "Customers need self-service registration.",
          sources: [],
        },
      ],
      unresolvedTopics: [],
      nextQuestion: {
        text: "How will you measure that improvement?",
        coverageAreaId: "goals-users",
        kind: "primary",
        reason: "Establish success evidence.",
      },
      completionAssessment: {
        proposeCompletion: false,
        rationale: "Success measurement remains open.",
      },
      model: "agent-fixture",
      provider: "test",
    });

    const [firstResult, repeatedResult] = await Promise.all([
      firstCall,
      repeatedCall,
    ]);
    expect(firstResult.currentQuestion).toEqual(
      repeatedResult.currentQuestion,
    );
    expect(firstResult.turns).toHaveLength(1);
    expect(firstResult.turns[0]).toEqual(acceptedTurn);
    expect(firstResult.findings).toEqual([
      expect.objectContaining({
        type: "candidate_requirement",
        sources: [{ type: "turn", turnId: firstResult.turns[0]!.id }],
      }),
    ]);
    expect(agentStarted).toHaveBeenCalledOnce();
  });

  it("makes interrupted reasoning retryable and records corrections without rewriting accepted turns", async () => {
    const agent = {
      advance: vi
        .fn<NonNullable<InterviewAdapters["agent"]>["advance"]>()
        .mockRejectedValueOnce(new Error("provider unavailable"))
        .mockImplementation(async ({ acceptedTurn }) => ({
          coverageUpdates: [
            {
              id: "goals-users",
              status: "sufficient",
              evidence: [{ type: "turn", turnId: acceptedTurn.id }],
              rationale: "The outcome is now supported.",
              openQuestions: [],
            },
          ],
          findings: [
            {
              type: "candidate_requirement",
              statement: "Customers need self-service registration.",
              sources: [{ type: "turn", turnId: acceptedTurn.id }],
            },
          ],
          unresolvedTopics: [],
          nextQuestion: {
            text: "What constraints shape the first release?",
            coverageAreaId: "goals-users",
            kind: "primary",
            reason: "Constraints remain open.",
          },
          completionAssessment: {
            proposeCompletion: false,
            rationale: "More coverage is needed.",
          },
          model: "agent-fixture",
          provider: "test",
        })),
    } satisfies NonNullable<InterviewAdapters["agent"]>;
    const { app, room, client, freelancer } =
      await createInterviewHarness({
        agent,
      });
    const started = await app.interviews.start(client, room.id);
    const contextPack = await app.contextPacks.latest(client, room.id);

    const retryable = await app.interviews.submitAnswer(
      client,
      room.id,
      {
        questionId: started.currentQuestion!.id,
        answer: "Customers should register without calling support.",
        idempotencyKey: "answer-retry",
        contextPackRevisionId: contextPack?.id ?? null,
      },
    );
    expect(retryable).toMatchObject({
      status: "retryable",
      operationStatus: "retryable",
    });
    expect(retryable.turns).toHaveLength(1);
    const lateMaterial = await app.materials.accept(
      freelancer,
      room.id,
      {
        name: "Late.txt",
        size: 54,
        declaredContentType: "text/plain",
        fileReference: "late-during-retry",
        uploader: "freelancer",
      },
    );
    await app.materials.process(
      freelancer,
      room.id,
      lateMaterial.id,
    );

    const retried = await app.interviews.retryPending(
      client,
      room.id,
    );
    expect(
      agent.advance.mock.calls.map(
        ([input]) => input.contextPack?.id,
      ),
    ).toEqual([contextPack?.id, contextPack?.id]);
    const acceptedTurn = structuredClone(retried.turns[0]);
    const corrected = await app.interviews.correct(client, room.id, {
      turnId: acceptedTurn!.id,
      correctedAnswer:
        "Customers and internal staff both need self-service.",
      reason: "I omitted a user group.",
    });

    expect(corrected.turns[0]).toEqual(acceptedTurn);
    expect(corrected.corrections).toEqual([
      expect.objectContaining({
        turnId: acceptedTurn!.id,
        correctedAnswer:
          "Customers and internal staff both need self-service.",
      }),
    ]);
    expect(corrected.findings[0]).toMatchObject({
      status: "needs_reassessment",
    });
    expect(agent.advance).toHaveBeenCalledTimes(2);
  });

  it("requires reviewer clearance, an anything-else turn, and explicit Client confirmation", async () => {
    const agent = {
      advance: async ({
        acceptedTurn,
        corrections,
        findings,
      }) => ({
        coverageUpdates: sufficientCoverageUpdates(acceptedTurn.id),
        findings: [
          {
            type: "candidate_requirement" as const,
            statement: `Client answer: ${acceptedTurn.answer}`,
            sources: [
              { type: "turn" as const, turnId: acceptedTurn.id },
            ],
          },
        ],
        findingStatusUpdates: findings
          .filter(({ status }) => status === "needs_reassessment")
          .map((finding) => ({
            id: finding.id,
            status: "resolved" as const,
            sources: [
              ...finding.sources,
              ...(corrections[0]
                ? [
                    {
                      type: "correction" as const,
                      correctionId: corrections[0].id,
                    },
                  ]
                : []),
            ],
          })),
        unresolvedTopics: [],
        completionAssessment: {
          proposeCompletion: true,
          rationale: "The interview appears sufficient.",
        },
        model: "agent-fixture",
        provider: "test",
      }),
    } satisfies NonNullable<InterviewAdapters["agent"]>;
    const reviewer = {
      review: vi.fn(async () => ({
        blockers: [],
        weakCoverageAreaIds: [],
        rationale: "No material blockers remain.",
        model: "reviewer-fixture",
        provider: "test",
      })),
    } satisfies NonNullable<InterviewAdapters["reviewer"]>;
    const { app, room, client } = await createInterviewHarness({
      agent,
      reviewer,
    });
    const started = await app.interviews.start(client, room.id);
    const contextPack = await app.contextPacks.latest(client, room.id);
    const finalCheck = await app.interviews.submitAnswer(
      client,
      room.id,
      {
        questionId: started.currentQuestion!.id,
        answer: "Reduce registration support requests by half.",
        idempotencyKey: "answer-complete",
        contextPackRevisionId: contextPack?.id ?? null,
      },
    );

    expect(finalCheck.currentQuestion).toMatchObject({
      kind: "final_anything_else",
    });
    const awaiting = await app.interviews.submitAnswer(
      client,
      room.id,
      {
        questionId: finalCheck.currentQuestion!.id,
        answer: "Nothing else.",
        idempotencyKey: "answer-final-check",
        contextPackRevisionId: contextPack?.id ?? null,
      },
    );
    expect(awaiting.status).toBe("awaiting_confirmation");
    expect(awaiting.findings).toHaveLength(2);

    const invalidated = await app.interviews.correct(
      client,
      room.id,
      {
        turnId: awaiting.turns[0]!.id,
        correctedAnswer:
          "Reduce registration support requests by two thirds.",
        reason: "The success target changed.",
      },
    );
    expect(invalidated).toMatchObject({
      status: "active",
      currentQuestion: {
        kind: "follow_up",
        reason:
          "A correction invalidated the previous completion clearance.",
      },
      reviewerBlockers: [
        "A Client correction requires Agent reassessment and Reviewer clearance.",
      ],
    });
    await expect(
      app.interviews.confirmCompletion(client, room.id, {
        confirmed: true,
      }),
    ).rejects.toThrow(/not ready/i);

    const repeatedFinalCheck =
      await app.interviews.submitAnswer(client, room.id, {
        questionId: invalidated.currentQuestion!.id,
        answer: "The revised target is authoritative.",
        idempotencyKey: "answer-after-correction",
        contextPackRevisionId: contextPack?.id ?? null,
      });
    expect(repeatedFinalCheck.currentQuestion).toMatchObject({
      kind: "final_anything_else",
    });
    expect(
      repeatedFinalCheck.findings.every(
        ({ status }) => status !== "needs_reassessment",
      ),
    ).toBe(true);
    expect(repeatedFinalCheck.findings[0]?.sources).toEqual(
      expect.arrayContaining([
        {
          type: "correction",
          correctionId: invalidated.corrections[0]!.id,
        },
      ]),
    );
    const clearedAgain = await app.interviews.submitAnswer(
      client,
      room.id,
      {
        questionId: repeatedFinalCheck.currentQuestion!.id,
        answer: "Nothing else.",
        idempotencyKey: "answer-final-check-again",
        contextPackRevisionId: contextPack?.id ?? null,
      },
    );
    expect(clearedAgain.status).toBe("awaiting_confirmation");

    const completed = await app.interviews.confirmCompletion(
      client,
      room.id,
      { confirmed: true },
    );
    expect(completed.status).toBe("completed");
    expect(reviewer.review).toHaveBeenCalledTimes(4);
    expect(
      (await app.rooms.get(client, room.id)).phase,
    ).toBe("freelancer_review");
    await expect(
      app.interviews.pause(client, room.id),
    ).rejects.toThrow(/only an active/i);
    await expect(
      app.interviews.resume(client, room.id),
    ).rejects.toThrow(/only a paused/i);
  });

  it("commits no partial delta when review fails and retries the same accepted turn", async () => {
    const agent = {
      advance: async ({ acceptedTurn }) => ({
        coverageUpdates: sufficientCoverageUpdates(acceptedTurn.id),
        findings: [
          {
            type: "candidate_requirement" as const,
            statement: "Customers need self-service registration.",
            sources: [{ type: "turn" as const, turnId: acceptedTurn.id }],
          },
        ],
        unresolvedTopics: [],
        completionAssessment: {
          proposeCompletion: true,
          rationale: "Coverage appears sufficient.",
        },
        model: "agent-fixture",
        provider: "test",
      }),
    } satisfies NonNullable<InterviewAdapters["agent"]>;
    const reviewer = {
      review: vi
        .fn<NonNullable<InterviewAdapters["reviewer"]>["review"]>()
        .mockRejectedValueOnce(new Error("reviewer unavailable"))
        .mockResolvedValue({
          blockers: [],
          weakCoverageAreaIds: [],
          rationale: "No blocker remains.",
          model: "reviewer-fixture",
          provider: "test",
        }),
    };
    const { app, room, client } = await createInterviewHarness({
      agent,
      reviewer,
    });
    const started = await app.interviews.start(client, room.id);
    const contextPack = await app.contextPacks.latest(client, room.id);

    const retryable = await app.interviews.submitAnswer(
      client,
      room.id,
      {
        questionId: started.currentQuestion!.id,
        answer: "Customers should register without support.",
        idempotencyKey: "review-retry",
        contextPackRevisionId: contextPack?.id ?? null,
      },
    );
    expect(retryable).toMatchObject({
      status: "retryable",
      answerCount: 0,
      findings: [],
    });
    expect(
      app.inspectState().interviewPlans[0]?.coverageAreas[0],
    ).toMatchObject({ status: "uncovered", evidence: [] });
    const recovered = await app.interviews.retryPending(
      client,
      room.id,
    );
    expect(recovered).toMatchObject({
      status: "active",
      answerCount: 1,
      currentQuestion: { kind: "final_anything_else" },
    });
    expect(reviewer.review).toHaveBeenCalledTimes(2);
  });

  it("repairs an Agent completion proposal that conflicts with required coverage", async () => {
    const incompleteDelta = (turnId: string) => ({
      coverageUpdates: [
        {
          id: "goals-users",
          status: "sufficient" as const,
          evidence: [{ type: "turn" as const, turnId }],
          rationale: "Only goals are covered.",
          openQuestions: [],
        },
      ],
      findings: [],
      unresolvedTopics: [],
      completionAssessment: {
        proposeCompletion: true,
        rationale: "Incorrectly proposed completion.",
      },
      model: "agent-fixture",
      provider: "test",
    });
    const agent = {
      advance: vi
        .fn<NonNullable<InterviewAdapters["agent"]>["advance"]>()
        .mockImplementationOnce(async ({ acceptedTurn }) =>
          incompleteDelta(acceptedTurn.id),
        )
        .mockImplementationOnce(async ({ acceptedTurn }) => ({
          ...incompleteDelta(acceptedTurn.id),
          coverageUpdates: sufficientCoverageUpdates(acceptedTurn.id),
          completionAssessment: {
            proposeCompletion: true,
            rationale: "All required coverage is now sufficient.",
          },
        })),
    };
    const reviewer = {
      review: vi.fn(async () => ({
        blockers: [],
        weakCoverageAreaIds: [],
        rationale: "No blocker remains.",
        model: "reviewer-fixture",
        provider: "test",
      })),
    };
    const { app, room, client } = await createInterviewHarness({
      agent,
      reviewer,
    });
    const started = await app.interviews.start(client, room.id);
    const contextPack = await app.contextPacks.latest(client, room.id);

    const result = await app.interviews.submitAnswer(
      client,
      room.id,
      {
        questionId: started.currentQuestion!.id,
        answer: "Customers need a faster registration flow.",
        idempotencyKey: "repair-invalid-completion",
        contextPackRevisionId: contextPack?.id ?? null,
      },
    );
    expect(result.currentQuestion).toMatchObject({
      kind: "final_anything_else",
    });
    expect(agent.advance.mock.calls[1]?.[0].repairErrors).toEqual([
      "Completion conflicts with required coverage or unresolved findings.",
    ]);
    expect(reviewer.review).toHaveBeenCalledOnce();
  });

  it("supports pause, skip gaps, deliberate early finish, and Freelancer observation only", async () => {
    const { app, room, client, freelancer } =
      await createInterviewHarness();
    const started = await app.interviews.start(client, room.id);
    const observed = await app.interviews.get(freelancer, room.id);
    expect(observed).toMatchObject({
      respondingDevice: false,
      currentQuestion: { id: started.currentQuestion!.id },
    });
    await expect(
      app.interviews.pause(freelancer, room.id),
    ).rejects.toThrow(/only the Client/i);

    expect(
      (await app.interviews.pause(client, room.id)).status,
    ).toBe("paused");
    const resumed = await app.interviews.resume(client, room.id);
    const contextPack = await app.contextPacks.latest(client, room.id);
    const afterSkip = await app.interviews.skip(client, room.id, {
      questionId: resumed.currentQuestion!.id,
      idempotencyKey: "skip-1",
      contextPackRevisionId: contextPack?.id ?? null,
    });
    expect(afterSkip.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "gap" }),
      ]),
    );
    const finished = await app.interviews.finishEarly(
      client,
      room.id,
      {
        confirmed: true,
        reason: "We will continue in a later project.",
      },
    );
    expect(finished).toMatchObject({
      status: "completed_early",
      incompleteReason: "We will continue in a later project.",
    });
  });

  it("blocks answers during late material processing and links future reasoning to the new Context Pack", async () => {
    const eventBatches: string[][] = [];
    const inspectedCharacters: number[] = [];
    const agent = {
      advance: async ({
        acceptedTurn,
        events,
        inspectEvidence,
      }) => {
        eventBatches.push(events.map(({ id }) => id));
        if (events[0] && inspectEvidence) {
          const inspected = await inspectEvidence(
            events[0].materialId,
            10_000,
          );
          inspectedCharacters.push(
            inspected.reduce(
              (total, excerpt) => total + excerpt.text.length,
              0,
            ),
          );
        }
        return {
          coverageUpdates: [
            {
              id: "goals-users",
              status: "partial" as const,
              evidence: [
                { type: "turn" as const, turnId: acceptedTurn.id },
              ],
              rationale: "More detail remains useful.",
              openQuestions: ["What else matters?"],
            },
          ],
          findings: [],
          unresolvedTopics: ["More detail"],
          nextQuestion: {
            text: "What else matters?",
            coverageAreaId: "goals-users",
            kind: "primary" as const,
            reason: "Coverage remains partial.",
          },
          completionAssessment: {
            proposeCompletion: false,
            rationale: "Coverage remains partial.",
          },
          model: "agent-fixture",
          provider: "test",
        };
      },
    } satisfies NonNullable<InterviewAdapters["agent"]>;
    const { app, room, client, freelancer } =
      await createInterviewHarness({ agent });
    const started = await app.interviews.start(client, room.id);
    const firstContext = await app.contextPacks.latest(client, room.id);
    const advanced = await app.interviews.submitAnswer(
      client,
      room.id,
      {
        questionId: started.currentQuestion!.id,
        answer: "Customers should complete registration without support.",
        idempotencyKey: "before-late-material",
        contextPackRevisionId: firstContext?.id ?? null,
      },
    );
    const originalTurn = structuredClone(advanced.turns[0]);
    const material = await app.materials.accept(
      freelancer,
      room.id,
      {
        name: "Constraints.txt",
        size: 54,
        declaredContentType: "text/plain",
        fileReference: "late-material",
        uploader: "freelancer",
      },
    );

    await expect(
      app.interviews.submitAnswer(client, room.id, {
        questionId: advanced.currentQuestion!.id,
        answer: "The first release needs account administration.",
        idempotencyKey: "during-processing",
        contextPackRevisionId: firstContext?.id ?? null,
      }),
    ).rejects.toThrow(/finish processing/i);

    await app.materials.process(freelancer, room.id, material.id);
    const secondMaterial = await app.materials.accept(
      freelancer,
      room.id,
      {
        name: "Second-constraints.txt",
        size: 54,
        declaredContentType: "text/plain",
        fileReference: "second-late-material",
        uploader: "freelancer",
      },
    );
    await app.materials.process(
      freelancer,
      room.id,
      secondMaterial.id,
    );
    const latestContext = await app.contextPacks.latest(client, room.id);
    const afterMaterial = await app.interviews.get(client, room.id);
    expect(afterMaterial?.events).toHaveLength(2);
    expect(afterMaterial?.events[1]).toMatchObject({
      type: "project_material_added",
      materialId: secondMaterial.id,
      contextPackRevisionId: latestContext!.id,
    });
    expect(afterMaterial?.turns[0]).toEqual(originalTurn);

    const afterAnswer = await app.interviews.submitAnswer(
      client,
      room.id,
      {
        questionId: afterMaterial!.currentQuestion!.id,
        answer: "The first release needs account administration.",
        idempotencyKey: "after-late-material",
        contextPackRevisionId: latestContext!.id,
      },
    );
    expect(afterAnswer.turns[1]).toMatchObject({
      contextPackRevisionId: latestContext!.id,
      contextPackRevision: latestContext!.revision,
    });
    await app.interviews.submitAnswer(client, room.id, {
      questionId: afterAnswer.currentQuestion!.id,
      answer: "Nothing further changes that constraint.",
      idempotencyKey: "after-event-consumed",
      contextPackRevisionId: latestContext!.id,
    });
    expect(eventBatches).toEqual([
      [],
      afterMaterial!.events.map(({ id }) => id),
      [],
    ]);
    expect(inspectedCharacters[0]).toBeLessThanOrEqual(4_000);
    expect(
      app
        .inspectState()
        .interviewEvents.every(
          ({ handledAtTurnId }) =>
            handledAtTurnId === afterAnswer.turns[1]!.id,
        ),
    ).toBe(true);
  });

  it("runs the read-only Reviewer at the 40-answer usage guardrail", async () => {
    const agent = {
      advance: async ({ acceptedTurn }) => ({
        coverageUpdates: [
          {
            id: "goals-users",
            status: "partial",
            evidence: [{ type: "turn", turnId: acceptedTurn.id }],
            rationale: "One more detail remains useful.",
            openQuestions: ["What else should be captured?"],
          },
        ],
        findings: [],
        unresolvedTopics: ["Additional detail"],
        nextQuestion: {
          text: "What else should be captured?",
          coverageAreaId: "goals-users",
          kind: "primary",
          reason: "Coverage remains partial.",
        },
        completionAssessment: {
          proposeCompletion: false,
          rationale: "Coverage remains partial.",
        },
        model: "agent-fixture",
        provider: "test",
      }),
    } satisfies NonNullable<InterviewAdapters["agent"]>;
    const reviewer = {
      review: vi.fn(async () => ({
        blockers: ["The required area remains partial."],
        weakCoverageAreaIds: ["goals-users"],
        rationale: "Continue discovery.",
        model: "reviewer-fixture",
        provider: "test",
      })),
    } satisfies NonNullable<InterviewAdapters["reviewer"]>;
    const { app, room, client } = await createInterviewHarness({
      agent,
      reviewer,
    });
    let view = await app.interviews.start(client, room.id);
    const contextPack = await app.contextPacks.latest(client, room.id);

    for (let index = 1; index <= 40; index += 1) {
      view = await app.interviews.submitAnswer(client, room.id, {
        questionId: view.currentQuestion!.id,
        answer: `Concrete answer number ${index} with enough detail.`,
        idempotencyKey: `answer-${index}`,
        contextPackRevisionId: contextPack?.id ?? null,
      });
    }

    expect(view).toMatchObject({
      answerCount: 40,
      usageReviewTriggered: true,
      reviewerBlockers: ["The required area remains partial."],
      status: "active",
    });
    expect(reviewer.review).toHaveBeenCalledOnce();
  });
});
