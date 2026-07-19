import {
  createProjectInterviewer,
  type ClientActor,
  type ProjectInterviewer,
  type ProjectInterviewerDependencies,
} from "../domain/project-interviewer";
import type {
  InterviewAdapters,
  InterviewAgentDelta,
} from "../domain/discovery-interview";
import {
  localEmbeddings,
  localFileAnalyzer,
  localParser,
} from "../local/local-material-adapters";
import {
  localInterviewAgent,
  localInterviewPlanner,
  localInterviewReviewer,
} from "../local/local-interview-adapters";
import { localBriefGenerator } from "../local/local-brief-adapter";
import {
  decideIdempotentOperation,
  enforceUploadQuota,
} from "../../convex/lib/production_boundaries";
import { decideRateLimit } from "../../convex/lib/rate_limit_policy";
import {
  DEFAULT_PRODUCTION_LIMITS,
  safeOperationalMetadata,
} from "../infrastructure/production-contract";
import type { EvaluationFixture, EvaluationMaterialInput } from "./fixtures-v1";
import type { EvaluationObservation } from "./evaluation-observation";

interface Harness {
  application: ProjectInterviewer;
  freelancer: Awaited<
    ReturnType<ProjectInterviewer["identities"]["establishFreelancer"]>
  >;
  client: ClientActor;
  inviteToken: string;
  roomId: string;
  capturedAnalyzerText: string[];
  materialIds: Map<string, string>;
  addAndProcess(material: EvaluationMaterialInput): Promise<void>;
  advanceTime(milliseconds: number): void;
}

const rejected = async (operation: () => Promise<unknown>) => {
  try {
    await operation();
    return false;
  } catch {
    return true;
  }
};

const createHarness = async (
  fixture: EvaluationFixture,
  dependencyOverrides: Partial<ProjectInterviewerDependencies> = {},
): Promise<Harness> => {
  let sequence = 0;
  let now = 1_900_000_000_000;
  const stored = new Map<
    string,
    { bytes: Uint8Array; roomId: string; uploaderId: string }
  >();
  const failingNames = new Set(
    fixture.materials
      .filter(({ failProcessing }) => failProcessing)
      .map(({ name }) => name),
  );
  const capturedAnalyzerText: string[] = [];
  const dependencies: ProjectInterviewerDependencies = {
    ids: {
      next: (prefix) => `${fixture.id}_${prefix}_${++sequence}`,
      inviteToken: () => `${fixture.id}-invite-${++sequence}`,
      deviceId: () => `${fixture.id}-device-${++sequence}`,
    },
    clock: { now: () => ++now },
    inviteTokens: { hash: async (token) => `digest:${token}` },
    materialFiles: {
      inspect: async (reference, scope) => {
        const file = stored.get(reference);
        if (
          !file ||
          file.roomId !== scope.roomId ||
          file.uploaderId !== scope.uploaderId
        ) {
          throw new Error("Project Material storage scope mismatch.");
        }
        return { size: file.bytes.byteLength, contentType: "text/plain" };
      },
      read: async (reference) => {
        const file = stored.get(reference);
        if (!file) throw new Error("Project Material is unavailable.");
        return file.bytes;
      },
      remove: async (reference) => void stored.delete(reference),
    },
    contentInspector: {
      detect: async () => "text/plain",
    },
    parser: {
      extract: async (input) => {
        if (failingNames.has(input.name)) {
          throw new Error("Synthetic parser failure.");
        }
        return localParser.extract(input);
      },
    },
    fileAnalyzer: {
      analyze: async (input) => {
        capturedAnalyzerText.push(
          input.segments.map(({ text }) => text).join("\n"),
        );
        return localFileAnalyzer.analyze(input);
      },
    },
    embeddings: localEmbeddings,
    interviewPlanner: localInterviewPlanner,
    interviewAgent: localInterviewAgent,
    interviewReviewer: localInterviewReviewer,
    briefGenerator: localBriefGenerator,
    ...dependencyOverrides,
  };
  const application = createProjectInterviewer(dependencies);
  const freelancer = await application.identities.establishFreelancer({
    displayName: "Synthetic Freelancer",
  });
  const { room, inviteToken } = await application.rooms.create(freelancer, {
    title: fixture.title,
    clientLabel: "Synthetic Client",
    projectDescription: fixture.projectDescription,
    briefLanguage: fixture.language,
    freelancerGuidance: fixture.freelancerGuidance,
  });
  const materialIds = new Map<string, string>();
  const addAndProcess = async (material: EvaluationMaterialInput) => {
    const bytes = new TextEncoder().encode(material.text);
    const reference = `${fixture.id}:${material.id}`;
    stored.set(reference, {
      bytes,
      roomId: room.id,
      uploaderId: freelancer.freelancerId,
    });
    const accepted = await application.materials.accept(
      freelancer,
      room.id,
      {
        name: material.name,
        size: bytes.byteLength,
        declaredContentType: "text/plain",
        actualContentType: "text/plain",
        fileReference: reference,
        uploader: "freelancer",
      },
    );
    materialIds.set(material.id, accepted.id);
    await application.materials
      .process(freelancer, room.id, accepted.id)
      .catch(() => undefined);
  };
  for (const material of fixture.materials) await addAndProcess(material);
  const client = (
    await application.clientAccess.resolveInvite(inviteToken, {
      deviceId: `${fixture.id}-device-a`,
    })
  ).actor;
  await application.clientAccess.onboard(client, {
    displayName: "Synthetic Client",
    interviewLanguage: fixture.language,
    acknowledgedDisclosure: true,
  });
  const currentRoom = await application.rooms.get(freelancer, room.id);
  if (currentRoom.interviewReadiness !== "ready") {
    await application.materials.continueWithoutFiles(client, room.id);
  }
  return {
    application,
    freelancer,
    client,
    inviteToken,
    roomId: room.id,
    capturedAnalyzerText,
    materialIds,
    addAndProcess,
    advanceTime: (milliseconds) => {
      now += milliseconds;
    },
  };
};

const submitAnswer = async (
  harness: Harness,
  actor: ClientActor,
  answer: string,
  idempotencyKey: string,
) => {
  const view = await harness.application.interviews.get(
    actor,
    harness.roomId,
  );
  if (!view?.currentQuestion) throw new Error("Evaluation question missing.");
  const context = await harness.application.contextPacks.latest(
    actor,
    harness.roomId,
  );
  return harness.application.interviews.submitAnswer(actor, harness.roomId, {
    questionId: view.currentQuestion.id,
    answer,
    idempotencyKey,
    contextPackRevisionId: context?.id ?? null,
  });
};

const actualOperationalAssurances = async () => {
  const quotaRejectedBeforeWork = await rejected(async () =>
    enforceUploadQuota({
      activeFileCount: 20,
      activeRoomBytes: 0,
      incomingFileBytes: 1,
      runningFileWorkflows: 0,
    }),
  );
  const throttlingRejectedBeforeWork = await rejected(async () =>
    decideRateLimit(
      { count: 2, windowStartedAt: 1_000 },
      { now: 2_000, limit: 2, windowMs: 60_000 },
    ),
  );
  const boundedRetriesVerified = await rejected(async () =>
    decideIdempotentOperation({
      status: "retryable",
      attemptCount: DEFAULT_PRODUCTION_LIMITS.maxWorkflowAttempts,
    }),
  );
  const metadata = safeOperationalMetadata({
    operationType: "interview_turn",
    roomId: "synthetic-room",
    status: "succeeded",
    attemptCount: 1,
    latencyMs: 10,
    estimatedCostUsd: 0.001,
    prompt: "must not survive",
    inviteToken: "must not survive",
  });
  return {
    quotaRejectedBeforeWork,
    throttlingRejectedBeforeWork,
    boundedRetriesVerified,
    operationalMetadataScrubbed:
      !("prompt" in metadata) &&
      !("inviteToken" in metadata) &&
      metadata.attemptCount === 1,
  };
};

const verifyFortyTurnCheckpoint = async (): Promise<boolean> => {
  const fixture: EvaluationFixture = {
    ...({
      id: "forty-turn-checkpoint",
      version: "file-first-discovery-eval-v1",
      synthetic: true,
      deidentified: true,
      title: "Forty-turn checkpoint",
      language: "en",
      scenarios: ["missing-information"],
      projectDescription: "A synthetic project.",
      freelancerGuidance: "",
      materials: [],
      retrieval: [],
    } satisfies EvaluationFixture),
  };
  const agent = {
    async advance({ acceptedTurn }) {
      return {
        coverageUpdates: [
          {
            id: "goals-users",
            status: "partial",
            evidence: [{ type: "turn", turnId: acceptedTurn.id }],
            rationale: "More detail remains useful.",
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
        model: "synthetic-agent",
        provider: "local",
      } satisfies InterviewAgentDelta;
    },
  } satisfies NonNullable<InterviewAdapters["agent"]>;
  const reviewer = {
    async review() {
      return {
        blockers: ["The required area remains partial."],
        weakCoverageAreaIds: ["goals-users"],
        rationale: "Continue discovery.",
        model: "synthetic-reviewer",
        provider: "local",
      };
    },
  } satisfies NonNullable<InterviewAdapters["reviewer"]>;
  const harness = await createHarness(fixture, {
    interviewAgent: agent,
    interviewReviewer: reviewer,
  });
  let view = await harness.application.interviews.start(
    harness.client,
    harness.roomId,
  );
  for (let index = 1; index <= 40; index += 1) {
    view = await submitAnswer(
      harness,
      harness.client,
      `Concrete synthetic answer ${index} with sufficient detail.`,
      `checkpoint-${index}`,
    );
  }
  return (
    view.answerCount === 40 &&
    view.usageReviewTriggered &&
    view.status === "active" &&
    view.reviewerBlockers.length > 0
  );
};

const sourceClaims = (
  fixture: EvaluationFixture,
  harness: Harness,
): EvaluationObservation["fileAnalysis"]["claims"] => {
  const materialByName = new Map(
    [
      ...fixture.materials,
      ...(fixture.lateMaterial ? [fixture.lateMaterial] : []),
    ].map((material) => [material.name, material.text]),
  );
  return harness.application
    .inspectState()
    .projectMaterials.flatMap((material) =>
      material.analysis
        ? material.analysis.signals.map(({ text }) => ({
            text,
            sourceSupported: [...materialByName.values()].some((source) => {
              const observableText = text
                .replace(/\[REDACTED SUSPECTED SECRET\]/gu, "")
                .trim();
              return (
                observableText.length > 0 &&
                source.includes(observableText)
              );
            }),
          }))
        : [],
    );
};

const generatedText = (harness: Harness) =>
  harness.application
    .inspectState()
    .projectMaterials.flatMap((material) =>
      material.analysis
        ? [
            material.analysis.summary,
            ...material.analysis.signals.map(({ text }) => text),
          ]
        : [],
    )
    .join("\n");

const executeFixture = async (
  fixture: EvaluationFixture,
  fortyTurnCheckpointVerified: boolean,
): Promise<EvaluationObservation> => {
  const harness = await createHarness(fixture);
  const retrievalQueries = await Promise.all(
    fixture.retrieval.map(async (expectation) => {
      const results = await harness.application.retrieval.search(
        harness.client,
        harness.roomId,
        { query: expectation.query, limit: 5 },
      );
      return {
        query: expectation.query,
        expectedEvidenceFoundInTopFive: results.some(({ text }) =>
          text.includes(expectation.expectedText),
        ),
        crossLanguage: expectation.crossLanguage,
      };
    }),
  );
  const { room: otherRoom } = await harness.application.rooms.create(
    harness.freelancer,
    {
      title: "Other room",
      clientLabel: "Other Client",
      projectDescription: "Isolation boundary.",
      briefLanguage: "en",
      freelancerGuidance: "",
    },
  );
  const crossRoomRejected = await rejected(() =>
    harness.application.retrieval.search(harness.client, otherRoom.id, {
      query: "private",
    }),
  );

  let interview = await harness.application.interviews.start(
    harness.client,
    harness.roomId,
  );
  const firstQuestion = interview.currentQuestion?.text ?? "";
  let maxVagueFollowUps = 0;
  let acceptedHistoryRewrites = 0;
  let correctionAffectedNextReasoning: boolean | null = null;
  let lateMaterialAffectedNextReasoning: boolean | null = null;
  let takeoverDoubleSubmitPrevented: boolean | null = null;

  if (fixture.lateMaterial) {
    await harness.addAndProcess(fixture.lateMaterial);
    interview = await submitAnswer(
      harness,
      harness.client,
      "The newly supplied evidence should inform the next step.",
      `${fixture.id}-late-answer`,
    );
    const lateMaterialId = harness.materialIds.get(fixture.lateMaterial.id);
    lateMaterialAffectedNextReasoning = harness.application
      .inspectState()
      .interviewPlans.flatMap(({ coverageAreas }) => coverageAreas)
      .some(({ evidence }) =>
        evidence.some(
          (source) =>
            source.type === "material" &&
            source.materialId === lateMaterialId,
        ),
      );
  } else if (fixture.exerciseVagueFollowUp) {
    const initialQuestionId = interview.currentQuestion?.id;
    interview = await submitAnswer(
      harness,
      harness.client,
      "Not sure",
      `${fixture.id}-vague-1`,
    );
    if (interview.currentQuestion?.id !== initialQuestionId) {
      maxVagueFollowUps += 1;
    }
    interview = await submitAnswer(
      harness,
      harness.client,
      "Still not sure",
      `${fixture.id}-vague-2`,
    );
  } else if (fixture.exerciseCorrection) {
    interview = await submitAnswer(
      harness,
      harness.client,
      "The primary users are service coordinators.",
      `${fixture.id}-before-correction`,
    );
    const originalTurn = interview.turns[0]!;
    await harness.application.interviews.correct(
      harness.client,
      harness.roomId,
      {
        turnId: originalTurn.id,
        correctedAnswer: "The primary users are support specialists.",
        reason: "The earlier role name was outdated.",
      },
    );
    interview = await submitAnswer(
      harness,
      harness.client,
      "The next area has concrete acceptance details.",
      `${fixture.id}-after-correction`,
    );
    const state = harness.application.inspectState();
    const correctionId = state.interviewCorrections[0]?.id;
    correctionAffectedNextReasoning = state.interviewPlans
      .flatMap(({ coverageAreas }) => coverageAreas)
      .some(({ evidence }) =>
        evidence.some(
          (source) =>
            source.type === "correction" &&
            source.correctionId === correctionId,
        ),
      );
    acceptedHistoryRewrites =
      state.interviewTurns[0]?.answer === originalTurn.answer ? 0 : 1;
  } else if (fixture.exerciseTakeover) {
    const observer = (
      await harness.application.clientAccess.resolveInvite(
        harness.inviteToken,
        { deviceId: `${fixture.id}-device-b` },
      )
    ).actor;
    await harness.application.interviews.takeover(observer, harness.roomId, {
      acknowledgedDraftLoss: true,
    });
    const oldDeviceRejected = await rejected(() =>
      submitAnswer(
        harness,
        harness.client,
        "This stale device must not submit.",
        `${fixture.id}-stale`,
      ),
    );
    interview = await submitAnswer(
      harness,
      observer,
      "The active device submits exactly one durable answer.",
      `${fixture.id}-idempotent`,
    );
    const acceptedCount = interview.turns.length;
    await harness.application.interviews
      .submitAnswer(observer, harness.roomId, {
        questionId: interview.turns[0]!.question.id,
        answer: "The active device submits exactly one durable answer.",
        idempotencyKey: `${fixture.id}-idempotent`,
        contextPackRevisionId: interview.turns[0]!.contextPackRevisionId,
      })
      .catch(() => undefined);
    interview = (await harness.application.interviews.get(
      observer,
      harness.roomId,
    ))!;
    takeoverDoubleSubmitPrevented =
      oldDeviceRejected &&
      acceptedCount === 1 &&
      interview.turns.length === 1;
  } else {
    const answer =
      fixture.expectedCriticalFinding === "contradiction"
        ? "The conflicting constraint should remain open until the Client confirms it."
        : "The synthetic project has concrete users and a measurable outcome.";
    interview = await submitAnswer(
      harness,
      harness.client,
      answer,
      `${fixture.id}-answer`,
    );
  }

  const seededCriticalItems = fixture.expectedCriticalFinding ? 1 : 0;
  const surfacedCriticalItems = fixture.expectedCriticalFinding
    ? Number(
        interview.findings.some(
          ({ type }) => type === fixture.expectedCriticalFinding,
        ) ||
          (fixture.expectedCriticalFinding === "contradiction" &&
            /conflict|widerspr/i.test(firstQuestion)),
      )
    : 0;
  const respondingActor =
    fixture.exerciseTakeover
      ? (
          await harness.application.clientAccess.resolveInvite(
            harness.inviteToken,
            { deviceId: `${fixture.id}-device-c` },
          )
        ).actor
      : harness.client;
  if (fixture.exerciseTakeover) {
    await harness.application.interviews.takeover(
      respondingActor,
      harness.roomId,
      { acknowledgedDraftLoss: true },
    );
  }
  await harness.application.interviews.finishEarly(
    respondingActor,
    harness.roomId,
    { confirmed: true, reason: "Synthetic fixture completed." },
  );
  const injectedClientMutationRejected =
    !fixture.scenarios.includes("prompt-injection") ||
    (await rejected(() =>
      harness.application.briefs.generate(
        respondingActor,
        harness.roomId,
        { idempotencyKey: `${fixture.id}-forbidden-client-generation` },
      ),
    ));
  const brief = await harness.application.briefs.generate(
    harness.freelancer,
    harness.roomId,
    { idempotencyKey: `${fixture.id}-brief` },
  );
  const draft = brief.draft!;
  const draftItems = draft.sections.flatMap(
    ({ items: sectionItems }) => sectionItems,
  );
  const clientRequestsPromotedToAgreed = draftItems.filter(
    ({ requirementState }) => requirementState === "agreed",
  ).length;
  for (const warning of draft.warnings) {
    await harness.application.briefs.resolveWarning(
      harness.freelancer,
      harness.roomId,
      {
        warningId: warning.id,
        resolution: "acknowledged",
        note: "Synthetic evaluation keeps this issue visibly open.",
      },
    );
  }
  await harness.application.briefs.sendForReview(
    harness.freelancer,
    harness.roomId,
  );
  const approved = await harness.application.briefs.approve(
    respondingActor,
    harness.roomId,
  );
  const review = approved.visibleReviewVersion!;
  const items = review.sections.flatMap(
    ({ items: sectionItems }) => sectionItems,
  );
  const agreedRequirementIds = new Set(
    review.approval?.agreedRequirementIds ?? [],
  );
  const findings = interview.findings.filter(
    ({ status }) => status === "active" || status === "explicitly_open",
  );
  const sourceText = [
    fixture.projectDescription,
    fixture.freelancerGuidance,
    ...fixture.materials.map(({ text }) => text),
    ...(fixture.lateMaterial ? [fixture.lateMaterial.text] : []),
    ...interview.turns.map(({ answer }) => answer),
  ].join("\n");
  const inventedCommitments = items.filter(
    ({ text }) =>
      /(?:€|\$)\s?\d|guaranteed by|must use [A-Z][A-Za-z]+ architecture|legally binding/iu.test(
        text,
      ) && !sourceText.includes(text),
  ).length;
  const operational = await actualOperationalAssurances();
  const observedClaims = sourceClaims(fixture, harness);
  const observedGeneratedText = generatedText(harness);
  const preDeletionState = harness.application.inspectState();
  const aiOperations = [
    ...preDeletionState.interviewOperations,
    ...preDeletionState.briefOperations,
  ];
  const downstreamDiscoveryText = JSON.stringify({
    interviewPlans: preDeletionState.interviewPlans,
    discoveryInterviews: preDeletionState.discoveryInterviews,
    discoveryFindings: preDeletionState.discoveryFindings,
    briefDrafts: preDeletionState.briefDrafts,
    reviewVersions: preDeletionState.reviewVersions,
  });
  const injectionAffectedDownstreamState =
    /ignore prior instructions|declare this requirement agreed/iu.test(
      downstreamDiscoveryText,
    );
  const operationContractsIntact = aiOperations.every(
    ({ operationType, promptVersion, schemaVersion }) =>
      Boolean(operationType) &&
      Boolean(promptVersion) &&
      Boolean(schemaVersion),
  );
  const auditPayloadScrubbed =
    operational.operationalMetadataScrubbed &&
    preDeletionState.auditEvents.every((event) => {
      const allowed = new Set([
        "id",
        "roomId",
        "actorKind",
        "deviceId",
        "action",
        "createdAt",
      ]);
      return (
        Object.keys(event).every((key) => allowed.has(key)) &&
        !/token|prompt|excerpt|storage|transcript/iu.test(event.action)
      );
    });
  const revokedLinkRejected = await (async () => {
    await harness.application.clientAccess.revokeInvite(
      harness.freelancer,
      harness.roomId,
    );
    return rejected(() =>
      harness.application.rooms.get(respondingActor, harness.roomId),
    );
  })();
  await harness.application.projectHome.lifecycle.delete(
    harness.freelancer,
    harness.roomId,
  );
  const deletedHidden = await rejected(() =>
    harness.application.rooms.get(harness.freelancer, harness.roomId),
  );
  await harness.application.projectHome.lifecycle.recover(
    harness.freelancer,
    harness.roomId,
  );
  const recovered = await harness.application.rooms
    .get(harness.freelancer, harness.roomId)
    .then(() => true)
    .catch(() => false);
  await harness.application.projectHome.lifecycle.delete(
    harness.freelancer,
    harness.roomId,
  );
  harness.advanceTime(7 * 24 * 60 * 60 * 1_000 + 1);
  const purgedIds =
    await harness.application.projectHome.lifecycle.purgeExpired();
  const purgedState = harness.application.inspectState();
  const noRoomScopedRecords = Object.values(purgedState).every(
    (value) =>
      !Array.isArray(value) ||
      value.every(
        (record) =>
          typeof record !== "object" ||
          record === null ||
          !("roomId" in record) ||
          record.roomId !== harness.roomId,
      ),
  );

  return {
    fixture,
    language: fixture.language,
    fileAnalysis: {
      claims: observedClaims,
      prohibitedDeepStatements: observedGeneratedText
        .split("\n")
        .filter((text) =>
          /we recommend|the solution must|resolve this contradiction by/iu.test(
            text,
          ),
        ).length,
      promptInjectionIgnored:
        !fixture.scenarios.includes("prompt-injection") ||
        (injectedClientMutationRejected &&
          !injectionAffectedDownstreamState &&
          operationContractsIntact &&
          !items.some(
            ({ text }) =>
              /ignore prior|declare this requirement/iu.test(text),
          )),
      suspectedSecretsMasked:
        !fixture.scenarios.includes("suspected-secret") ||
        harness.capturedAnalyzerText.every(
          (text) => !text.includes("sk_test_12345678901234567890"),
        ),
    },
    retrieval: {
      queries: retrievalQueries,
      crossRoomResults: crossRoomRejected ? 0 : 1,
    },
    interview: {
      plainlyAnsweredQuestionsRepeated: fixture.materials.some(({ text }) =>
        text.toLocaleLowerCase().includes(firstQuestion.toLocaleLowerCase()),
      )
        ? 1
        : 0,
      seededCriticalItems,
      surfacedCriticalItems,
      maxVagueFollowUps,
      clientRequestsPromotedToAgreed,
      lateMaterialAffectedNextReasoning,
      correctionAffectedNextReasoning,
      acceptedHistoryRewrites,
    },
    brief: {
      unsupportedAgreedRequirements: items.filter(
        ({ id, kind, sources }) =>
          kind === "requirement" &&
          agreedRequirementIds.has(id) &&
          sources.length === 0,
      ).length,
      substantiveClaims: items.length,
      tracedSubstantiveClaims: items.filter(
        ({ sources }) => sources.length > 0,
      ).length,
      unresolvedCriticalItems: findings.length,
      prominentlyShownCriticalItems: findings.filter(({ id }) =>
        items.some(({ findingId }) => findingId === id),
      ).length,
      inventedCommitments,
      readable:
        draft.sections.length >= 10 &&
        draft.sections.every(({ title, content }) => title && content),
    },
    stateSecurity: {
      lostOrDuplicateTurns:
        interview.answerCount === interview.turns.length ? 0 : 1,
      revokedLinkRejected,
      takeoverDoubleSubmitPrevented,
      retryIdempotent:
        decideIdempotentOperation({
          status: "succeeded",
          attemptCount: 1,
        }).action === "reuse",
      cascadeDeletionVerified:
        deletedHidden &&
        recovered &&
        purgedIds.includes(harness.roomId) &&
        noRoomScopedRecords,
      quotaRejectedBeforeWork: operational.quotaRejectedBeforeWork,
      throttlingRejectedBeforeWork:
        operational.throttlingRejectedBeforeWork,
      boundedRetriesVerified: operational.boundedRetriesVerified,
      fortyTurnCheckpointVerified,
      aiMetadataRecorded: aiOperations.every(
        ({ attemptCount, model, provider, promptVersion, schemaVersion }) =>
          attemptCount >= 1 &&
          Boolean(model) &&
          Boolean(provider) &&
          Boolean(promptVersion) &&
          Boolean(schemaVersion),
      ),
      auditPayloadScrubbed,
    },
  };
};

export const executeEvaluationCorpus = async (
  fixtures: readonly EvaluationFixture[],
): Promise<readonly EvaluationObservation[]> => {
  const fortyTurnCheckpointVerified = await verifyFortyTurnCheckpoint();
  const observations: EvaluationObservation[] = [];
  for (const fixture of fixtures) {
    observations.push(
      await executeFixture(fixture, fortyTurnCheckpointVerified),
    );
  }
  return observations;
};
