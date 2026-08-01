import { makeFunctionReference } from "convex/server";
import type { Doc, Id } from "./_generated/dataModel";

export type DownloadManifest = {
  projectName: string;
  projectDocument: string;
  visualDirection: Doc<"interviews">["submission"] extends
    | { visualDirection: infer Direction }
    | undefined
    ? Direction
    : never;
  transcript: string;
  concepts: Array<{
    id: string;
    name: string;
    rationale: string;
    imageId?: Id<"_storage">;
  }>;
};

export const internalRefs = {
  jobs: {
    runPending: makeFunctionReference<
      "action",
      { interviewId: Id<"interviews"> },
      null
    >("jobs:runPending"),
    begin: makeFunctionReference<
      "mutation",
      { interviewId: Id<"interviews"> },
      {
        interview: Doc<"interviews">;
        creator: Doc<"creatorProfiles">;
      } | null
    >("jobs:begin"),
    saveInterviewPlan: makeFunctionReference<
      "mutation",
      {
        interviewId: Id<"interviews">;
        interviewPlan: string;
        inputTokens: number;
        outputTokens: number;
        estimatedCostUsd: number;
      },
      null
    >("jobs:saveInterviewPlan"),
    setConceptGenerationPhase: makeFunctionReference<
      "mutation",
      {
        interviewId: Id<"interviews">;
        phase: "concept_planning" | "concept_creating";
      },
      null
    >("jobs:setConceptGenerationPhase"),
    completeText: makeFunctionReference<
      "mutation",
      {
        interviewId: Id<"interviews">;
        kind: "interview_response" | "document_revision";
        interviewTurnKind?:
          | "question"
          | "alignment"
          | "ready"
          | "document";
        assistantContent?: string;
        projectDocument?: string;
        suggestedReplies?: string[];
        inputTokens: number;
        outputTokens: number;
        estimatedCostUsd: number;
      },
      null
    >("jobs:completeText"),
    completeConcepts: makeFunctionReference<
      "mutation",
      {
        interviewId: Id<"interviews">;
        concepts: Doc<"interviews">["concepts"];
        hasFailure: boolean;
        errorCode?: string;
      },
      null
    >("jobs:completeConcepts"),
    completeEmail: makeFunctionReference<
      "mutation",
      {
        interviewId: Id<"interviews">;
        delivery: "sent" | "failed" | "unknown";
      },
      null
    >("jobs:completeEmail"),
    fail: makeFunctionReference<
      "mutation",
      {
        interviewId: Id<"interviews">;
        errorCode: string;
        ambiguous: boolean;
      },
      null
    >("jobs:fail"),
  },
  downloads: {
    cleanup: makeFunctionReference<
      "action",
      { storageId: Id<"_storage"> },
      null
    >("downloads:cleanup"),
  },
  downloadsData: {
    get: makeFunctionReference<
      "query",
      {
        interviewId: Id<"interviews">;
        tokenIdentifier: string;
      },
      DownloadManifest | null
    >("downloads_data:get"),
  },
};
