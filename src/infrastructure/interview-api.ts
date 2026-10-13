import type { FunctionReference } from "convex/server";
import { api as sourceApi } from "../../convex/typed_api";
import type {
  ClientLanguage,
  InterviewKind,
  PrivateInterviewTemplate,
} from "../domain/interview-templates";

export type {
  ClientLanguage,
  InterviewKind,
  InterviewTemplate,
  PrivateInterviewTemplate,
  VisualConceptsMode,
} from "../domain/interview-templates";
export type InterviewModel = "gpt-6.1-sol";
export type InterviewStep = "interview" | "review" | "concepts" | "submitted";
export type InterviewStatus =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "needs_attention";
export type PassBalance = {
  availablePasses: number;
  reservedPasses: number;
  introductoryPasses: number;
  purchasedPasses: number;
};
export type PurchaseStatus = {
  purchaseId: string;
  packId: "one_pass" | "five_passes";
  passCount: number;
  amountMinor: number;
  currency: "eur";
  status: "pending" | "confirmed" | "failed" | "refunded" | "partial_refund";
};
export type PassCatalogItem = {
  packId: "one_pass" | "five_passes";
  passCount: 1 | 5;
  amountMinor: number;
  currency: "eur";
};

export type LegalDocumentVersion = {
  version: number;
  sha256: string;
};

export type LegalAcceptanceStatus = {
  accepted: boolean;
  terms: LegalDocumentVersion;
  dpa: LegalDocumentVersion;
};

export interface CreatorProfile {
  displayName: string;
  email: string;
  contactEmail?: string;
  privacyPolicyUrl?: string;
  language?: "en" | "de";
  contentAnalysisOptIn?: boolean;
  provider?: "google" | "github" | null;
}

export type InterviewFeedbackTarget =
  | "project_document"
  | "project_submission";
export type InterviewFeedbackRating = "up" | "down";
export interface InterviewFeedbackEntry {
  target: InterviewFeedbackTarget;
  rating: InterviewFeedbackRating;
  comment?: string;
  createdAt: number;
}

export interface PublicCreatorIdentity {
  displayName: string;
  contactEmail: string;
  privacyPolicyUrl?: string;
}

export interface VisualConcept {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  state?: "pending" | "ready" | "failed";
}

import type { VisualDirection } from "../domain/visual-direction";
export type { VisualDirection } from "../domain/visual-direction";

export interface TranscriptMessage {
  id: string;
  role: "client" | "assistant";
  content: string;
  createdAt?: number;
  suggestedReplies?: string[];
  retryable?: boolean;
}

export interface DownloadManifest {
  url: string;
  filename: string;
}

export interface InterviewSummary {
  _id: string;
  projectName: string;
  clientLanguage: ClientLanguage;
  /** Legacy rows resolve to website + included concepts in the UI. */
  interviewKind?: InterviewKind;
  includesVisualConcepts?: boolean;
  interviewModel: InterviewModel;
  status: InterviewStatus;
  step: InterviewStep;
  passState: "unreserved" | "reserved" | "consumed";
  updatedAt?: number;
  operation?: {
    state: "pending" | "failed";
    message?: string;
    phase?:
      | "planning"
      | "responding"
      | "concept_planning"
      | "concept_creating";
  } | null;
}

export interface CreatorInterviewView extends InterviewSummary {
  instructions: string;
  interviewUrl?: string;
  linkToken?: string;
  configurationFrozen?: boolean;
  passState: "unreserved" | "reserved" | "consumed";
  projectDocument?: string;
  concepts?: VisualConcept[];
  visualDirection?: VisualDirection;
  submittedAt?: number;
  lastActivityAt?: number;
  retentionExpiresAt?: number;
}

export interface ClientInterviewView {
  interviewId: string;
  projectName: string;
  creator: PublicCreatorIdentity | null;
  creatorIdentityReady: boolean;
  clientLanguage: ClientLanguage;
  /** Legacy rows resolve to website + included concepts in the UI. */
  interviewKind?: InterviewKind;
  includesVisualConcepts?: boolean;
  modelFamily: string;
  temporaryConceptBatchRetriesEnabled: boolean;
  step: InterviewStep;
  started: boolean;
  reservationRequired: boolean;
  passState: "unreserved" | "reserved" | "consumed";
  projectDocument?: string;
  concepts?: VisualConcept[];
  visualDirection?: VisualDirection;
  submittedAt?: number;
  operation?: {
    state: "pending" | "failed";
    message?: string;
    phase?:
      | "planning"
      | "responding"
      | "concept_planning"
      | "concept_creating";
  } | null;
}

type Query<Args extends Record<string, unknown>, Result> = FunctionReference<
  "query",
  "public",
  Args,
  Result
>;
type Mutation<
  Args extends Record<string, unknown>,
  Result = null,
> = FunctionReference<
  "mutation",
  "public",
  Args,
  Result
>;
type Action<Args extends Record<string, unknown>, Result> = FunctionReference<
  "action",
  "public",
  Args,
  Result
>;

interface InterviewApi {
  auth: {
    getProviderAvailability: Query<
      Record<string, never>,
      { google: boolean; github: boolean }
    >;
  };
  creator_profiles: {
    getCurrent: Query<Record<string, never>, CreatorProfile | null>;
    upsertCurrent: Mutation<
      { displayName?: string; language?: "en" | "de" },
      CreatorProfile
    >;
    updateDisplayName: Mutation<{ displayName: string }, CreatorProfile>;
    updateSettings: Mutation<
      {
        displayName: string;
        contactEmail: string;
        privacyPolicyUrl?: string;
        language: "en" | "de";
        contentAnalysisOptIn?: boolean;
      },
      CreatorProfile
    >;
  };
  feedback: {
    getForInterview: Query<
      { interviewId: string },
      InterviewFeedbackEntry[]
    >;
    record: Mutation<
      {
        interviewId: string;
        target: InterviewFeedbackTarget;
        rating: InterviewFeedbackRating;
        comment?: string;
      }
    >;
  };
  templates: {
    list: Query<Record<string, never>, PrivateInterviewTemplate[]>;
    create: Mutation<
      {
        name: string;
        sourceLanguage: ClientLanguage;
        instructions: string;
        interviewKind: InterviewKind;
        includesVisualConcepts: boolean;
        description?: string;
      },
      string
    >;
    update: Mutation<
      {
        templateId: string;
        name: string;
        sourceLanguage: ClientLanguage;
        instructions: string;
        interviewKind: InterviewKind;
        includesVisualConcepts: boolean;
        description?: string;
      }
    >;
    remove: Mutation<{ templateId: string }>;
    translate: Action<
      { instructions: string; targetLanguage: ClientLanguage },
      { instructions: string } | string
    >;
  };
  interviews: {
    list: Query<Record<string, never>, InterviewSummary[]>;
    get: Query<{ interviewId: string }, CreatorInterviewView | null>;
    create: Mutation<
      {
        projectName: string;
        clientLanguage: ClientLanguage;
        instructions: string;
        interviewKind: InterviewKind;
        includesVisualConcepts: boolean;
        builtInTemplateKey?: string;
      },
      { interviewId: string; interviewUrl?: string; linkToken?: string } | string
    >;
    reserveLink: Mutation<
      { interviewId: string },
      {
        linkToken: string;
        linkVersion: number;
        reserved: boolean;
        alreadyReserved: boolean;
      }
    >;
    deactivate: Mutation<
      { interviewId: string },
      { released: boolean }
    >;
    updateBeforeStart: Mutation<{
      interviewId: string;
      projectName: string;
      clientLanguage: ClientLanguage;
      instructions: string;
      interviewKind: InterviewKind;
      includesVisualConcepts: boolean;
    }>;
    rotateLink: Mutation<
      { interviewId: string },
      { interviewUrl?: string; linkToken?: string } | string
    >;
    remove: Mutation<{ interviewId: string; confirmation: string }>;
    retry: Mutation<{ interviewId: string }>;
  };
  billing: {
    getBalance: Query<Record<string, never>, PassBalance | null>;
    getCatalog: Query<Record<string, never>, PassCatalogItem[] | null>;
    getPublicCatalog: Query<Record<string, never>, PassCatalogItem[] | null>;
    getPurchaseStatus: Query<{ purchaseId: string }, PurchaseStatus | null>;
    createCheckoutSession: Action<
      { packId: "one_pass" | "five_passes" },
      { purchaseId: string; url: string }
    >;
  };
  legal: {
    getStatus: Action<Record<string, never>, LegalAcceptanceStatus>;
    acceptCurrent: Action<Record<string, never>, LegalAcceptanceStatus>;
  };
  local_dev: {
    seedSamples: Mutation<Record<string, never>, { created: number }>;
  };
  client: {
    getByLink: Query<{ token: string }, ClientInterviewView | null>;
    start: Mutation<{ token: string }>;
    sendMessage: Mutation<{ token: string; content: string }>;
    requestDocumentChanges: Mutation<{ token: string; changes: string }>;
    continueToConcepts: Mutation<{ token: string }>;
    requestMoreConcepts: Mutation<{ token: string }>;
    retryAdditionalConcepts: Mutation<{ token: string }>;
    retryFirstConcepts: Mutation<{ token: string }>;
    retry: Mutation<{ token: string }>;
    retryMalformedResponse: Mutation<{ token: string }>;
    setVisualDirection: Mutation<{
      token: string;
      direction: VisualDirection;
    }>;
    submit: Mutation<{ token: string; direction?: VisualDirection; confirmVisualDirection?: boolean }>;
  };
  transcripts: {
    listForCreator: Query<{ interviewId: string }, TranscriptMessage[]>;
    listForClient: Query<{ token: string }, TranscriptMessage[]>;
  };
  downloads: {
    getManifest: Action<{ interviewId: string }, DownloadManifest>;
  };
}

/**
 * This is the only compatibility cast between the source-owned Convex
 * interface and React. Function names and transport arguments live here so a
 * backend contract adjustment does not spread through the UI.
 */
export const interviewApi = sourceApi as unknown as InterviewApi;

export const interviewIdFrom = (
  result:
    | string
    | { interviewId: string; interviewUrl?: string; linkToken?: string },
): string => (typeof result === "string" ? result : result.interviewId);
