import type {
  GenericDataModel,
  GenericMutationCtx,
} from "convex/server";
import type { GenericId, Value } from "convex/values";
import type { AiOperationResult } from "./ai_contract";
import { asRecord, asString, asStrings } from "./commit_values";
import { validateEvidenceSources } from "./evidence_validation";

const coverageAreas = (value: unknown) =>
  (Array.isArray(value) ? value : []).map((item, index) => {
    const record = asRecord(item);
    return {
      id: asString(record.id, `coverage_${index + 1}`),
      label: asString(record.label, `Coverage area ${index + 1}`),
      rubric: asString(record.rubric, "Establish an evidence-backed answer."),
      status: "uncovered" as const,
      evidence: [],
      rationale: asString(record.rationale, "Not yet discussed."),
      openQuestions: asStrings(record.openQuestions),
      required: record.required !== false,
      vagueFollowupCount: 0,
    };
  });

export const commitInterviewPlanning = async (
  context: GenericMutationCtx<GenericDataModel>,
  operation: { roomId: GenericId<"projectRooms"> },
  subjectId: string,
  result: AiOperationResult,
  now: number,
) => {
  const interviewId = context.db.normalizeId(
    "discoveryInterviews",
    subjectId,
  );
  if (!interviewId) {
    throw new Error("Interview-planning subject is invalid.");
  }
  const interview = await context.db.get(interviewId);
  if (!interview || interview.roomId !== operation.roomId) {
    throw new Error("Interview-planning subject not found.");
  }
  const areas = coverageAreas(result.value.coverageAreas);
  const planId = `plan_${crypto.randomUUID()}`;
  await context.db.insert("interviewPlans", {
    roomId: operation.roomId,
    interviewId,
    profileId: "software-project",
    profileVersion: "software-project-v1",
    language: interview.language === "de" ? "de" : "en",
    coverageAreas: areas,
    knownRisks: asStrings(result.value.knownRisks),
    openGoals: asStrings(result.value.openGoals),
    model: result.metadata.model,
    provider: result.metadata.provider,
    promptVersion: "software-project-interview-planner-v1",
    schemaVersion: "interview-plan-v1",
    createdAt: now,
    updatedAt: now,
  });
  const first = areas[0];
  const opening = (
    Array.isArray(result.value.openingQuestions) &&
    result.value.openingQuestions.length
      ? result.value.openingQuestions.slice(0, 3).map((raw) => {
          const question = asRecord(raw);
          return {
            id: `question_${crypto.randomUUID()}`,
            text: asString(
              question.text,
              first
                ? interview.language === "de"
                  ? `Was sollten wir zu „${first.label}“ unbedingt wissen?`
                  : `What should we understand about “${first.label}”?`
                : "What should we understand first?",
            ),
            coverageAreaId: asString(
              question.coverageAreaId,
              first?.id ?? "general",
            ),
            kind: "primary" as const,
            reason: asString(
              question.reason,
              first?.rubric ?? "Open the conversation.",
            ),
            askedAt: now,
          };
        })
      : first
        ? [
            {
              id: `question_${crypto.randomUUID()}`,
              text:
                interview.language === "de"
                  ? `Was sollten wir zu „${first.label}“ unbedingt wissen?`
                  : `What should we understand about “${first.label}”?`,
              coverageAreaId: first.id,
              kind: "primary" as const,
              reason: first.rubric,
              askedAt: now,
            },
          ]
        : []
  );
  await context.db.patch(interviewId, {
    planId,
    status: "active",
    operationStatus: "idle",
    ...(opening.length
      ? {
          currentQuestion: opening[0],
          currentQuestions: opening,
        }
      : {}),
    updatedAt: now,
  });
  await context.db.patch(operation.roomId, {
    phase: "discovery",
    updatedAt: now,
    lastActivityAt: now,
  });
};

export const commitInterviewUpdate = async (
  context: GenericMutationCtx<GenericDataModel>,
  operation: { roomId: GenericId<"projectRooms"> },
  subjectId: string,
  result: AiOperationResult,
  kind: "interview_turn" | "interview_review",
  now: number,
) => {
  const interviewId = context.db.normalizeId(
    "discoveryInterviews",
    subjectId,
  );
  if (!interviewId) throw new Error("Interview subject is invalid.");
  const interview = await context.db.get(interviewId);
  if (!interview || interview.roomId !== operation.roomId) {
    throw new Error("Interview subject not found.");
  }
  const nextBatch = (
    Array.isArray(result.value.nextQuestions) &&
    result.value.nextQuestions.length
      ? result.value.nextQuestions
      : result.value.nextQuestion
        ? [result.value.nextQuestion]
        : []
  )
    .slice(0, 4)
    .map((raw) => {
      const question = asRecord(raw);
      return {
        id: asString(question.id, `question_${crypto.randomUUID()}`),
        text: asString(question.text, "What else should we understand?"),
        coverageAreaId: asString(question.coverageAreaId, "general"),
        kind:
          question.kind === "follow_up"
            ? ("follow_up" as const)
            : question.kind === "final_anything_else"
              ? ("final_anything_else" as const)
              : ("primary" as const),
        reason: asString(
          question.reason,
          "Close the remaining discovery gap.",
        ),
        askedAt: now,
      };
    });
  const blockers = asStrings(result.value.blockers);
  const currentQuestion = asRecord(interview.currentQuestion);
  const answeredFinalQuestion =
    currentQuestion.kind === "final_anything_else";
  const needsUsageReview =
    kind === "interview_turn" && Number(interview.answerCount) >= 12;
  const agentProposesCompletion =
    kind === "interview_turn" &&
    result.value.status === "awaiting_confirmation";
  const reviewerClearsCompletion =
    kind === "interview_review" && blockers.length === 0;
  const status =
    kind === "interview_review"
      ? reviewerClearsCompletion && answeredFinalQuestion
        ? ("awaiting_confirmation" as const)
        : ("active" as const)
      : agentProposesCompletion || needsUsageReview
        ? ("awaiting_confirmation" as const)
        : result.value.status === "completed_early"
          ? ("completed_early" as const)
          : ("active" as const);
  const reviewQuestion =
    kind === "interview_review"
      ? reviewerClearsCompletion
        ? answeredFinalQuestion
          ? undefined
          : {
              id: `question_${crypto.randomUUID()}`,
              text:
                interview.language === "de"
                  ? "Gibt es noch etwas, das wir vor dem Abschluss berücksichtigen sollten?"
                  : "Is there anything else we should consider before completing discovery?",
              coverageAreaId: "final_anything_else",
              kind: "final_anything_else" as const,
              reason:
                "The completion reviewer cleared the required coverage areas.",
              askedAt: now,
            }
        : {
            id: `question_${crypto.randomUUID()}`,
            text:
              interview.language === "de"
                ? `Was sollten wir noch klären: ${blockers[0] ?? "offene Punkte"}?`
                : `What should we clarify about ${blockers[0] ?? "the remaining gap"}?`,
            coverageAreaId: "review_gap",
            kind: "follow_up" as const,
            reason: blockers[0] ?? "The completion reviewer found a gap.",
            askedAt: now,
          }
      : undefined;
  await context.db.patch(interviewId, {
    status,
    operationStatus: "idle",
    unresolvedTopics:
      kind === "interview_turn"
        ? asStrings(result.value.unresolvedTopics)
        : interview.unresolvedTopics,
    reviewerBlockers:
      kind === "interview_review"
        ? blockers
        : interview.reviewerBlockers,
    reviewedAnswerCount:
      kind === "interview_review"
        ? Number(interview.answerCount)
        : Number(interview.reviewedAnswerCount),
    ...(kind === "interview_review" &&
    typeof result.value.completionRationale === "string"
      ? { completionRationale: result.value.completionRationale }
      : {}),
    ...(reviewQuestion
      ? {
          currentQuestion: reviewQuestion,
          currentQuestions: [reviewQuestion],
        }
      : nextBatch.length && !(agentProposesCompletion || needsUsageReview)
      ? {
          currentQuestion: nextBatch[0],
          currentQuestions: nextBatch,
        }
      : {}),
    updatedAt: now,
  });
  if (kind === "interview_turn") {
    const plan = await context.db
      .query("interviewPlans")
      .withIndex("by_interview", (query) =>
        query.eq("interviewId", interviewId),
      )
      .order("desc")
      .first();
    if (!plan) throw new Error("Interview Plan not found.");
    const coverageAreas = (
      Array.isArray(plan.coverageAreas) ? plan.coverageAreas : []
    ).map((area) => ({ ...asRecord(area) }));
    for (const rawUpdate of Array.isArray(result.value.coverageUpdates)
      ? result.value.coverageUpdates
      : []) {
      const update = asRecord(rawUpdate);
      const area = coverageAreas.find(
        (candidate) => candidate.id === update.id,
      );
      if (!area) throw new Error("Coverage update target is invalid.");
      area.status = update.status;
      area.evidence = await validateEvidenceSources(
        context,
        operation.roomId,
        update.evidence,
        { allowProjectDescription: true },
      );
      area.rationale = asString(update.rationale, "");
      area.openQuestions = asStrings(update.openQuestions);
      if (typeof update.vagueFollowupCount === "number") {
        area.vagueFollowupCount = update.vagueFollowupCount;
      }
    }
    const planId = context.db.normalizeId(
      "interviewPlans",
      String(plan._id),
    );
    if (!planId) throw new Error("Interview Plan id is invalid.");
    await context.db.patch(planId, {
      coverageAreas: coverageAreas as Value[],
      updatedAt: now,
    });
  }
  if (kind === "interview_turn" && Array.isArray(result.value.findings)) {
    for (const [index, item] of result.value.findings.entries()) {
      const finding = asRecord(item);
      const findingType = [
        "candidate_requirement",
        "assumption",
        "risk",
        "gap",
        "contradiction",
      ].includes(String(finding.type))
        ? String(finding.type)
        : "gap";
      const sources = await validateEvidenceSources(
        context,
        operation.roomId,
        finding.sources,
        { allowProjectDescription: true },
      );
      if (!sources.length) {
        throw new Error("Discovery Finding requires evidence.");
      }
      await context.db.insert("discoveryFindings", {
        roomId: operation.roomId,
        interviewId,
        findingType,
        statement: asString(
          finding.statement,
          `Discovery finding ${index + 1}`,
        ),
        sources,
        status:
          finding.status === "resolved" ||
          finding.status === "explicitly_open"
            ? finding.status
            : "active",
        createdAt: now,
      });
    }
  }
  if (
    kind === "interview_turn" &&
    Array.isArray(result.value.findingStatusUpdates)
  ) {
    for (const rawUpdate of result.value.findingStatusUpdates) {
      const update = asRecord(rawUpdate);
      if (typeof update.id !== "string") {
        throw new Error("Discovery Finding update id is invalid.");
      }
      const findingId = context.db.normalizeId(
        "discoveryFindings",
        update.id,
      );
      if (!findingId) {
        throw new Error("Discovery Finding update id is invalid.");
      }
      const finding = await context.db.get(findingId);
      if (
        !finding ||
        finding.roomId !== operation.roomId ||
        finding.interviewId !== interviewId
      ) {
        throw new Error("Discovery Finding update target is invalid.");
      }
      const sources = await validateEvidenceSources(
        context,
        operation.roomId,
        update.sources,
        { allowProjectDescription: true },
      );
      await context.db.patch(findingId, {
        status:
          update.status === "resolved" ||
          update.status === "explicitly_open" ||
          update.status === "needs_reassessment"
            ? update.status
            : "active",
        sources,
      });
    }
  }
  if (kind === "interview_turn") {
    const acceptedTurn = await context.db
      .query("interviewTurns")
      .withIndex("by_interview_sequence", (query) =>
        query.eq("interviewId", interviewId),
      )
      .order("desc")
      .first();
    if (acceptedTurn) {
      const events = await context.db
        .query("interviewEvents")
        .withIndex("by_interview", (query) =>
          query.eq("interviewId", interviewId),
        )
        .collect();
      await Promise.all(
        events
          .filter((event) => !event.handledAtTurnId)
          .map((event) => {
            const eventId = context.db.normalizeId(
              "interviewEvents",
              String(event._id),
            );
            return eventId
              ? context.db.patch(eventId, {
                  handledAtTurnId: acceptedTurn._id,
                })
              : Promise.resolve();
          }),
      );
    }
  }
};
