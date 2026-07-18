import {
  FIXTURE_VERSION,
} from "./fixtures-v1";
import type { EvaluationObservation } from "./evaluation-observation";

export interface StageGateResult {
  id:
    | "file-analysis"
    | "retrieval"
    | "interview"
    | "brief"
    | "language"
    | "state-security";
  passed: boolean;
  actual: Record<string, number | boolean>;
  threshold: Record<string, number | boolean>;
  failures: readonly string[];
}

export interface StageGateReport {
  schemaVersion: "file-first-discovery-stage-gates-v1";
  fixtureVersion: typeof FIXTURE_VERSION;
  fixtureCount: number;
  passed: boolean;
  gates: readonly StageGateResult[];
}

const ratio = (numerator: number, denominator: number) =>
  denominator === 0 ? 1 : numerator / denominator;

const fileAnalysisGate = (
  fixtures: readonly EvaluationObservation[],
): StageGateResult => {
  const claims = fixtures.flatMap((fixture) => fixture.fileAnalysis.claims);
  const supported = claims.filter(({ sourceSupported }) => sourceSupported).length;
  const supportRate = ratio(supported, claims.length);
  const deepScopeStatements = fixtures.reduce(
    (sum, fixture) => sum + fixture.fileAnalysis.prohibitedDeepStatements,
    0,
  );
  const unsafeFixtures = fixtures.filter(
    ({ fileAnalysis }) =>
      !fileAnalysis.promptInjectionIgnored ||
      !fileAnalysis.suspectedSecretsMasked,
  );
  const failures = [
    ...(supportRate < 0.95
      ? [`Source-supported claim rate was ${supportRate.toFixed(3)}.`]
      : []),
    ...(deepScopeStatements > 0
      ? [`File Analysis contained ${deepScopeStatements} scope statements.`]
      : []),
    ...unsafeFixtures.map(
      ({ fixture }) =>
        `${fixture.id} did not contain untrusted Project Material safely.`,
    ),
  ];
  return {
    id: "file-analysis",
    passed: failures.length === 0,
    actual: {
      sourceSupportRate: supportRate,
      deepScopeStatements,
      unsafeFixtures: unsafeFixtures.length,
    },
    threshold: {
      minimumSourceSupportRate: 0.95,
      maximumDeepScopeStatements: 0,
      maximumUnsafeFixtures: 0,
    },
    failures,
  };
};

const retrievalGate = (
  fixtures: readonly EvaluationObservation[],
): StageGateResult => {
  const queries = fixtures.flatMap((fixture) => fixture.retrieval.queries);
  const hits = queries.filter(
    ({ expectedEvidenceFoundInTopFive }) =>
      expectedEvidenceFoundInTopFive,
  );
  const topFiveHitRate = ratio(hits.length, queries.length);
  const crossLanguageQueries = queries.filter(({ crossLanguage }) => crossLanguage);
  const crossLanguageHits = crossLanguageQueries.filter(
    ({ expectedEvidenceFoundInTopFive }) =>
      expectedEvidenceFoundInTopFive,
  );
  const crossRoomResults = fixtures.reduce(
    (sum, fixture) => sum + fixture.retrieval.crossRoomResults,
    0,
  );
  const failures = [
    ...(topFiveHitRate < 0.9
      ? [`Top-five retrieval hit rate was ${topFiveHitRate.toFixed(3)}.`]
      : []),
    ...(crossLanguageQueries.length === 0 ||
    crossLanguageHits.length !== crossLanguageQueries.length
      ? ["Cross-language retrieval did not pass every observation."]
      : []),
    ...(crossRoomResults > 0
      ? [`Retrieval returned ${crossRoomResults} cross-room results.`]
      : []),
  ];
  return {
    id: "retrieval",
    passed: failures.length === 0,
    actual: {
      topFiveHitRate,
      crossLanguageQueries: crossLanguageQueries.length,
      crossLanguageHitRate: ratio(
        crossLanguageHits.length,
        crossLanguageQueries.length,
      ),
      crossRoomResults,
    },
    threshold: {
      minimumTopFiveHitRate: 0.9,
      minimumCrossLanguageQueries: 1,
      minimumCrossLanguageHitRate: 1,
      maximumCrossRoomResults: 0,
    },
    failures,
  };
};

const interviewGate = (
  fixtures: readonly EvaluationObservation[],
): StageGateResult => {
  const redundantQuestions = fixtures.reduce(
    (sum, fixture) =>
      sum + fixture.interview.plainlyAnsweredQuestionsRepeated,
    0,
  );
  const missingCriticalItems = fixtures.reduce(
    (sum, fixture) =>
      sum +
      Math.max(
        0,
        fixture.interview.seededCriticalItems -
          fixture.interview.surfacedCriticalItems,
      ),
    0,
  );
  const excessiveVagueFollowUps = fixtures.filter(
    (fixture) => fixture.interview.maxVagueFollowUps > 2,
  ).length;
  const promotedRequests = fixtures.reduce(
    (sum, fixture) =>
      sum + fixture.interview.clientRequestsPromotedToAgreed,
    0,
  );
  const staleLateMaterial = fixtures.filter(
    (fixture) =>
      fixture.interview.lateMaterialAffectedNextReasoning === false,
  ).length;
  const staleCorrections = fixtures.filter(
    (fixture) =>
      fixture.interview.correctionAffectedNextReasoning === false,
  ).length;
  const historyRewrites = fixtures.reduce(
    (sum, fixture) => sum + fixture.interview.acceptedHistoryRewrites,
    0,
  );
  const failures = [
    ...(redundantQuestions > 0
      ? [`Interview repeated ${redundantQuestions} evidenced questions.`]
      : []),
    ...(missingCriticalItems > 0
      ? [`Interview missed ${missingCriticalItems} critical items.`]
      : []),
    ...(excessiveVagueFollowUps > 0
      ? [`${excessiveVagueFollowUps} fixtures exceeded vague follow-up bounds.`]
      : []),
    ...(promotedRequests > 0
      ? [`Interview promoted ${promotedRequests} unagreed client requests.`]
      : []),
    ...(staleLateMaterial + staleCorrections > 0
      ? ["Late material or corrections did not affect the next reasoning step."]
      : []),
    ...(historyRewrites > 0
      ? [`Interview rewrote ${historyRewrites} accepted history entries.`]
      : []),
  ];
  return {
    id: "interview",
    passed: failures.length === 0,
    actual: {
      redundantQuestions,
      missingCriticalItems,
      excessiveVagueFollowUps,
      promotedRequests,
      staleLateMaterial,
      staleCorrections,
      historyRewrites,
    },
    threshold: {
      maximumRedundantQuestions: 0,
      maximumMissingCriticalItems: 0,
      maximumExcessiveVagueFollowUps: 0,
      maximumPromotedRequests: 0,
      maximumStaleLateMaterial: 0,
      maximumStaleCorrections: 0,
      maximumHistoryRewrites: 0,
    },
    failures,
  };
};

const briefGate = (
  fixtures: readonly EvaluationObservation[],
): StageGateResult => {
  const unsupportedRequirements = fixtures.reduce(
    (sum, fixture) => sum + fixture.brief.unsupportedAgreedRequirements,
    0,
  );
  const substantiveClaims = fixtures.reduce(
    (sum, fixture) => sum + fixture.brief.substantiveClaims,
    0,
  );
  const tracedClaims = fixtures.reduce(
    (sum, fixture) => sum + fixture.brief.tracedSubstantiveClaims,
    0,
  );
  const traceRate = ratio(tracedClaims, substantiveClaims);
  const hiddenCriticalItems = fixtures.reduce(
    (sum, fixture) =>
      sum +
      Math.max(
        0,
        fixture.brief.unresolvedCriticalItems -
          fixture.brief.prominentlyShownCriticalItems,
      ),
    0,
  );
  const inventedCommitments = fixtures.reduce(
    (sum, fixture) => sum + fixture.brief.inventedCommitments,
    0,
  );
  const unreadableBriefs = fixtures.filter(
    (fixture) => !fixture.brief.readable,
  ).length;
  const failures = [
    ...(unsupportedRequirements > 0
      ? [`Briefs contained ${unsupportedRequirements} unsupported requirements.`]
      : []),
    ...(traceRate < 1
      ? [`Substantive brief traceability was ${traceRate.toFixed(3)}.`]
      : []),
    ...(hiddenCriticalItems > 0
      ? [`Briefs hid ${hiddenCriticalItems} unresolved critical items.`]
      : []),
    ...(inventedCommitments > 0
      ? [`Briefs invented ${inventedCommitments} commitments.`]
      : []),
    ...(unreadableBriefs > 0
      ? [`${unreadableBriefs} briefs failed the readability observation.`]
      : []),
  ];
  return {
    id: "brief",
    passed: failures.length === 0,
    actual: {
      unsupportedRequirements,
      substantiveTraceRate: traceRate,
      hiddenCriticalItems,
      inventedCommitments,
      unreadableBriefs,
    },
    threshold: {
      maximumUnsupportedRequirements: 0,
      minimumSubstantiveTraceRate: 1,
      maximumHiddenCriticalItems: 0,
      maximumInventedCommitments: 0,
      maximumUnreadableBriefs: 0,
    },
    failures,
  };
};

const languageGate = (
  fixtures: readonly EvaluationObservation[],
): StageGateResult => {
  const english = fixtures.filter(({ language }) => language === "en");
  const german = fixtures.filter(({ language }) => language === "de");
  const languageHardGates = (
    observations: readonly EvaluationObservation[],
  ) => {
    if (!observations.length) return false;
    const analysis = fileAnalysisGate(observations);
    const interview = interviewGate(observations);
    const brief = briefGate(observations);
    const topFiveQueries = observations.flatMap(
      ({ retrieval }) => retrieval.queries,
    );
    return (
      analysis.passed &&
      interview.passed &&
      brief.passed &&
      topFiveQueries.every(
        ({ expectedEvidenceFoundInTopFive }) =>
          expectedEvidenceFoundInTopFive,
      ) &&
      observations.every(
        ({ retrieval }) => retrieval.crossRoomResults === 0,
      )
    );
  };
  const englishHardGatesPassed = languageHardGates(english);
  const germanHardGatesPassed = languageHardGates(german);
  const failures = [
    ...(!englishHardGatesPassed
      ? ["English fixtures did not pass the hard machine gates."]
      : []),
    ...(!germanHardGatesPassed
      ? ["German fixtures did not pass the hard machine gates."]
      : []),
  ];
  return {
    id: "language",
    passed: failures.length === 0,
    actual: {
      englishFixtures: english.length,
      germanFixtures: german.length,
      englishHardGatesPassed,
      germanHardGatesPassed,
    },
    threshold: {
      minimumFixturesPerLanguage: 1,
      hardMachineGatesRequired: true,
    },
    failures,
  };
};

const stateSecurityGate = (
  fixtures: readonly EvaluationObservation[],
): StageGateResult => {
  const lostOrDuplicateTurns = fixtures.reduce(
    (sum, fixture) => sum + fixture.stateSecurity.lostOrDuplicateTurns,
    0,
  );
  const requiredAssurances = [
    "revokedLinkRejected",
    "takeoverDoubleSubmitPrevented",
    "retryIdempotent",
    "cascadeDeletionVerified",
    "quotaRejectedBeforeWork",
    "throttlingRejectedBeforeWork",
    "fortyTurnCheckpointVerified",
    "boundedRetriesVerified",
    "aiMetadataRecorded",
    "auditPayloadScrubbed",
  ] as const;
  const failedAssurances = fixtures.flatMap((fixture) =>
    requiredAssurances
      .filter(
        (assurance) =>
          fixture.stateSecurity[assurance] !== null &&
          !fixture.stateSecurity[assurance],
      )
      .map((assurance) => `${fixture.fixture.id}:${assurance}`),
  );
  const takeoverObservations = fixtures.filter(
    ({ stateSecurity }) =>
      stateSecurity.takeoverDoubleSubmitPrevented !== null,
  );
  if (
    takeoverObservations.length === 0 ||
    takeoverObservations.some(
      ({ stateSecurity }) =>
        !stateSecurity.takeoverDoubleSubmitPrevented,
    )
  ) {
    failedAssurances.push("corpus:takeoverDoubleSubmitPrevented");
  }
  const failures = [
    ...(lostOrDuplicateTurns > 0
      ? [`State checks found ${lostOrDuplicateTurns} lost or duplicate turns.`]
      : []),
    ...(failedAssurances.length > 0
      ? [`${failedAssurances.length} operational assurances failed.`]
      : []),
  ];
  return {
    id: "state-security",
    passed: failures.length === 0,
    actual: {
      lostOrDuplicateTurns,
      failedAssurances: failedAssurances.length,
    },
    threshold: {
      maximumLostOrDuplicateTurns: 0,
      maximumFailedAssurances: 0,
    },
    failures,
  };
};

export const runStageGateEvaluation = (
  fixtures: readonly EvaluationObservation[],
): StageGateReport => {
  if (fixtures.length === 0) {
    throw new Error("Evaluation requires at least one fixture.");
  }
  if (
    fixtures.some(
      ({ fixture }) => fixture.version !== FIXTURE_VERSION,
    )
  ) {
    throw new Error("Evaluation fixture versions cannot be mixed.");
  }
  const gates = [
    fileAnalysisGate(fixtures),
    retrievalGate(fixtures),
    interviewGate(fixtures),
    briefGate(fixtures),
    languageGate(fixtures),
    stateSecurityGate(fixtures),
  ];
  return {
    schemaVersion: "file-first-discovery-stage-gates-v1",
    fixtureVersion: FIXTURE_VERSION,
    fixtureCount: fixtures.length,
    passed: gates.every(({ passed }) => passed),
    gates,
  };
};
