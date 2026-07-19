import type { GenericId } from "convex/values";

export type DomainOperationKind =
  | "file_analysis"
  | "interview_planning"
  | "interview_turn"
  | "interview_review"
  | "brief_generation";

export type DomainOperationArguments = {
  operationId: GenericId<"durableOperations">;
  kind: DomainOperationKind;
  subjectId: string;
};

export type AiOperationResult = {
  value: Record<string, unknown>;
  extraction?: {
    method: string;
    language: string;
    actualContentType: string;
    chunks: Array<{
      text: string;
      locator: unknown;
      embedding: number[];
    }>;
  };
  metadata: {
    model: string;
    provider: string;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd?: number;
    attemptCount: number;
    latencyMs: number;
  };
};
