import { describe, expect, it, vi } from "vitest";
import {
  localInterviewAgent,
  localInterviewPlanner,
  localInterviewReviewer,
} from "./local-interview-adapters";
import { SOFTWARE_PROJECT_PROFILE } from "../domain/discovery-interview";

const createPersistedPlan = async () => {
  const draft = await localInterviewPlanner.plan({
    language: "en",
    projectDescription: "A portal",
    freelancerGuidance: "",
    contextPack: null,
    profile: SOFTWARE_PROJECT_PROFILE,
  });
  return {
    draft,
    plan: {
      ...draft,
      id: "plan",
      roomId: "room",
      language: "en" as const,
      promptVersion:
        "software-project-interview-planner-v1" as const,
      schemaVersion: "interview-plan-v1" as const,
      createdAt: 1,
      updatedAt: 1,
    },
  };
};

describe("local Discovery Interview adapters", () => {
  it("creates versioned English and German software-project plans", async () => {
    for (const language of ["en", "de"] as const) {
      const plan = await localInterviewPlanner.plan({
        language,
        projectDescription: "A portal",
        freelancerGuidance: "",
        contextPack: null,
        profile: SOFTWARE_PROJECT_PROFILE,
      });
      expect(plan).toMatchObject({
        profileId: "software-project",
        profileVersion: "software-project-v1",
      });
      expect(plan.coverageAreas.map(({ id }) => id)).toEqual([
        "goals-users",
        "scope",
        "constraints",
        "success",
        "delivery",
      ]);
      expect(plan.firstQuestion.text).not.toMatch(
        language === "de" ? /\bwho\b/i : /\bwer\b/i,
      );
    }
  });

  it("uses Project Description and private Guidance to avoid redundant first questions", async () => {
    const plan = await localInterviewPlanner.plan({
      language: "en",
      projectDescription:
        "Customer users need a faster account registration outcome.",
      freelancerGuidance:
        "Confirm the hard budget limit and October deadline.",
      contextPack: null,
      profile: SOFTWARE_PROJECT_PROFILE,
    });
    expect(plan.coverageAreas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "goals-users",
          status: "partial",
        }),
        expect.objectContaining({
          id: "constraints",
          status: "partial",
        }),
      ]),
    );
    expect(plan.firstQuestion.coverageAreaId).toBe("scope");
    expect(plan.knownRisks).toHaveLength(1);
  });

  it("bounds vague follow-up to one before documenting a gap", async () => {
    const { draft, plan } = await createPersistedPlan();
    const question = {
      id: "question",
      ...draft.firstQuestion,
      askedAt: 1,
    };
    const turn = {
      id: "turn",
      roomId: "room",
      interviewId: "interview",
      sequence: 1,
      question,
      answer: "Not sure",
      answerKind: "answer" as const,
      idempotencyKey: "answer",
      contextPackRevisionId: null,
      contextPackRevision: null,
      acceptedAt: 2,
    };
    const first = await localInterviewAgent.advance({
      language: "en",
      projectDescription: "A portal",
      freelancerGuidance: "",
      contextPack: null,
      plan,
      turns: [turn],
      corrections: [],
      findings: [],
      events: [],
      acceptedTurn: turn,
    });
    expect(first.nextQuestion).toMatchObject({ kind: "follow_up" });
    expect(first.findings).toHaveLength(0);

    plan.coverageAreas[0]!.vagueFollowupCount = 1;
    const second = await localInterviewAgent.advance({
      language: "en",
      projectDescription: "A portal",
      freelancerGuidance: "",
      contextPack: null,
      plan,
      turns: [turn],
      corrections: [],
      findings: [],
      events: [],
      acceptedTurn: { ...turn, id: "turn-2" },
    });
    expect(second.findings).toEqual([
      expect.objectContaining({ type: "gap" }),
    ]);
    expect(second.coverageUpdates[0]?.status).toBe("sufficient");
    expect(second.nextQuestion?.coverageAreaId).toBe("scope");
  });

  it("keeps Skip as an unresolved Gap while moving to another area", async () => {
    const { draft, plan } = await createPersistedPlan();
    const turn = {
      id: "turn-skip",
      roomId: "room",
      interviewId: "interview",
      sequence: 1,
      question: {
        id: "question",
        ...draft.firstQuestion,
        askedAt: 1,
      },
      answer: "Skipped",
      answerKind: "skip" as const,
      idempotencyKey: "skip",
      contextPackRevisionId: null,
      contextPackRevision: null,
      acceptedAt: 2,
    };
    const delta = await localInterviewAgent.advance({
      language: "en",
      projectDescription: "A portal",
      freelancerGuidance: "",
      contextPack: null,
      plan,
      turns: [turn],
      corrections: [],
      findings: [],
      events: [],
      acceptedTurn: turn,
    });
    expect(delta.coverageUpdates[0]).toMatchObject({
      status: "partial",
    });
    expect(delta.unresolvedTopics).toContain("Goals and users");
    expect(delta.nextQuestion?.coverageAreaId).toBe("scope");
    expect(delta.completionAssessment.proposeCompletion).toBe(false);

    plan.coverageAreas[0]!.vagueFollowupCount = 1;
    const repeatedSkip = await localInterviewAgent.advance({
      language: "en",
      projectDescription: "A portal",
      freelancerGuidance: "",
      contextPack: null,
      plan,
      turns: [{ ...turn, id: "turn-skip-again", sequence: 2 }],
      corrections: [],
      findings: [],
      events: [],
      acceptedTurn: {
        ...turn,
        id: "turn-skip-again",
        sequence: 2,
      },
    });
    expect(repeatedSkip.coverageUpdates[0]?.status).toBe(
      "sufficient",
    );
    expect(repeatedSkip.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "gap",
          statement: expect.stringMatching(/may affect scope/i),
        }),
      ]),
    );
  });

  it("keeps the Reviewer read-only while reporting weak required coverage", async () => {
    const { plan } = await createPersistedPlan();
    const before = structuredClone(plan);
    const review = await localInterviewReviewer.review({
      language: "en",
      contextPack: null,
      profile: SOFTWARE_PROJECT_PROFILE,
      plan,
      turns: [],
      corrections: [],
      findings: [],
    });
    expect(review.blockers).toHaveLength(5);
    expect(plan).toEqual(before);
  });

  it("surfaces conflicting constraints neutrally without turning them into agreement", async () => {
    const { plan } = await createPersistedPlan();
    const baseTurn = {
      roomId: "room",
      interviewId: "interview",
      question: {
        id: "question",
        text: "What is the budget?",
        coverageAreaId: "constraints",
        kind: "primary" as const,
        reason: "Establish constraints.",
        askedAt: 1,
      },
      answerKind: "answer" as const,
      contextPackRevisionId: null,
      contextPackRevision: null,
      acceptedAt: 2,
    };
    const turns = [
      {
        ...baseTurn,
        id: "turn-1",
        sequence: 1,
        answer: "There is no budget.",
        idempotencyKey: "one",
      },
      {
        ...baseTurn,
        id: "turn-2",
        sequence: 2,
        answer: "The budget is 20000 EUR.",
        idempotencyKey: "two",
      },
    ];
    const delta = await localInterviewAgent.advance({
      language: "en",
      projectDescription: "A portal",
      freelancerGuidance: "",
      contextPack: null,
      plan,
      turns,
      corrections: [],
      findings: [],
      events: [],
      acceptedTurn: turns[1]!,
    });

    expect(delta.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "contradiction",
          sources: [
            { type: "turn", turnId: "turn-1" },
            { type: "turn", turnId: "turn-2" },
          ],
        }),
      ]),
    );
    expect(delta.nextQuestion?.text).toMatch(/appear to conflict/i);
    expect(
      delta.findings.some(({ statement }) => /agreed|feasible/i.test(statement)),
    ).toBe(false);
  });

  it("uses bounded retrieval when late material changes future reasoning", async () => {
    const { draft, plan } = await createPersistedPlan();
    const acceptedTurn = {
      id: "turn",
      roomId: "room",
      interviewId: "interview",
      sequence: 1,
      question: {
        id: "question",
        ...draft.firstQuestion,
        askedAt: 1,
      },
      answer: "Customers need faster registration.",
      answerKind: "answer" as const,
      idempotencyKey: "answer",
      contextPackRevisionId: "context-2",
      contextPackRevision: 2,
      acceptedAt: 2,
    };
    const retrieveEvidence = vi.fn(async () => [
      {
        materialId: "material-late",
        text: "Launch in October.",
        locator: {
          kind: "paragraph" as const,
          label: "Paragraph 1",
          paragraph: 1,
        },
        score: 0.9,
      },
    ]);
    const delta = await localInterviewAgent.advance({
      language: "en",
      projectDescription: "A portal",
      freelancerGuidance: "",
      contextPack: {
        id: "context-2",
        roomId: "room",
        revision: 2,
        reason: "material_analyzed",
        subjectMaterialId: "material-late",
        globalProjectSummary: "An October portal launch.",
        likelyProjectType: "portal",
        notableSignals: [],
        includedMaterialIds: ["material-late"],
        materialSummaries: [],
        feedback: [],
        minimalContextWarning: false,
        createdAt: 2,
      },
      plan,
      turns: [acceptedTurn],
      corrections: [],
      findings: [],
      events: [
        {
          id: "event",
          roomId: "room",
          interviewId: "interview",
          type: "project_material_added",
          materialId: "material-late",
          contextPackRevisionId: "context-2",
          contextPackRevision: 2,
          createdAt: 2,
        },
      ],
      acceptedTurn,
      retrieveEvidence,
    });

    expect(retrieveEvidence).toHaveBeenCalledWith(
      acceptedTurn.question.text,
      5,
    );
    expect(delta.coverageUpdates[0]?.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "material",
          materialId: "material-late",
        }),
      ]),
    );
  });

  it("does not cite unrelated late material when retrieval finds no relevant excerpt", async () => {
    const { draft, plan } = await createPersistedPlan();
    const acceptedTurn = {
      id: "turn",
      roomId: "room",
      interviewId: "interview",
      sequence: 1,
      question: {
        id: "question",
        ...draft.firstQuestion,
        askedAt: 1,
      },
      answer: "Customers need faster registration.",
      answerKind: "answer" as const,
      idempotencyKey: "answer",
      contextPackRevisionId: "context",
      contextPackRevision: 2,
      acceptedAt: 2,
    };
    const delta = await localInterviewAgent.advance({
      language: "en",
      projectDescription: "A portal",
      freelancerGuidance: "",
      contextPack: {
        id: "context",
        roomId: "room",
        revision: 2,
        reason: "material_analyzed",
        globalProjectSummary: "Unrelated accounting notes.",
        likelyProjectType: null,
        notableSignals: [],
        includedMaterialIds: ["unrelated"],
        materialSummaries: [
          {
            materialId: "unrelated",
            fileName: "Accounting.txt",
            summary: "Historical accounting notes.",
            summaryLanguage: "en",
            summarySources: [
              {
                kind: "paragraph",
                label: "Paragraph 1",
                paragraph: 1,
              },
            ],
            analysisId: "analysis",
            analysisVersion: 1,
            category: "commercial",
            confidence: 0.9,
            signals: [],
            available: true,
          },
        ],
        feedback: [],
        minimalContextWarning: false,
        createdAt: 2,
      },
      plan,
      turns: [acceptedTurn],
      corrections: [],
      findings: [],
      events: [
        {
          id: "event",
          roomId: "room",
          interviewId: "interview",
          type: "project_material_added",
          materialId: "unrelated",
          contextPackRevisionId: "context",
          contextPackRevision: 2,
          createdAt: 2,
        },
      ],
      acceptedTurn,
      retrieveEvidence: async () => [],
    });
    expect(
      delta.coverageUpdates[0]?.evidence.some(
        (source) => source.type === "material",
      ),
    ).toBe(false);
  });

  it("reassesses ordinary corrected content with correction provenance", async () => {
    const { plan } = await createPersistedPlan();
    plan.coverageAreas[0]!.status = "partial";
    plan.coverageAreas[0]!.evidence = [
      { type: "turn", turnId: "turn-old" },
    ];
    const acceptedTurn = {
      id: "turn-current",
      roomId: "room",
      interviewId: "interview",
      sequence: 2,
      question: {
        id: "question",
        text: "What belongs in scope?",
        coverageAreaId: "scope",
        kind: "primary" as const,
        reason: "Scope remains open.",
        askedAt: 2,
      },
      answer: "Account administration belongs in the first release.",
      answerKind: "answer" as const,
      idempotencyKey: "current",
      contextPackRevisionId: null,
      contextPackRevision: null,
      acceptedAt: 3,
    };
    const delta = await localInterviewAgent.advance({
      language: "en",
      projectDescription: "A portal",
      freelancerGuidance: "",
      contextPack: null,
      plan,
      turns: [acceptedTurn],
      corrections: [
        {
          id: "correction",
          roomId: "room",
          interviewId: "interview",
          turnId: "turn-old",
          correctedAnswer:
            "Customers and internal staff both need registration.",
          reason: "A user group was omitted.",
          deviceId: "device",
          createdAt: 2,
        },
      ],
      findings: [
        {
          id: "finding-needs-reassessment",
          roomId: "room",
          interviewId: "interview",
          type: "candidate_requirement",
          statement: "Only customers need registration.",
          sources: [{ type: "turn", turnId: "turn-old" }],
          status: "needs_reassessment",
          createdAt: 1,
        },
      ],
      events: [],
      acceptedTurn,
    });
    expect(
      delta.coverageUpdates.find(({ id }) => id === "goals-users"),
    ).toMatchObject({
      status: "sufficient",
      evidence: expect.arrayContaining([
        { type: "correction", correctionId: "correction" },
      ]),
    });
    expect(delta.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sources: [{ type: "turn", turnId: "turn-current" }],
        }),
      ]),
    );
    expect(delta.findingStatusUpdates).toEqual([
      {
        id: "finding-needs-reassessment",
        status: "resolved",
        sources: [
          { type: "turn", turnId: "turn-old" },
          { type: "correction", correctionId: "correction" },
        ],
      },
    ]);
  });

  it("bounds a long requirement finding independently of the immutable Client answer", async () => {
    const { plan } = await createPersistedPlan();
    const acceptedTurn = {
      id: "turn-long",
      roomId: "room",
      interviewId: "interview",
      sequence: 1,
      question: {
        id: "question",
        text: "What belongs in scope?",
        coverageAreaId: "scope",
        kind: "primary" as const,
        reason: "Establish scope.",
        askedAt: 1,
      },
      answer: `The first release must include ${"account administration, ".repeat(100)}`,
      answerKind: "answer" as const,
      idempotencyKey: "long-answer",
      contextPackRevisionId: null,
      contextPackRevision: null,
      acceptedAt: 2,
    };

    const delta = await localInterviewAgent.advance({
      language: "en",
      projectDescription: "A portal",
      freelancerGuidance: "",
      contextPack: null,
      plan,
      turns: [acceptedTurn],
      corrections: [],
      findings: [],
      events: [],
      acceptedTurn,
    });

    expect(acceptedTurn.answer.length).toBeGreaterThan(1_000);
    expect(delta.findings[0]).toMatchObject({
      type: "candidate_requirement",
    });
    expect(delta.findings[0]!.statement.length).toBeLessThanOrEqual(
      1_000,
    );
  });

  it("does not reapply an already-assessed vague correction over a later clarification", async () => {
    const { plan } = await createPersistedPlan();
    plan.coverageAreas[0]!.status = "partial";
    plan.coverageAreas[0]!.evidence = [
      { type: "turn", turnId: "turn-old" },
      { type: "correction", correctionId: "correction-vague" },
    ];
    const acceptedTurn = {
      id: "turn-clarification",
      roomId: "room",
      interviewId: "interview",
      sequence: 3,
      question: {
        id: "question-clarification",
        text: "Who are the primary users?",
        coverageAreaId: "goals-users",
        kind: "follow_up" as const,
        reason: "Clarify a corrected answer.",
        askedAt: 3,
      },
      answer: "Customer support managers are the primary users.",
      answerKind: "answer" as const,
      idempotencyKey: "clarification",
      contextPackRevisionId: null,
      contextPackRevision: null,
      acceptedAt: 4,
    };

    const delta = await localInterviewAgent.advance({
      language: "en",
      projectDescription: "A portal",
      freelancerGuidance: "",
      contextPack: null,
      plan,
      turns: [acceptedTurn],
      corrections: [
        {
          id: "correction-vague",
          roomId: "room",
          interviewId: "interview",
          turnId: "turn-old",
          correctedAnswer: "Not sure.",
          reason: "The earlier user group was wrong.",
          deviceId: "device",
          createdAt: 2,
        },
      ],
      findings: [],
      events: [],
      acceptedTurn,
    });

    expect(delta.coverageUpdates[0]).toMatchObject({
      id: "goals-users",
      status: "sufficient",
      rationale: "The Client answer supports this coverage area.",
    });
  });

  it("classifies Candidate Requirements by content across success and final answers", async () => {
    const { plan } = await createPersistedPlan();
    const baseTurn = {
      roomId: "room",
      interviewId: "interview",
      sequence: 1,
      answerKind: "answer" as const,
      idempotencyKey: "content-classification",
      contextPackRevisionId: null,
      contextPackRevision: null,
      acceptedAt: 2,
    };
    const advance = (
      id: string,
      coverageAreaId: string,
      answer: string,
      language: "en" | "de" = "en",
    ) => {
      const acceptedTurn = {
        ...baseTurn,
        id,
        question: {
          id: `question-${id}`,
          text: "Anything else?",
          coverageAreaId,
          kind:
            coverageAreaId === "final"
              ? ("final_anything_else" as const)
              : ("primary" as const),
          reason: "Test content-based classification.",
          askedAt: 1,
        },
        answer,
      };
      return localInterviewAgent.advance({
        language,
        projectDescription: "A portal",
        freelancerGuidance: "",
        contextPack: null,
        plan,
        turns: [acceptedTurn],
        corrections: [],
        findings: [],
        events: [],
        acceptedTurn,
      });
    };

    const finalCapability = await advance(
      "turn-final",
      "final",
      "The product must also support single sign-on.",
    );
    const successQuality = await advance(
      "turn-quality",
      "success",
      "The dashboard must load within two seconds.",
    );
    const constraintTarget = await advance(
      "turn-target",
      "constraints",
      "Reduce onboarding abandonment by 20 percent.",
    );
    const budgetTarget = await advance(
      "turn-budget-target",
      "constraints",
      "Our target budget is EUR 20,000.",
    );
    const launchGoal = await advance(
      "turn-launch-goal",
      "constraints",
      "The launch date goal is October 15.",
    );
    const germanBudgetTarget = await advance(
      "turn-budgetziel",
      "constraints",
      "Unser Budgetziel ist 20.000 Euro.",
      "de",
    );
    const germanLaunchTarget = await advance(
      "turn-zieltermin",
      "constraints",
      "Unser Zieltermin ist der 15. Oktober.",
      "de",
    );

    expect(finalCapability.findings[0]).toMatchObject({
      type: "candidate_requirement",
      statement: expect.stringMatching(/single sign-on/i),
    });
    expect(successQuality.findings[0]).toMatchObject({
      type: "candidate_requirement",
      statement: expect.stringMatching(/two seconds/i),
    });
    expect(
      constraintTarget.findings.some(
        ({ type }) => type === "candidate_requirement",
      ),
    ).toBe(false);
    expect(
      [
        ...budgetTarget.findings,
        ...launchGoal.findings,
        ...germanBudgetTarget.findings,
        ...germanLaunchTarget.findings,
      ].some(({ type }) => type === "candidate_requirement"),
    ).toBe(false);
  });

  it("surfaces cross-file contradictions before asking redundant material questions", async () => {
    const contextPack = {
      id: "context",
      roomId: "room",
      revision: 1,
      reason: "material_analyzed" as const,
      globalProjectSummary: "Project constraints differ by source.",
      likelyProjectType: "portal",
      notableSignals: [],
      includedMaterialIds: ["one", "two"],
      materialSummaries: [
        {
          materialId: "one",
          fileName: "One.txt",
          summary: "There is no budget.",
          summaryLanguage: "en" as const,
          summarySources: [
            {
              kind: "paragraph" as const,
              label: "One paragraph 1",
              paragraph: 1,
            },
          ],
          analysisId: "analysis-one",
          analysisVersion: 1,
          category: "commercial" as const,
          confidence: 0.9,
          signals: [],
          available: true,
        },
        {
          materialId: "two",
          fileName: "Two.txt",
          summary: "The budget is 20000 EUR.",
          summaryLanguage: "en" as const,
          summarySources: [
            {
              kind: "paragraph" as const,
              label: "Two paragraph 1",
              paragraph: 1,
            },
          ],
          analysisId: "analysis-two",
          analysisVersion: 1,
          category: "commercial" as const,
          confidence: 0.9,
          signals: [],
          available: true,
        },
      ],
      feedback: [],
      minimalContextWarning: false,
      createdAt: 1,
    };
    const draft = await localInterviewPlanner.plan({
      language: "en",
      projectDescription: "A portal",
      freelancerGuidance: "",
      contextPack,
      profile: SOFTWARE_PROJECT_PROFILE,
    });
    expect(draft.firstQuestion).toMatchObject({
      coverageAreaId: "constraints",
    });
    expect(draft.firstQuestion.text).toMatch(/conflicts/i);
    expect(
      draft.coverageAreas.find(({ id }) => id === "constraints"),
    ).toMatchObject({ status: "partial" });

    const plan = {
      ...draft,
      id: "plan",
      roomId: "room",
      language: "en" as const,
      promptVersion:
        "software-project-interview-planner-v1" as const,
      schemaVersion: "interview-plan-v1" as const,
      createdAt: 1,
      updatedAt: 1,
    };
    const turn = {
      id: "turn",
      roomId: "room",
      interviewId: "interview",
      sequence: 1,
      question: {
        id: "question",
        ...draft.firstQuestion,
        askedAt: 1,
      },
      answer: "EUR 20,000 is current.",
      answerKind: "answer" as const,
      idempotencyKey: "resolve",
      contextPackRevisionId: "context",
      contextPackRevision: 1,
      acceptedAt: 2,
    };
    const delta = await localInterviewAgent.advance({
      language: "en",
      projectDescription: "A portal",
      freelancerGuidance: "",
      contextPack,
      plan,
      turns: [turn],
      corrections: [],
      findings: [],
      events: [],
      acceptedTurn: turn,
    });
    expect(delta.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "contradiction",
          status: "resolved",
          sources: expect.arrayContaining([
            expect.objectContaining({
              type: "material",
              materialId: "one",
            }),
            expect.objectContaining({
              type: "material",
              materialId: "two",
            }),
          ]),
        }),
      ]),
    );
  });

  it("keeps active contradictions blocking until the clarification resolves or explicitly leaves them open", async () => {
    const { plan } = await createPersistedPlan();
    const contradiction = {
      id: "finding",
      roomId: "room",
      interviewId: "interview",
      type: "contradiction" as const,
      statement: "Budget statements conflict.",
      sources: [
        { type: "turn" as const, turnId: "turn-old" },
      ],
      status: "active" as const,
      createdAt: 1,
    };
    const acceptedTurn = {
      id: "turn-new",
      roomId: "room",
      interviewId: "interview",
      sequence: 2,
      question: {
        id: "question",
        text: "Which budget is current?",
        coverageAreaId: "constraints",
        kind: "follow_up" as const,
        reason: "Resolve conflicting statements.",
        askedAt: 2,
      },
      answer: "EUR 20,000 is the current hard limit.",
      answerKind: "answer" as const,
      idempotencyKey: "resolve",
      contextPackRevisionId: null,
      contextPackRevision: null,
      acceptedAt: 3,
    };
    const delta = await localInterviewAgent.advance({
      language: "en",
      projectDescription: "A portal",
      freelancerGuidance: "",
      contextPack: null,
      plan,
      turns: [acceptedTurn],
      corrections: [],
      findings: [contradiction],
      events: [],
      acceptedTurn,
    });
    expect(delta.findingStatusUpdates).toEqual([
      {
        id: "finding",
        status: "resolved",
        sources: [
          { type: "turn", turnId: "turn-old" },
          { type: "turn", turnId: "turn-new" },
        ],
      },
    ]);

    const explicitlyOpen = await localInterviewAgent.advance({
      language: "en",
      projectDescription: "A portal",
      freelancerGuidance: "",
      contextPack: null,
      plan,
      turns: [
        {
          ...acceptedTurn,
          answer:
            "I need to check internally; this remains unresolved.",
        },
      ],
      corrections: [],
      findings: [contradiction],
      events: [],
      acceptedTurn: {
        ...acceptedTurn,
        answer:
          "I need to check internally; this remains unresolved.",
      },
    });
    expect(explicitlyOpen.findingStatusUpdates).toEqual([
      {
        id: "finding",
        status: "explicitly_open",
        sources: [
          { type: "turn", turnId: "turn-old" },
          { type: "turn", turnId: "turn-new" },
        ],
      },
    ]);

    const activeReview = await localInterviewReviewer.review({
      language: "en",
      contextPack: null,
      profile: SOFTWARE_PROJECT_PROFILE,
      plan: {
        ...plan,
        coverageAreas: plan.coverageAreas.map((area) => ({
          ...area,
          status: "sufficient",
        })),
      },
      turns: [acceptedTurn],
      corrections: [],
      findings: [contradiction],
    });
    expect(activeReview.blockers).toEqual([
      expect.stringMatching(/unresolved contradiction/i),
    ]);
  });

  it("records unrealistic Client constraints as risks for Freelancer assessment", async () => {
    const { plan } = await createPersistedPlan();
    const acceptedTurn = {
      id: "turn",
      roomId: "room",
      interviewId: "interview",
      sequence: 1,
      question: {
        id: "question",
        text: "What constraints matter?",
        coverageAreaId: "constraints",
        kind: "primary" as const,
        reason: "Establish constraints.",
        askedAt: 1,
      },
      answer: "The complete product should cost €10 and launch in two weeks.",
      answerKind: "answer" as const,
      idempotencyKey: "constraint",
      contextPackRevisionId: null,
      contextPackRevision: null,
      acceptedAt: 2,
    };
    const delta = await localInterviewAgent.advance({
      language: "en",
      projectDescription: "A portal",
      freelancerGuidance: "",
      contextPack: null,
      plan,
      turns: [acceptedTurn],
      corrections: [],
      findings: [],
      events: [],
      acceptedTurn,
    });
    expect(delta.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "risk",
          statement: expect.stringMatching(
            /Freelancer must assess feasibility/i,
          ),
        }),
      ]),
    );
    expect(
      delta.findings.some(({ statement }) =>
        /agreed|is infeasible/i.test(statement),
      ),
    ).toBe(false);
  });
});
