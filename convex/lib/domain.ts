import type { Doc } from "../_generated/dataModel";
import { interviewPassState } from "./pass_accounting";

export const MAX_INSTRUCTIONS_LENGTH = 50_000;
export const MAX_CLIENT_MESSAGE_LENGTH = 10_000;
export const MAX_VISUAL_NOTE_LENGTH = 2_000;
export const MAX_CLIENT_MESSAGES = 60;
export const MAX_DOCUMENT_REVISIONS = 10;
export const MAX_SUGGESTED_REPLIES = 4;
export const MAX_SUGGESTED_REPLY_LENGTH = 240;

export const assertLength = (
  label: string,
  value: string,
  maximum: number,
) => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }
  if (trimmed.length > maximum) {
    throw new Error(`${label} must be at most ${maximum} characters.`);
  }
  return trimmed;
};

export const assertEmailAddress = (label: string, value: string) => {
  const email = assertLength(label, value, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`${label} must be a valid email address.`);
  }
  return email;
};

export const assertPrivacyPolicyUrl = (value: string) => {
  const candidate = assertLength("Privacy policy URL", value, 2_048);
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error("Privacy policy URL must be a valid HTTPS URL.");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("Privacy policy URL must be a valid HTTPS URL.");
  }
  return parsed.toString();
};

export const suggestedRepliesFromProvider = (value: unknown): string[] => {
  if (!Array.isArray(value) || value.length > MAX_SUGGESTED_REPLIES) {
    return [];
  }
  const replies: string[] = [];
  for (const candidate of value) {
    if (typeof candidate !== "string") return [];
    const reply = candidate.trim();
    if (!reply || reply.length > MAX_SUGGESTED_REPLY_LENGTH) return [];
    if (!replies.includes(reply)) replies.push(reply);
  }
  return replies;
};

export const assertHttpUrls = (links: string[]) => {
  if (links.length < 1 || links.length > 3) {
    throw new Error("Provide between one and three inspiration links.");
  }
  return links.map((link) => {
    let parsed: URL;
    try {
      parsed = new URL(link);
    } catch {
      throw new Error("Inspiration links must be valid HTTP(S) URLs.");
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("Inspiration links must be valid HTTP(S) URLs.");
    }
    return parsed.toString();
  });
};

export const dashboardStatus = (interview: Doc<"interviews">) => {
  if (interview.submission) {
    return "submitted" as const;
  }
  if (interview.operation?.status === "failed") {
    return "needs_attention" as const;
  }
  if (!interview.frozenAt) {
    return "not_started" as const;
  }
  return "in_progress" as const;
};

export const interviewDto = async (
  interview: Doc<"interviews">,
  getImageUrl: (id: NonNullable<
    Doc<"interviews">["concepts"][number]["imageId"]
  >) => Promise<string | null>,
) => ({
  _id: interview._id,
  projectName: interview.projectName,
  clientLanguage: interview.clientLanguage,
  interviewModel: "gpt-5.6-terra" as const,
  instructions: interview.instructions,
  configurationFrozen: Boolean(interview.frozenAt),
  passState: interviewPassState(interview),
  step: interview.step,
  status: dashboardStatus(interview),
  operation: interview.operation
    ? {
        state:
          interview.operation.status === "failed"
            ? ("failed" as const)
            : ("pending" as const),
        message: interview.operation.errorCode,
        ...(interview.operation.kind === "interview_response"
          ? {
              phase:
                interview.clientMessageCount === 1 && !interview.interviewPlan
                  ? ("planning" as const)
                  : ("responding" as const),
            }
          : interview.operation.kind === "concept_generation"
            ? {
                phase:
                  interview.operation.phase === "concept_creating"
                    ? ("concept_creating" as const)
                    : ("concept_planning" as const),
              }
          : {}),
      }
    : null,
  projectDocument: interview.projectDocument,
  concepts: await Promise.all(
    interview.concepts.map(async (concept) => ({
      ...concept,
      description: concept.rationale,
      state: concept.status,
      imageUrl: concept.imageId
        ? (await getImageUrl(concept.imageId)) ?? undefined
        : undefined,
    })),
  ),
  visualDirection: interview.visualDirection,
  submittedAt: interview.submission?.submittedAt,
  createdAt: interview.createdAt,
  updatedAt: interview.updatedAt,
  lastActivityAt: interview.lastActivityAt ?? interview.updatedAt,
  retentionExpiresAt: interview.retentionExpiresAt,
});
