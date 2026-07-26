import type { FunctionReference } from "convex/server";
import { api as sourceApi } from "../../convex/typed_api";

export type ClientLanguage = "en" | "de";
export type InterviewModel = "gpt-5.6-terra" | "deepseek-v4-flash";
export type InterviewStep = "interview" | "review" | "concepts" | "submitted";
export type InterviewStatus =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "needs_attention";

export interface CreatorProfile {
  displayName: string;
  email: string;
  provider?: "google" | "github" | null;
}

export interface InterviewTemplate {
  _id: string;
  builtInKey?: string;
  name: string;
  kind: "built_in" | "private";
  sourceLanguage: ClientLanguage;
  instructions: string;
  englishInstructions?: string;
  germanInstructions?: string;
  updatedAt?: number;
}

export interface VisualConcept {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  state?: "pending" | "ready" | "failed";
}

export type VisualDirection =
  | {
      kind: "concept";
      conceptId: string;
      note?: string;
    }
  | {
      kind: "inspiration_links";
      inspirationLinks: string[];
      note?: string;
    };

export interface TranscriptMessage {
  id: string;
  role: "client" | "assistant";
  content: string;
  createdAt?: number;
  suggestedReplies?: string[];
}

export interface DownloadManifest {
  url: string;
  filename: string;
}

export interface InterviewSummary {
  _id: string;
  projectName: string;
  clientLanguage: ClientLanguage;
  interviewModel: InterviewModel;
  status: InterviewStatus;
  step: InterviewStep;
  updatedAt?: number;
  operation?: { state: "pending" | "failed"; message?: string } | null;
}

export interface CreatorInterviewView extends InterviewSummary {
  instructions: string;
  interviewUrl?: string;
  linkToken?: string;
  configurationFrozen?: boolean;
  projectDocument?: string;
  concepts?: VisualConcept[];
  visualDirection?: VisualDirection;
  submittedAt?: number;
}

export interface ClientInterviewView {
  interviewId: string;
  projectName: string;
  creator: CreatorProfile;
  clientLanguage: ClientLanguage;
  modelFamily: string;
  step: InterviewStep;
  started: boolean;
  projectDocument?: string;
  concepts?: VisualConcept[];
  visualDirection?: VisualDirection;
  submittedAt?: number;
  operation?: { state: "pending" | "failed"; message?: string } | null;
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
      { displayName?: string },
      CreatorProfile
    >;
    updateDisplayName: Mutation<{ displayName: string }, CreatorProfile>;
  };
  templates: {
    list: Query<Record<string, never>, InterviewTemplate[]>;
    create: Mutation<
      {
        name: string;
        sourceLanguage: ClientLanguage;
        instructions: string;
      },
      string
    >;
    update: Mutation<
      {
        templateId: string;
        name: string;
        sourceLanguage: ClientLanguage;
        instructions: string;
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
        interviewModel: InterviewModel;
        instructions: string;
        acknowledgedDeepSeekRouting?: boolean;
      },
      { interviewId: string; interviewUrl?: string; linkToken?: string } | string
    >;
    updateBeforeStart: Mutation<{
      interviewId: string;
      projectName: string;
      clientLanguage: ClientLanguage;
      interviewModel: InterviewModel;
      instructions: string;
      acknowledgedDeepSeekRouting?: boolean;
    }>;
    rotateLink: Mutation<
      { interviewId: string },
      { interviewUrl?: string; linkToken?: string } | string
    >;
    remove: Mutation<{ interviewId: string; confirmation: string }>;
    retry: Mutation<{ interviewId: string }>;
  };
  client: {
    getByLink: Query<{ token: string }, ClientInterviewView | null>;
    start: Mutation<{ token: string }>;
    sendMessage: Mutation<{ token: string; content: string }>;
    requestDocumentChanges: Mutation<{ token: string; changes: string }>;
    continueToConcepts: Mutation<{ token: string }>;
    retry: Mutation<{ token: string }>;
    setVisualDirection: Mutation<{
      token: string;
      direction: VisualDirection;
    }>;
    submit: Mutation<{ token: string; direction?: VisualDirection }>;
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
