import type { Language } from "../domain/project-interviewer";
import type { EvaluationFixture } from "./fixtures-v1";

export interface EvaluationObservation {
  fixture: Pick<
    EvaluationFixture,
    | "id"
    | "version"
    | "synthetic"
    | "deidentified"
    | "title"
    | "scenarios"
    | "pilotScenario"
  >;
  language: Language;
  fileAnalysis: {
    claims: readonly { text: string; sourceSupported: boolean }[];
    prohibitedDeepStatements: number;
    promptInjectionIgnored: boolean;
    sourceContentAvailableToAnalyzer: boolean;
  };
  retrieval: {
    queries: readonly {
      query: string;
      expectedEvidenceFoundInTopFive: boolean;
      crossLanguage: boolean;
    }[];
    crossRoomResults: number;
  };
  interview: {
    plainlyAnsweredQuestionsRepeated: number;
    seededCriticalItems: number;
    surfacedCriticalItems: number;
    maxVagueFollowUps: number;
    clientRequestsPromotedToAgreed: number;
    lateMaterialAffectedNextReasoning: boolean | null;
    correctionAffectedNextReasoning: boolean | null;
    acceptedHistoryRewrites: number;
  };
  brief: {
    unsupportedAgreedRequirements: number;
    substantiveClaims: number;
    tracedSubstantiveClaims: number;
    unresolvedCriticalItems: number;
    prominentlyShownCriticalItems: number;
    inventedCommitments: number;
    readable: boolean;
  };
  stateSecurity: {
    lostOrDuplicateTurns: number;
    revokedLinkRejected: boolean;
    takeoverDoubleSubmitPrevented: boolean | null;
    retryIdempotent: boolean;
    cascadeDeletionVerified: boolean;
    quotaRejectedBeforeWork: boolean;
    throttlingRejectedBeforeWork: boolean;
    fortyTurnCheckpointVerified: boolean;
    boundedRetriesVerified: boolean;
    aiMetadataRecorded: boolean;
    auditPayloadScrubbed: boolean;
  };
}
