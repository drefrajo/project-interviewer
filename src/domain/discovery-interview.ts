import type {
  ClientActor,
  Language,
  ProjectPhase,
  RoomActor,
} from "./project-interviewer";
import type {
  ContextPackRevision,
  SourceLocator,
} from "./project-material";

export type CoverageStatus =
  | "uncovered"
  | "partial"
  | "sufficient"
  | "not_applicable";

export type FindingType =
  | "candidate_requirement"
  | "assumption"
  | "risk"
  | "gap"
  | "contradiction";

export type EvidenceReference =
  | { type: "project_description" }
  | {
      type: "material";
      materialId: string;
      locator: SourceLocator;
    }
  | { type: "turn"; turnId: string }
  | { type: "correction"; correctionId: string }
  | { type: "analysis_feedback"; feedbackId: string }
  | { type: "model_inference"; description: string };

export interface CoverageArea {
  id: string;
  label: string;
  rubric: string;
  status: CoverageStatus;
  evidence: EvidenceReference[];
  rationale: string;
  openQuestions: string[];
  required: boolean;
  vagueFollowupCount?: number;
}

export interface InterviewQuestionDraft {
  text: string;
  coverageAreaId: string;
  kind: "primary" | "follow_up" | "final_anything_else";
  reason: string;
}

export interface InterviewQuestion extends InterviewQuestionDraft {
  id: string;
  askedAt: number;
}

export interface InterviewPlan {
  id: string;
  roomId: string;
  profileId: "software-project";
  profileVersion: "software-project-v1";
  language: Language;
  coverageAreas: CoverageArea[];
  knownRisks: string[];
  openGoals: string[];
  model: string;
  provider: string;
  promptVersion: "software-project-interview-planner-v1";
  schemaVersion: "interview-plan-v1";
  createdAt: number;
  updatedAt: number;
}

export interface DiscoveryFinding {
  id: string;
  roomId: string;
  interviewId: string;
  type: FindingType;
  statement: string;
  sources: EvidenceReference[];
  status:
    | "active"
    | "resolved"
    | "explicitly_open"
    | "needs_reassessment";
  createdAt: number;
}

export interface InterviewTurn {
  id: string;
  roomId: string;
  interviewId: string;
  sequence: number;
  question: InterviewQuestion;
  answer: string;
  answerKind: "answer" | "skip";
  idempotencyKey: string;
  contextPackRevisionId: string | null;
  contextPackRevision: number | null;
  acceptedAt: number;
}

export interface InterviewCorrection {
  id: string;
  roomId: string;
  interviewId: string;
  turnId: string;
  correctedAnswer: string;
  reason: string;
  deviceId: string;
  createdAt: number;
}

export interface InterviewEvent {
  id: string;
  roomId: string;
  interviewId: string;
  type: "project_material_added";
  materialId: string;
  contextPackRevisionId: string;
  contextPackRevision: number;
  createdAt: number;
  handledAtTurnId?: string | undefined;
}

export interface RespondingDeviceLease {
  interviewId: string;
  roomId: string;
  deviceId: string;
  version: number;
  heartbeatAt: number;
  createdAt: number;
}

export type InterviewStatus =
  | "planning"
  | "active"
  | "paused"
  | "retryable"
  | "awaiting_confirmation"
  | "completed"
  | "completed_early";

export interface DiscoveryInterview {
  id: string;
  roomId: string;
  planId: string;
  language: Language;
  status: InterviewStatus;
  currentQuestion?: InterviewQuestion | undefined;
  operationStatus: "idle" | "running" | "retryable";
  answerCount: number;
  unresolvedTopics: string[];
  completionRationale?: string | undefined;
  incompleteReason?: string | undefined;
  reviewerBlockers: string[];
  usageReviewTriggered: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface InterviewOperation {
  id: string;
  roomId: string;
  interviewId: string;
  turnId?: string;
  operationType:
    | "interview_planning"
    | "interview_turn"
    | "interview_review";
  idempotencyKey: string;
  status:
    | "pending"
    | "running"
    | "retryable"
    | "succeeded"
    | "failed"
    | "cancelled";
  stage: string;
  attemptCount: number;
  model?: string | undefined;
  provider?: string | undefined;
  promptVersion: string;
  schemaVersion: string;
  contextPackRevisionId?: string | undefined;
  inputTokens?: number | undefined;
  outputTokens?: number | undefined;
  estimatedCostUsd?: number | undefined;
  latencyMs?: number | undefined;
  errorCode?: string | undefined;
  createdAt: number;
  updatedAt: number;
}

export interface DiscoveryInterviewState {
  discoveryInterviews: DiscoveryInterview[];
  interviewPlans: InterviewPlan[];
  interviewTurns: InterviewTurn[];
  interviewCorrections: InterviewCorrection[];
  discoveryFindings: DiscoveryFinding[];
  interviewEvents: InterviewEvent[];
  respondingDeviceLeases: RespondingDeviceLease[];
  interviewOperations: InterviewOperation[];
}

export interface PlannerDraft {
  profileId: "software-project";
  profileVersion: "software-project-v1";
  coverageAreas: CoverageArea[];
  knownRisks: string[];
  openGoals: string[];
  firstQuestion: InterviewQuestionDraft;
  model: string;
  provider: string;
  usage?: ModelUsage;
}

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd?: number;
}

export interface InterviewAgentDelta {
  coverageUpdates: Array<
    Pick<
      CoverageArea,
      "id" | "status" | "evidence" | "rationale" | "openQuestions"
    > & { vagueFollowupCount?: number }
  >;
  findings: Array<
    Pick<DiscoveryFinding, "type" | "statement" | "sources"> & {
      status?: Extract<
        DiscoveryFinding["status"],
        "active" | "resolved" | "explicitly_open"
      >;
    }
  >;
  findingStatusUpdates?: Array<
    Pick<DiscoveryFinding, "id" | "status" | "sources">
  >;
  unresolvedTopics: string[];
  nextQuestion?: InterviewQuestionDraft;
  completionAssessment: {
    proposeCompletion: boolean;
    rationale: string;
  };
  model: string;
  provider: string;
  usage?: ModelUsage;
}

export interface ReviewerDraft {
  blockers: string[];
  weakCoverageAreaIds: string[];
  rationale: string;
  model: string;
  provider: string;
  usage?: ModelUsage;
}

export interface InterviewAdapters {
  planner?: {
    plan(input: {
      language: Language;
      projectDescription: string;
      freelancerGuidance: string;
      contextPack: ContextPackRevision | null;
      profile: typeof SOFTWARE_PROJECT_PROFILE;
      repairErrors?: string[];
    }): Promise<PlannerDraft>;
  };
  agent?: {
    advance(input: {
      language: Language;
      projectDescription: string;
      freelancerGuidance: string;
      contextPack: ContextPackRevision | null;
      plan: InterviewPlan;
      turns: InterviewTurn[];
      corrections: InterviewCorrection[];
      findings: DiscoveryFinding[];
      events: InterviewEvent[];
      acceptedTurn: InterviewTurn;
      retrieveEvidence?: (
        query: string,
        limit?: number,
      ) => Promise<
        Array<{
          materialId: string;
          text: string;
          locator: SourceLocator;
          score: number;
        }>
      >;
      inspectEvidence?: (
        materialId: string,
        maxCharacters?: number,
      ) => Promise<
        Array<{
          materialId: string;
          text: string;
          locator: SourceLocator;
        }>
      >;
      repairErrors?: string[];
    }): Promise<InterviewAgentDelta>;
  };
  reviewer?: {
    review(input: {
      language: Language;
      contextPack: ContextPackRevision | null;
      profile: typeof SOFTWARE_PROJECT_PROFILE;
      plan: InterviewPlan;
      turns: InterviewTurn[];
      corrections: InterviewCorrection[];
      findings: DiscoveryFinding[];
      repairErrors?: string[];
    }): Promise<ReviewerDraft>;
  };
}

export interface InterviewRoomContext {
  id: string;
  projectDescription: string;
  freelancerGuidance: string;
  clientInterviewLanguage?: Language;
  phase: ProjectPhase;
}

export interface DiscoveryInterviewView {
  id: string;
  roomId: string;
  language: Language;
  status: InterviewStatus;
  respondingDevice: boolean;
  leaseVersion: number | null;
  currentQuestion?: InterviewQuestion | undefined;
  operationStatus: DiscoveryInterview["operationStatus"];
  answerCount: number;
  plan?: Pick<InterviewPlan, "profileId" | "profileVersion"> | undefined;
  coverage: Array<Pick<CoverageArea, "id" | "label" | "status">>;
  turns: InterviewTurn[];
  corrections: InterviewCorrection[];
  findings: DiscoveryFinding[];
  events: InterviewEvent[];
  unresolvedTopics: string[];
  completionRationale?: string | undefined;
  incompleteReason?: string | undefined;
  reviewerBlockers: string[];
  usageReviewTriggered: boolean;
  operation?: Pick<
    InterviewOperation,
    | "operationType"
    | "status"
    | "stage"
    | "attemptCount"
    | "model"
    | "provider"
    | "promptVersion"
    | "schemaVersion"
    | "contextPackRevisionId"
    | "inputTokens"
    | "outputTokens"
    | "estimatedCostUsd"
    | "latencyMs"
    | "errorCode"
  > | undefined;
}

export const SOFTWARE_PROJECT_PROFILE = {
  id: "software-project",
  version: "software-project-v1",
  requiredCoverageAreas: [
    "goals-users",
    "scope",
    "constraints",
    "success",
    "delivery",
  ],
  findingTypes: [
    "candidate_requirement",
    "assumption",
    "risk",
    "gap",
    "contradiction",
  ],
} as const;

export class RespondingDeviceError extends Error {
  constructor(message = "Another device currently has response permission.") {
    super(message);
    this.name = "RespondingDeviceError";
  }
}

export class InterviewStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InterviewStateError";
  }
}

class CancelledInterviewOperationError extends InterviewStateError {}

interface CoordinatorDependencies extends InterviewAdapters {
  state: DiscoveryInterviewState;
  ids: { next(prefix: string): string };
  clock: { now(): number };
  authorize(actor: RoomActor, roomId: string): InterviewRoomContext;
  latestContextPack(roomId: string): ContextPackRevision | null;
  contextPackById(id: string): ContextPackRevision | null;
  retrieveEvidence?(
    roomId: string,
    query: string,
    limit?: number,
  ): Promise<
    Array<{
      materialId: string;
      text: string;
      locator: SourceLocator;
      score: number;
    }>
  >;
  inspectEvidence?(
    roomId: string,
    materialId: string,
    maxCharacters?: number,
  ): Promise<
    Array<{
      materialId: string;
      text: string;
      locator: SourceLocator;
    }>
  >;
  materialReady(roomId: string): boolean;
  setRoomPhase(roomId: string, phase: ProjectPhase): void;
  touchRoom(roomId: string): void;
  synchronize(): void;
  persist(): void;
  audit(actor: RoomActor, roomId: string, action: string): void;
}

const clone = <T>(value: T): T => structuredClone(value);

export const createDiscoveryInterviewCoordinator = (
  dependencies: CoordinatorDependencies,
) => {
  const inFlightTurns = new Map<
    string,
    Promise<DiscoveryInterviewView>
  >();
  const throwIfCancelled = (
    operation: InterviewOperation,
    expectedAttempt?: number,
  ): void => {
    dependencies.synchronize();
    const current = dependencies.state.interviewOperations.find(
      ({ id }) => id === operation.id,
    );
    if (
      !current ||
      operation.status === "cancelled" ||
      (expectedAttempt !== undefined &&
        operation.attemptCount !== expectedAttempt)
    ) {
      throw new CancelledInterviewOperationError(
        "The Interview operation was cancelled.",
      );
    }
  };

  for (const operation of dependencies.state.interviewOperations) {
    if (["pending", "running"].includes(operation.status)) {
      operation.status = "retryable";
      operation.stage = "complete";
      operation.errorCode = "interrupted_operation";
      operation.updatedAt = dependencies.clock.now();
      const interview = dependencies.state.discoveryInterviews.find(
        ({ id }) => id === operation.interviewId,
      );
      if (interview) {
        interview.status = "retryable";
        interview.operationStatus = "retryable";
      }
    }
  }

  const requireClient = (
    actor: RoomActor,
    roomId: string,
  ): ClientActor => {
    const room = dependencies.authorize(actor, roomId);
    if (room.phase === "archived") {
      throw new InterviewStateError(
        "Archived Project Rooms are read-only.",
      );
    }
    if (actor.kind !== "client") {
      throw new InterviewStateError(
        "Only the Client may control the Discovery Interview.",
      );
    }
    return actor;
  };

  const findInterview = (
    roomId: string,
  ): DiscoveryInterview | undefined =>
    dependencies.state.discoveryInterviews.find(
      (interview) => interview.roomId === roomId,
    );

  const requireInterview = (roomId: string): DiscoveryInterview => {
    const interview = findInterview(roomId);
    if (!interview) {
      throw new InterviewStateError(
        "The Discovery Interview has not started.",
      );
    }
    return interview;
  };

  const requirePlan = (interview: DiscoveryInterview): InterviewPlan => {
    const plan = dependencies.state.interviewPlans.find(
      ({ id }) => id === interview.planId,
    );
    if (!plan) throw new InterviewStateError("Interview Plan is missing.");
    return plan;
  };

  const currentLease = (
    interviewId: string,
  ): RespondingDeviceLease | undefined =>
    dependencies.state.respondingDeviceLeases.find(
      (lease) => lease.interviewId === interviewId,
    );

  const claimLease = (
    actor: ClientActor,
    interview: DiscoveryInterview,
    takeover = false,
  ): RespondingDeviceLease => {
    const existing = currentLease(interview.id);
    if (
      existing &&
      existing.deviceId !== actor.deviceId &&
      !takeover
    ) {
      throw new RespondingDeviceError();
    }
    const now = dependencies.clock.now();
    if (existing) {
      const deviceChanged = existing.deviceId !== actor.deviceId;
      existing.deviceId = actor.deviceId;
      if (deviceChanged) existing.version += 1;
      existing.heartbeatAt = now;
      return existing;
    }
    const lease: RespondingDeviceLease = {
      interviewId: interview.id,
      roomId: interview.roomId,
      deviceId: actor.deviceId,
      version: 1,
      heartbeatAt: now,
      createdAt: now,
    };
    dependencies.state.respondingDeviceLeases.push(lease);
    return lease;
  };

  const requireResponder = (
    actor: ClientActor,
    interview: DiscoveryInterview,
  ): RespondingDeviceLease => {
    const lease = currentLease(interview.id);
    if (!lease || lease.deviceId !== actor.deviceId) {
      throw new RespondingDeviceError();
    }
    return lease;
  };

  const toView = (
    actor: RoomActor,
    interview: DiscoveryInterview,
  ): DiscoveryInterviewView => {
    const plan = dependencies.state.interviewPlans.find(
      ({ id }) => id === interview.planId,
    );
    const lease = currentLease(interview.id);
    const latestOperation =
      dependencies.state.interviewOperations
        .filter(
          ({ interviewId }) => interviewId === interview.id,
        )
        .sort((left, right) => right.updatedAt - left.updatedAt)[0];
    return {
      id: interview.id,
      roomId: interview.roomId,
      language: interview.language,
      status: interview.status,
      respondingDevice:
        actor.kind === "client" &&
        lease?.deviceId === actor.deviceId,
      leaseVersion: lease?.version ?? null,
      ...(interview.currentQuestion
        ? { currentQuestion: clone(interview.currentQuestion) }
        : {}),
      coverage:
        plan?.coverageAreas.map(({ id, label, status }) => ({
          id,
          label,
          status,
        })) ?? [],
      operationStatus: interview.operationStatus,
      answerCount: interview.answerCount,
      ...(plan
        ? {
            plan: {
              profileId: plan.profileId,
              profileVersion: plan.profileVersion,
            },
          }
        : {}),
      turns: clone(
        dependencies.state.interviewTurns
          .filter(({ interviewId }) => interviewId === interview.id)
          .sort((left, right) => left.sequence - right.sequence),
      ),
      corrections: clone(
        dependencies.state.interviewCorrections.filter(
          ({ interviewId }) => interviewId === interview.id,
        ),
      ),
      findings: clone(
        dependencies.state.discoveryFindings.filter(
          ({ interviewId }) => interviewId === interview.id,
        ),
      ),
      events: clone(
        dependencies.state.interviewEvents.filter(
          ({ interviewId }) => interviewId === interview.id,
        ),
      ),
      unresolvedTopics: clone(interview.unresolvedTopics),
      ...(interview.completionRationale
        ? { completionRationale: interview.completionRationale }
        : {}),
      ...(interview.incompleteReason
        ? { incompleteReason: interview.incompleteReason }
        : {}),
      reviewerBlockers: clone(interview.reviewerBlockers),
      usageReviewTriggered: interview.usageReviewTriggered,
      ...(latestOperation
        ? {
            operation: clone(latestOperation),
          }
        : {}),
    };
  };

  const createQuestion = (
    draft: InterviewQuestionDraft,
  ): InterviewQuestion => ({
    id: dependencies.ids.next("question"),
    ...clone(draft),
    askedAt: dependencies.clock.now(),
  });

  const recordModelUsage = (
    operation: InterviewOperation,
    output: { usage?: ModelUsage },
    startedAt: number,
  ): void => {
    const usage = output.usage ?? {
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
    };
    operation.inputTokens =
      (operation.inputTokens ?? 0) + usage.inputTokens;
    operation.outputTokens =
      (operation.outputTokens ?? 0) + usage.outputTokens;
    operation.estimatedCostUsd =
      (operation.estimatedCostUsd ?? 0) +
      (usage.estimatedCostUsd ?? 0);
    operation.latencyMs =
      (operation.latencyMs ?? 0) +
      Math.max(0, dependencies.clock.now() - startedAt);
  };

  const runPlanner = async (
    room: InterviewRoomContext,
    interview: DiscoveryInterview,
  ): Promise<InterviewPlan> => {
    if (!dependencies.planner) {
      throw new InterviewStateError(
        "Interview Planner is not configured.",
      );
    }
    const operation = createOperation(
      interview,
      "interview_planning",
      `interview_planning:${interview.id}`,
      "software-project-interview-planner-v1",
      "interview-plan-v1",
    );
    let draft: PlannerDraft | undefined;
    let validationError = "";
    const contextPack = dependencies.latestContextPack(room.id);
    operation.status = "running";
    operation.stage = "planning";
    if (contextPack) operation.contextPackRevisionId = contextPack.id;
    dependencies.persist();
    try {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        operation.attemptCount += 1;
        const operationAttempt = operation.attemptCount;
        const startedAt = dependencies.clock.now();
        draft = await dependencies.planner.plan({
          language: interview.language,
          projectDescription: room.projectDescription,
          freelancerGuidance: room.freelancerGuidance,
          contextPack,
          profile: SOFTWARE_PROJECT_PROFILE,
          ...(validationError
            ? { repairErrors: [validationError] }
            : {}),
        });
        throwIfCancelled(operation, operationAttempt);
        operation.model = draft.model;
        operation.provider = draft.provider;
        recordModelUsage(operation, draft, startedAt);
        validationError = validatePlanDraft(draft, contextPack);
        if (!validationError) break;
      }
    } catch {
      throwIfCancelled(operation);
      validationError = "Interview Planner provider failed.";
    }
    if (!draft || validationError) {
      operation.status = "retryable";
      operation.stage = "complete";
      operation.errorCode = "invalid_interview_plan";
      interview.status = "retryable";
      interview.operationStatus = "retryable";
      dependencies.persist();
      throw new InterviewStateError(
        `Interview planning failed: ${validationError}`,
      );
    }
    const now = dependencies.clock.now();
    const plan: InterviewPlan = {
      id: interview.planId,
      roomId: room.id,
      profileId: draft.profileId,
      profileVersion: draft.profileVersion,
      language: interview.language,
      coverageAreas: clone(draft.coverageAreas),
      knownRisks: clone(draft.knownRisks),
      openGoals: clone(draft.openGoals),
      model: draft.model,
      provider: draft.provider,
      promptVersion: "software-project-interview-planner-v1",
      schemaVersion: "interview-plan-v1",
      createdAt: now,
      updatedAt: now,
    };
    dependencies.state.interviewPlans.push(plan);
    interview.currentQuestion = createQuestion(draft.firstQuestion);
    interview.status = "active";
    interview.operationStatus = "idle";
    interview.updatedAt = now;
    operation.status = "succeeded";
    operation.stage = "complete";
    operation.updatedAt = now;
    dependencies.persist();
    return plan;
  };

  const createOperation = (
    interview: DiscoveryInterview,
    operationType: InterviewOperation["operationType"],
    idempotencyKey: string,
    promptVersion: string,
    schemaVersion: string,
    turnId?: string,
  ): InterviewOperation => {
    const existing = dependencies.state.interviewOperations.find(
      (operation) =>
        operation.interviewId === interview.id &&
        operation.idempotencyKey === idempotencyKey,
    );
    if (existing) return existing;
    const now = dependencies.clock.now();
    const operation: InterviewOperation = {
      id: dependencies.ids.next("interview_operation"),
      roomId: interview.roomId,
      interviewId: interview.id,
      ...(turnId ? { turnId } : {}),
      operationType,
      idempotencyKey,
      status: "pending",
      stage: "accepted",
      attemptCount: 0,
      promptVersion,
      schemaVersion,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      latencyMs: 0,
      createdAt: now,
      updatedAt: now,
    };
    dependencies.state.interviewOperations.push(operation);
    return operation;
  };

  const runReviewer = async (
    interview: DiscoveryInterview,
    plan: InterviewPlan,
    input: {
      answerCount: number;
      findings: DiscoveryFinding[];
      contextPack: ContextPackRevision | null;
    },
  ): Promise<ReviewerDraft> => {
    if (!dependencies.reviewer) {
      throw new InterviewStateError(
        "Interview Reviewer is not configured.",
      );
    }
    const operation = createOperation(
      interview,
      "interview_review",
      `interview_review:${interview.id}:${input.answerCount}`,
      "software-project-interview-reviewer-v1",
      "interview-review-v1",
    );
    let review: ReviewerDraft | undefined;
    let validationError = "";
    operation.status = "running";
    operation.stage = "reviewing";
    if (input.contextPack) {
      operation.contextPackRevisionId = input.contextPack.id;
    }
    dependencies.persist();
    try {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        operation.attemptCount += 1;
        const operationAttempt = operation.attemptCount;
        const startedAt = dependencies.clock.now();
        review = await dependencies.reviewer.review({
          language: interview.language,
          contextPack: input.contextPack,
          profile: SOFTWARE_PROJECT_PROFILE,
          plan: clone(plan),
          turns: clone(
            dependencies.state.interviewTurns.filter(
              ({ interviewId }) => interviewId === interview.id,
            ),
          ),
          corrections: clone(
            dependencies.state.interviewCorrections.filter(
              ({ interviewId }) => interviewId === interview.id,
            ),
          ),
          findings: clone(input.findings),
          ...(validationError
            ? { repairErrors: [validationError] }
            : {}),
        });
        throwIfCancelled(operation, operationAttempt);
        operation.model = review.model;
        operation.provider = review.provider;
        recordModelUsage(operation, review, startedAt);
        validationError =
          review.blockers.length > 10 ||
          review.weakCoverageAreaIds.some(
            (id) =>
              !plan.coverageAreas.some((area) => area.id === id),
          )
            ? "Interview Reviewer returned invalid output."
            : "";
        if (!validationError) break;
      }
    } catch {
      throwIfCancelled(operation);
      validationError = "Interview Reviewer provider failed.";
    }
    operation.status = validationError ? "retryable" : "succeeded";
    operation.stage = "complete";
    operation.updatedAt = dependencies.clock.now();
    if (!review || validationError) {
      throw new InterviewStateError(
        validationError || "Interview Reviewer returned no output.",
      );
    }
    return clone(review);
  };

  const applyAgentDelta = async (
    actor: ClientActor,
    room: InterviewRoomContext,
    interview: DiscoveryInterview,
    turn: InterviewTurn,
    operation: InterviewOperation,
  ): Promise<DiscoveryInterviewView> => {
    if (!dependencies.agent) {
      throw new InterviewStateError("Interview Agent is not configured.");
    }
    const plan = requirePlan(interview);
    const acceptedContextPack = turn.contextPackRevisionId
      ? dependencies.contextPackById(turn.contextPackRevisionId)
      : null;
    let draft: InterviewAgentDelta | undefined;
    let validationError = "";
    operation.status = "running";
    operation.stage = "reasoning";
    operation.updatedAt = dependencies.clock.now();
    dependencies.persist();
    const relevantEvents =
      dependencies.state.interviewEvents.filter(
        (event) =>
          event.interviewId === interview.id &&
          !event.handledAtTurnId &&
          event.contextPackRevision <=
            (turn.contextPackRevision ?? 0),
      );
    for (let attempt = 0; attempt < 2; attempt += 1) {
      operation.attemptCount += 1;
      const operationAttempt = operation.attemptCount;
      const startedAt = dependencies.clock.now();
      draft = await dependencies.agent.advance({
        language: interview.language,
        projectDescription: room.projectDescription,
        freelancerGuidance: room.freelancerGuidance,
        contextPack: acceptedContextPack,
        plan: clone(plan),
        turns: clone(
          dependencies.state.interviewTurns.filter(
            ({ interviewId }) => interviewId === interview.id,
          ),
        ),
        corrections: clone(
          dependencies.state.interviewCorrections.filter(
            ({ interviewId }) => interviewId === interview.id,
          ),
        ),
        findings: clone(
          dependencies.state.discoveryFindings.filter(
            ({ interviewId }) => interviewId === interview.id,
          ),
        ),
        events: clone(relevantEvents),
        acceptedTurn: clone(turn),
        ...(dependencies.retrieveEvidence
          ? {
              retrieveEvidence: (query: string, limit?: number) =>
                dependencies
                  .retrieveEvidence!(room.id, query, limit)
                  .then((results) => {
                    const allowed = new Set(
                      acceptedContextPack?.includedMaterialIds ?? [],
                    );
                    return results.filter(({ materialId }) =>
                      allowed.has(materialId),
                    );
                  }),
            }
          : {}),
        ...(dependencies.inspectEvidence
          ? {
              inspectEvidence: (
                materialId: string,
                maxCharacters?: number,
              ) => {
                const allowed = new Set(
                  acceptedContextPack?.includedMaterialIds ?? [],
                );
                if (!allowed.has(materialId)) {
                  return Promise.resolve([]);
                }
                return dependencies.inspectEvidence!(
                  room.id,
                  materialId,
                  Math.max(
                    0,
                    Math.min(maxCharacters ?? 2_000, 4_000),
                  ),
                );
              },
            }
          : {}),
        ...(validationError
          ? { repairErrors: [validationError] }
          : {}),
      });
      throwIfCancelled(operation, operationAttempt);
      operation.model = draft.model;
      operation.provider = draft.provider;
      recordModelUsage(operation, draft, startedAt);
      validationError = validateAgentDelta(
        draft,
        plan,
        {
          turnIds: new Set(
            dependencies.state.interviewTurns
              .filter(
                ({ interviewId }) => interviewId === interview.id,
              )
              .map(({ id }) => id),
          ),
          correctionIds: new Set(
            dependencies.state.interviewCorrections
              .filter(
                ({ interviewId }) => interviewId === interview.id,
              )
              .map(({ id }) => id),
          ),
          findingIds: new Set(
            dependencies.state.discoveryFindings
              .filter(
                ({ interviewId }) => interviewId === interview.id,
              )
              .map(({ id }) => id),
          ),
          materialIds: new Set(
            acceptedContextPack?.includedMaterialIds ?? [],
          ),
          feedbackIds: new Set(
            acceptedContextPack?.feedback.map(({ id }) => id) ?? [],
          ),
          existingFindings:
            dependencies.state.discoveryFindings.filter(
              ({ interviewId }) => interviewId === interview.id,
            ),
        },
      );
      if (!validationError) break;
    }
    if (!draft || validationError) {
      operation.status = "retryable";
      operation.stage = "complete";
      operation.errorCode = "invalid_interview_delta";
      interview.status = "retryable";
      interview.operationStatus = "retryable";
      interview.updatedAt = dependencies.clock.now();
      dependencies.persist();
      return toView(actor, interview);
    }

    const stagedPlan = clone(plan);
    for (const update of draft.coverageUpdates) {
      const area = stagedPlan.coverageAreas.find(
        ({ id }) => id === update.id,
      );
      if (!area) continue;
      area.status = update.status;
      area.evidence = clone(update.evidence);
      area.rationale = update.rationale;
      area.openQuestions = clone(update.openQuestions);
      if (update.vagueFollowupCount !== undefined) {
        area.vagueFollowupCount = update.vagueFollowupCount;
      }
    }
    stagedPlan.updatedAt = dependencies.clock.now();
    const existingFindings =
      dependencies.state.discoveryFindings.filter(
        ({ interviewId }) => interviewId === interview.id,
      );
    const stagedExistingFindings = clone(existingFindings);
    for (const update of draft.findingStatusUpdates ?? []) {
      const finding = stagedExistingFindings.find(
        ({ id }) => id === update.id,
      );
      if (finding) {
        finding.status = update.status;
        finding.sources = clone(update.sources);
      }
    }
    const stagedNewFindings: DiscoveryFinding[] = [];
    for (const finding of draft.findings) {
      stagedNewFindings.push({
        id: dependencies.ids.next("finding"),
        roomId: room.id,
        interviewId: interview.id,
        type: finding.type,
        statement: finding.statement.trim(),
        sources: clone(finding.sources),
        status: finding.status ?? "active",
        createdAt: dependencies.clock.now(),
      });
    }
    stagedPlan.openGoals = stagedPlan.coverageAreas
      .filter(
        ({ status }) =>
          status === "uncovered" || status === "partial",
      )
      .map(({ label }) => label);
    stagedPlan.knownRisks = [
      ...new Set([
        ...stagedPlan.knownRisks,
        ...stagedNewFindings
          .filter(({ type }) => type === "risk")
          .map(({ statement }) => statement),
      ]),
    ];
    const nextAnswerCount = interview.answerCount + 1;

    const shouldReview =
      draft.completionAssessment.proposeCompletion ||
      nextAnswerCount % 40 === 0;
    let review: ReviewerDraft | undefined;
    if (shouldReview) {
      review = await runReviewer(interview, stagedPlan, {
        answerCount: nextAnswerCount,
        findings: [
          ...stagedExistingFindings,
          ...stagedNewFindings,
        ],
        contextPack: acceptedContextPack,
      });
      throwIfCancelled(operation);
    }
    Object.assign(plan, stagedPlan);
    for (const staged of stagedExistingFindings) {
      const current = dependencies.state.discoveryFindings.find(
        ({ id }) => id === staged.id,
      );
      if (current) Object.assign(current, staged);
    }
    dependencies.state.discoveryFindings.push(...stagedNewFindings);
    interview.unresolvedTopics = clone(draft.unresolvedTopics);
    interview.completionRationale =
      draft.completionAssessment.rationale.trim();
    interview.answerCount = nextAnswerCount;
    for (const event of relevantEvents) {
      event.handledAtTurnId = turn.id;
    }
    if (review) {
      interview.reviewerBlockers = clone(review.blockers);
      if (nextAnswerCount % 40 === 0) {
        interview.usageReviewTriggered = true;
      }
    }
    if (
      turn.question.kind === "final_anything_else" &&
      draft.completionAssessment.proposeCompletion &&
      review &&
      review.blockers.length === 0
    ) {
      delete interview.currentQuestion;
      interview.status = "awaiting_confirmation";
      interview.completionRationale =
        "Agent sufficiency, reviewer clearance, and final Client check completed.";
    } else if (
      draft.completionAssessment.proposeCompletion &&
      review &&
      review.blockers.length === 0
    ) {
      interview.currentQuestion = createQuestion({
        text:
          interview.language === "de"
            ? "Gibt es noch etwas Wichtiges, das wir für den Projektbrief festhalten sollten?"
            : "Is there anything else important we should capture for the Project Brief?",
        coverageAreaId: "final",
        kind: "final_anything_else",
        reason: "Final Client check before completion confirmation.",
      });
    } else if (draft.nextQuestion) {
      interview.currentQuestion = createQuestion(draft.nextQuestion);
    } else {
      const openArea = plan.coverageAreas.find(
        ({ status }) =>
          status === "uncovered" || status === "partial",
      );
      if (!openArea) {
        interview.currentQuestion = createQuestion({
          text:
            interview.language === "de"
              ? "Welche offene Unsicherheit ist für dieses Projekt am wichtigsten?"
              : "Which remaining uncertainty matters most for this project?",
          coverageAreaId: "final",
          kind: "primary",
          reason: "A next question is required until completion clears review.",
        });
      } else {
        interview.currentQuestion = createQuestion({
          text:
            openArea.openQuestions[0] ??
            (interview.language === "de"
              ? `Was sollten wir noch zu „${openArea.label}“ klären?`
              : `What should we still clarify about ${openArea.label}?`),
          coverageAreaId: openArea.id,
          kind: "primary",
          reason: `Coverage remains ${openArea.status}.`,
        });
      }
    }
    if (interview.status !== "awaiting_confirmation") {
      interview.status = "active";
    }
    interview.operationStatus = "idle";
    interview.updatedAt = dependencies.clock.now();
    operation.status = "succeeded";
    operation.stage = "complete";
    operation.updatedAt = dependencies.clock.now();
    delete operation.errorCode;
    dependencies.persist();
    return toView(actor, interview);
  };

  const applyAgentDeltaWithRecovery = (
    actor: ClientActor,
    room: InterviewRoomContext,
    interview: DiscoveryInterview,
    turn: InterviewTurn,
    operation: InterviewOperation,
  ): Promise<DiscoveryInterviewView> =>
    applyAgentDelta(
      actor,
      room,
      interview,
      turn,
      operation,
    ).catch((error: unknown) => {
      if (error instanceof CancelledInterviewOperationError) {
        throw error;
      }
      throwIfCancelled(operation);
      operation.status = "retryable";
      operation.stage = "complete";
      operation.errorCode = "interview_reasoning_failed";
      operation.updatedAt = dependencies.clock.now();
      interview.status = "retryable";
      interview.operationStatus = "retryable";
      interview.updatedAt = dependencies.clock.now();
      dependencies.persist();
      return toView(actor, interview);
    });

  const acceptTurn = (
    actor: ClientActor,
    roomId: string,
    input: {
      questionId: string;
      answer: string;
      answerKind: "answer" | "skip";
      idempotencyKey: string;
      contextPackRevisionId: string | null;
    },
  ): Promise<DiscoveryInterviewView> => {
    const room = dependencies.authorize(actor, roomId);
    const interview = requireInterview(roomId);
    requireResponder(actor, interview);
    if (!dependencies.materialReady(roomId)) {
      throw new InterviewStateError(
        "Current Project Material must finish processing before answering.",
      );
    }
    const repeated = dependencies.state.interviewTurns.find(
      (turn) =>
        turn.interviewId === interview.id &&
        turn.idempotencyKey === input.idempotencyKey,
    );
    const inFlightKey = `${interview.id}:${input.idempotencyKey}`;
    if (repeated) {
      return (
        inFlightTurns.get(inFlightKey) ??
        Promise.resolve(toView(actor, interview))
      );
    }
    if (
      interview.status !== "active" ||
      interview.operationStatus === "running" ||
      interview.currentQuestion?.id !== input.questionId
    ) {
      throw new InterviewStateError(
        "The answer does not match the current question.",
      );
    }
    const contextPack = dependencies.latestContextPack(roomId);
    if (
      (contextPack?.id ?? null) !== input.contextPackRevisionId
    ) {
      throw new InterviewStateError(
        "Project Material changed; reload the current question.",
      );
    }
    if (
      input.answerKind === "answer" &&
      !input.answer.trim()
    ) {
      throw new InterviewStateError("An answer is required.");
    }
    const question = clone(interview.currentQuestion);
    const now = dependencies.clock.now();
    const turn: InterviewTurn = {
      id: dependencies.ids.next("turn"),
      roomId,
      interviewId: interview.id,
      sequence:
        dependencies.state.interviewTurns.filter(
          ({ interviewId }) => interviewId === interview.id,
        ).length + 1,
      question,
      answer:
        input.answerKind === "skip"
          ? interview.language === "de"
            ? "Übersprungen"
            : "Skipped"
          : input.answer.trim(),
      answerKind: input.answerKind,
      idempotencyKey: input.idempotencyKey,
      contextPackRevisionId: contextPack?.id ?? null,
      contextPackRevision: contextPack?.revision ?? null,
      acceptedAt: now,
    };
    dependencies.state.interviewTurns.push(turn);
    dependencies.touchRoom(roomId);
    delete interview.currentQuestion;
    interview.operationStatus = "running";
    interview.updatedAt = now;
    const operation = createOperation(
      interview,
      "interview_turn",
      input.idempotencyKey,
      "software-project-interview-agent-v1",
      "interview-delta-v1",
      turn.id,
    );
    if (contextPack) {
      operation.contextPackRevisionId = contextPack.id;
    }
    if (input.answerKind === "skip") {
      dependencies.state.discoveryFindings.push({
        id: dependencies.ids.next("finding"),
        roomId,
        interviewId: interview.id,
        type: "gap",
        statement:
          interview.language === "de"
            ? `Der Client hat „${question.text}“ übersprungen.`
            : `The Client skipped “${question.text}”.`,
        sources: [{ type: "turn", turnId: turn.id }],
        status: "active",
        createdAt: now,
      });
    }
    dependencies.persist();

    const promise = applyAgentDeltaWithRecovery(
      actor,
      room,
      interview,
      turn,
      operation,
    );
    inFlightTurns.set(inFlightKey, promise);
    void promise.then(
      () => inFlightTurns.delete(inFlightKey),
      () => inFlightTurns.delete(inFlightKey),
    );
    return promise;
  };

  return {
    async get(
      actor: RoomActor,
      roomId: string,
    ): Promise<DiscoveryInterviewView | null> {
      dependencies.authorize(actor, roomId);
      const interview = findInterview(roomId);
      return interview ? toView(actor, interview) : null;
    },

    async start(
      actor: RoomActor,
      roomId: string,
    ): Promise<DiscoveryInterviewView> {
      const client = requireClient(actor, roomId);
      const room = dependencies.authorize(client, roomId);
      if (!dependencies.materialReady(roomId)) {
        throw new InterviewStateError(
          "Project Material is not ready for discovery.",
        );
      }
      let interview = findInterview(roomId);
      if (interview) {
        claimLease(client, interview);
        if (
          interview.status === "retryable" &&
          !dependencies.state.interviewPlans.some(
            ({ id }) => id === interview!.planId,
          )
        ) {
          await runPlanner(room, interview);
          return toView(client, interview);
        }
        if (interview.status === "paused") {
          interview.status = "active";
        }
        interview.updatedAt = dependencies.clock.now();
        dependencies.persist();
        return toView(client, interview);
      }
      if (!room.clientInterviewLanguage) {
        throw new InterviewStateError("Client onboarding is incomplete.");
      }
      const now = dependencies.clock.now();
      interview = {
        id: dependencies.ids.next("interview"),
        roomId,
        planId: dependencies.ids.next("interview_plan"),
        language: room.clientInterviewLanguage,
        status: "planning",
        operationStatus: "running",
        answerCount: 0,
        unresolvedTopics: [],
        reviewerBlockers: [],
        usageReviewTriggered: false,
        createdAt: now,
        updatedAt: now,
      };
      dependencies.state.discoveryInterviews.push(interview);
      claimLease(client, interview);
      dependencies.audit(client, roomId, "interview.started");
      dependencies.persist();
      await runPlanner(room, interview);
      return toView(client, interview);
    },

    async heartbeat(
      actor: RoomActor,
      roomId: string,
    ): Promise<number> {
      const client = requireClient(actor, roomId);
      const interview = requireInterview(roomId);
      const lease = requireResponder(client, interview);
      lease.heartbeatAt = dependencies.clock.now();
      dependencies.persist();
      return lease.version;
    },

    async takeover(
      actor: RoomActor,
      roomId: string,
      input: { acknowledgedDraftLoss: boolean },
    ): Promise<DiscoveryInterviewView> {
      const client = requireClient(actor, roomId);
      if (!input.acknowledgedDraftLoss) {
        throw new InterviewStateError(
          "Takeover requires acknowledging draft loss on the other device.",
        );
      }
      const interview = requireInterview(roomId);
      claimLease(client, interview, true);
      dependencies.audit(client, roomId, "interview.device_taken_over");
      dependencies.persist();
      return toView(client, interview);
    },

    async submitAnswer(
      actor: RoomActor,
      roomId: string,
      input: {
        questionId: string;
        answer: string;
        idempotencyKey: string;
        contextPackRevisionId: string | null;
      },
    ): Promise<DiscoveryInterviewView> {
      const client = requireClient(actor, roomId);
      return acceptTurn(client, roomId, {
        ...input,
        answerKind: "answer",
      });
    },

    async skip(
      actor: RoomActor,
      roomId: string,
      input: {
        questionId: string;
        idempotencyKey: string;
        contextPackRevisionId: string | null;
      },
    ): Promise<DiscoveryInterviewView> {
      const client = requireClient(actor, roomId);
      return acceptTurn(client, roomId, {
        ...input,
        answer: "",
        answerKind: "skip",
      });
    },

    async retryPending(
      actor: RoomActor,
      roomId: string,
    ): Promise<DiscoveryInterviewView> {
      const client = requireClient(actor, roomId);
      const room = dependencies.authorize(client, roomId);
      const interview = requireInterview(roomId);
      requireResponder(client, interview);
      if (interview.operationStatus === "running") {
        throw new InterviewStateError(
          "The current Interview operation is still running.",
        );
      }
      if (
        !dependencies.state.interviewPlans.some(
          ({ id }) => id === interview.planId,
        )
      ) {
        if (interview.status !== "retryable") {
          throw new InterviewStateError(
            "Interview planning is not retryable.",
          );
        }
        interview.status = "planning";
        interview.operationStatus = "running";
        await runPlanner(room, interview);
        return toView(client, interview);
      }
      if (
        interview.status !== "retryable" ||
        interview.operationStatus !== "retryable"
      ) {
        throw new InterviewStateError(
          "Only a retryable interrupted Interview operation can be retried.",
        );
      }
      const operation = dependencies.state.interviewOperations
        .filter(
          (candidate) =>
            candidate.interviewId === interview.id &&
            ["retryable", "cancelled"].includes(candidate.status) &&
            Boolean(candidate.turnId),
        )
        .sort(
          (left, right) => right.updatedAt - left.updatedAt,
        )[0];
      if (!operation) {
        throw new InterviewStateError("Interview operation is missing.");
      }
      if (!["retryable", "cancelled"].includes(operation.status)) {
        throw new InterviewStateError(
          "The Interview operation is not retryable.",
        );
      }
      const turn = dependencies.state.interviewTurns.find(
        ({ id }) => id === operation.turnId,
      );
      if (!turn) {
        throw new InterviewStateError(
          "No interrupted Interview Turn can be retried.",
        );
      }
      interview.status = "active";
      interview.operationStatus = "running";
      return applyAgentDeltaWithRecovery(
        client,
        room,
        interview,
        turn,
        operation,
      );
    },

    async pause(
      actor: RoomActor,
      roomId: string,
    ): Promise<DiscoveryInterviewView> {
      const client = requireClient(actor, roomId);
      const interview = requireInterview(roomId);
      requireResponder(client, interview);
      if (interview.status !== "active") {
        throw new InterviewStateError(
          "Only an active Discovery Interview can be paused.",
        );
      }
      if (interview.operationStatus === "running") {
        throw new InterviewStateError(
          "Wait for the current answer to finish processing.",
        );
      }
      interview.status = "paused";
      interview.updatedAt = dependencies.clock.now();
      dependencies.touchRoom(roomId);
      dependencies.persist();
      return toView(client, interview);
    },

    async resume(
      actor: RoomActor,
      roomId: string,
    ): Promise<DiscoveryInterviewView> {
      const client = requireClient(actor, roomId);
      const interview = requireInterview(roomId);
      claimLease(client, interview);
      if (interview.status !== "paused") {
        throw new InterviewStateError(
          "Only a paused Discovery Interview can be resumed.",
        );
      }
      interview.status = "active";
      interview.updatedAt = dependencies.clock.now();
      dependencies.touchRoom(roomId);
      dependencies.persist();
      return toView(client, interview);
    },

    async finishEarly(
      actor: RoomActor,
      roomId: string,
      input: { confirmed: boolean; reason?: string },
    ): Promise<DiscoveryInterviewView> {
      const client = requireClient(actor, roomId);
      const interview = requireInterview(roomId);
      requireResponder(client, interview);
      if (
        interview.operationStatus === "running" ||
        !["active", "paused"].includes(
          interview.status,
        )
      ) {
        throw new InterviewStateError(
          "Discovery cannot finish while an operation is running or after completion.",
        );
      }
      if (!input.confirmed) {
        throw new InterviewStateError(
          "Finishing early requires explicit confirmation.",
        );
      }
      interview.status = "completed_early";
      interview.operationStatus = "idle";
      delete interview.currentQuestion;
      interview.incompleteReason =
        input.reason?.trim() ||
        "The Client deliberately finished discovery early.";
      interview.updatedAt = dependencies.clock.now();
      dependencies.setRoomPhase(roomId, "freelancer_review");
      dependencies.audit(client, roomId, "interview.finished_early");
      dependencies.persist();
      return toView(client, interview);
    },

    async correct(
      actor: RoomActor,
      roomId: string,
      input: {
        turnId: string;
        correctedAnswer: string;
        reason: string;
      },
    ): Promise<DiscoveryInterviewView> {
      const client = requireClient(actor, roomId);
      const interview = requireInterview(roomId);
      requireResponder(client, interview);
      if (interview.operationStatus === "running") {
        throw new InterviewStateError(
          "Wait for the current answer to finish processing before correcting it.",
        );
      }
      if (
        ["completed", "completed_early"].includes(interview.status)
      ) {
        throw new InterviewStateError(
          "Completed discovery must be reopened before correcting an answer.",
        );
      }
      const turn = dependencies.state.interviewTurns.find(
        (candidate) =>
          candidate.id === input.turnId &&
          candidate.interviewId === interview.id,
      );
      if (!turn || !input.correctedAnswer.trim()) {
        throw new InterviewStateError(
          "A submitted turn and corrected answer are required.",
        );
      }
      const correction: InterviewCorrection = {
        id: dependencies.ids.next("correction"),
        roomId,
        interviewId: interview.id,
        turnId: turn.id,
        correctedAnswer: input.correctedAnswer.trim(),
        reason: input.reason.trim(),
        deviceId: client.deviceId,
        createdAt: dependencies.clock.now(),
      };
      dependencies.state.interviewCorrections.push(correction);
      for (const finding of dependencies.state.discoveryFindings) {
        if (
          finding.interviewId === interview.id &&
          finding.sources.some(
            (source) =>
              source.type === "turn" &&
              source.turnId === turn.id,
          )
        ) {
          finding.status = "needs_reassessment";
        }
      }
      const plan = requirePlan(interview);
      for (const area of plan.coverageAreas) {
        if (
          area.evidence.some(
            (source) =>
              source.type === "turn" &&
              source.turnId === turn.id,
          )
        ) {
          area.status = "partial";
          area.rationale =
            "A linked Client answer was corrected and needs reassessment.";
        }
      }
      if (interview.status === "awaiting_confirmation") {
        const area =
          plan.coverageAreas.find(
            ({ status }) =>
              status === "uncovered" || status === "partial",
          ) ?? plan.coverageAreas[0];
        interview.status = "active";
        interview.currentQuestion = createQuestion({
          text:
            interview.language === "de"
              ? "Eine frühere Antwort wurde korrigiert. Was sollten wir dazu jetzt als maßgeblich festhalten?"
              : "An earlier answer was corrected. What should we now treat as authoritative?",
          coverageAreaId: area?.id ?? "goals-users",
          kind: "follow_up",
          reason:
            "A correction invalidated the previous completion clearance.",
        });
        interview.completionRationale =
          "Completion clearance was invalidated by a Client correction.";
        interview.reviewerBlockers = [
          "A Client correction requires Agent reassessment and Reviewer clearance.",
        ];
      }
      dependencies.audit(client, roomId, "interview.answer_corrected");
      dependencies.persist();
      return toView(client, interview);
    },

    async confirmCompletion(
      actor: RoomActor,
      roomId: string,
      input: { confirmed: boolean },
    ): Promise<DiscoveryInterviewView> {
      const client = requireClient(actor, roomId);
      const interview = requireInterview(roomId);
      requireResponder(client, interview);
      if (interview.status !== "awaiting_confirmation") {
        throw new InterviewStateError(
          "The interview is not ready for completion confirmation.",
        );
      }
      if (!input.confirmed) {
        interview.status = "active";
        interview.currentQuestion = createQuestion({
          text:
            interview.language === "de"
              ? "Was sollten wir noch klären?"
              : "What should we still clarify?",
          coverageAreaId: "final",
          kind: "primary",
          reason: "The Client declined completion confirmation.",
        });
      } else {
        interview.status = "completed";
        delete interview.currentQuestion;
        dependencies.setRoomPhase(roomId, "freelancer_review");
        dependencies.audit(client, roomId, "interview.completed");
      }
      interview.updatedAt = dependencies.clock.now();
      dependencies.persist();
      return toView(client, interview);
    },

    recordMaterialAdded(input: {
      roomId: string;
      materialId: string;
      contextPack: ContextPackRevision;
    }): void {
      const interview = findInterview(input.roomId);
      if (
        !interview ||
        ["completed", "completed_early"].includes(interview.status)
      ) {
        return;
      }
      if (
        dependencies.state.interviewEvents.some(
          (event) =>
            event.interviewId === interview.id &&
            event.materialId === input.materialId &&
            event.contextPackRevisionId === input.contextPack.id,
        )
      ) {
        return;
      }
      dependencies.state.interviewEvents.push({
        id: dependencies.ids.next("interview_event"),
        roomId: input.roomId,
        interviewId: interview.id,
        type: "project_material_added",
        materialId: input.materialId,
        contextPackRevisionId: input.contextPack.id,
        contextPackRevision: input.contextPack.revision,
        createdAt: dependencies.clock.now(),
      });
      dependencies.persist();
    },
  };
};

const validatePlanDraft = (
  draft: PlannerDraft,
  contextPack: ContextPackRevision | null,
): string => {
  const areaIds = new Set(draft.coverageAreas.map(({ id }) => id));
  if (
    draft.profileId !== "software-project" ||
    draft.profileVersion !== "software-project-v1" ||
    !draft.coverageAreas.length ||
    draft.coverageAreas.length > 12 ||
    !draft.firstQuestion.text.trim() ||
    draft.firstQuestion.text.length > 500 ||
    !draft.firstQuestion.reason.trim() ||
    draft.firstQuestion.kind !== "primary" ||
    !draft.coverageAreas.some(
      ({ id }) => id === draft.firstQuestion.coverageAreaId,
    ) ||
    SOFTWARE_PROJECT_PROFILE.requiredCoverageAreas.some(
      (id) => !areaIds.has(id),
    )
  ) {
    return "Interview Plan does not match its schema.";
  }
  const ids = new Set<string>();
  const materialIds = new Set(
    contextPack?.includedMaterialIds ?? [],
  );
  const feedbackIds = new Set(
    contextPack?.feedback.map(({ id }) => id) ?? [],
  );
  for (const area of draft.coverageAreas) {
    if (
      !area.id.trim() ||
      ids.has(area.id) ||
      !area.label.trim() ||
      !area.rubric.trim() ||
      ![
        "uncovered",
        "partial",
        "sufficient",
        "not_applicable",
      ].includes(area.status) ||
      area.openQuestions.length > 8 ||
      area.evidence.some((source) => {
        switch (source.type) {
          case "material":
            return (
              !materialIds.has(source.materialId) ||
              !source.locator.label.trim()
            );
          case "analysis_feedback":
            return !feedbackIds.has(source.feedbackId);
          case "model_inference":
            return !source.description.trim();
          case "turn":
          case "correction":
            return true;
        }
      })
    ) {
      return "Coverage Area does not match its schema.";
    }
    ids.add(area.id);
  }
  return "";
};

const validateAgentDelta = (
  draft: InterviewAgentDelta,
  plan: InterviewPlan,
  authorized: {
    turnIds: Set<string>;
    correctionIds: Set<string>;
    findingIds: Set<string>;
    materialIds: Set<string>;
    feedbackIds: Set<string>;
    existingFindings: DiscoveryFinding[];
  },
): string => {
  if (
    draft.coverageUpdates.length > plan.coverageAreas.length ||
    draft.findings.length > 12 ||
    (draft.findingStatusUpdates?.length ?? 0) > 12 ||
    draft.unresolvedTopics.length > 20 ||
    (draft.nextQuestion?.text.length ?? 0) > 500
  ) {
    return "Interview delta exceeds its bounds.";
  }
  const areaIds = new Set(plan.coverageAreas.map(({ id }) => id));
  const evidenceIsAuthorized = (
    source: EvidenceReference,
  ): boolean => {
    switch (source.type) {
      case "project_description":
        return true;
      case "turn":
        return authorized.turnIds.has(source.turnId);
      case "correction":
        return authorized.correctionIds.has(source.correctionId);
      case "material":
        return (
          authorized.materialIds.has(source.materialId) &&
          Boolean(source.locator.kind && source.locator.label.trim())
        );
      case "analysis_feedback":
        return authorized.feedbackIds.has(source.feedbackId);
      case "model_inference":
        return Boolean(source.description.trim());
    }
  };
  if (
    draft.coverageUpdates.some(
      (update) =>
        !areaIds.has(update.id) ||
        ![
          "uncovered",
          "partial",
          "sufficient",
          "not_applicable",
        ].includes(update.status) ||
        update.rationale.length > 800 ||
        update.openQuestions.length > 8 ||
        (update.vagueFollowupCount ?? 0) > 1 ||
        update.evidence.some(
          (source) => !evidenceIsAuthorized(source),
        ),
    )
  ) {
    return "Coverage update is invalid.";
  }
  for (const finding of draft.findings) {
    if (
      !SOFTWARE_PROJECT_PROFILE.findingTypes.includes(finding.type) ||
      !finding.statement.trim() ||
      finding.statement.length > 1_000 ||
      (finding.status !== undefined &&
        !["active", "resolved", "explicitly_open"].includes(
          finding.status,
        )) ||
      !finding.sources.length ||
      finding.sources.some((source) => !evidenceIsAuthorized(source))
    ) {
      return "Discovery Finding is invalid or untraceable.";
    }
  }
  if (
    draft.findingStatusUpdates?.some(
      ({ id, status, sources }) =>
        !authorized.findingIds.has(id) ||
        !["resolved", "explicitly_open"].includes(status) ||
        !sources.length ||
        sources.some((source) => !evidenceIsAuthorized(source)),
    )
  ) {
    return "Discovery Finding status update is invalid.";
  }
  if (
    draft.nextQuestion &&
    (!draft.nextQuestion.text.trim() ||
      !draft.nextQuestion.reason.trim() ||
      !areaIds.has(draft.nextQuestion.coverageAreaId) ||
      !["primary", "follow_up"].includes(
        draft.nextQuestion.kind,
      ))
  ) {
    return "Next question is invalid.";
  }
  if (
    !draft.completionAssessment.rationale.trim() ||
    (!draft.completionAssessment.proposeCompletion &&
      !draft.nextQuestion)
  ) {
    return "Completion assessment or next question is missing.";
  }
  if (draft.completionAssessment.proposeCompletion) {
    const projectedStatuses = new Map(
      plan.coverageAreas.map(({ id, status }) => [id, status]),
    );
    for (const update of draft.coverageUpdates) {
      projectedStatuses.set(update.id, update.status);
    }
    const requiredCoverageOpen =
      SOFTWARE_PROJECT_PROFILE.requiredCoverageAreas.some(
        (id) =>
          !["sufficient", "not_applicable"].includes(
            projectedStatuses.get(id) ?? "uncovered",
          ),
      );
    const projectedFindingStatuses = new Map(
      authorized.existingFindings.map(({ id, status }) => [
        id,
        status,
      ]),
    );
    for (const update of draft.findingStatusUpdates ?? []) {
      projectedFindingStatuses.set(update.id, update.status);
    }
    const activeExistingContradiction =
      authorized.existingFindings.some(
        ({ id, type }) =>
          type === "contradiction" &&
          projectedFindingStatuses.get(id) === "active",
      );
    const pendingReassessment =
      authorized.existingFindings.some(
        ({ id }) =>
          projectedFindingStatuses.get(id) === "needs_reassessment",
      );
    const newActiveContradiction = draft.findings.some(
      ({ type, status }) =>
        type === "contradiction" &&
        (status ?? "active") === "active",
    );
    if (
      requiredCoverageOpen ||
      activeExistingContradiction ||
      pendingReassessment ||
      newActiveContradiction
    ) {
      return "Completion conflicts with required coverage or unresolved findings.";
    }
  }
  return "";
};
