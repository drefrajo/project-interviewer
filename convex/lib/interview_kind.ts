export type InterviewKind = "website" | "privacy" | "custom";

export type InterviewKindFields = {
  interviewKind?: InterviewKind | undefined;
  includesVisualConcepts?: boolean | undefined;
};

/**
 * Existing Interviews and templates predate Interview Kinds. Keep their
 * behavior stable by resolving missing fields to the original website flow.
 */
export const resolveInterviewConfiguration = (
  fields: InterviewKindFields,
): { interviewKind: InterviewKind; includesVisualConcepts: boolean } => {
  const interviewKind = fields.interviewKind ?? "website";
  const includesVisualConcepts =
    fields.includesVisualConcepts ?? interviewKind === "website";

  if (interviewKind === "website" && !includesVisualConcepts) {
    throw new Error("Website Interviews must include Visual Concepts.");
  }
  if (interviewKind === "privacy" && includesVisualConcepts) {
    throw new Error("Privacy Interviews cannot include Visual Concepts.");
  }

  return { interviewKind, includesVisualConcepts };
};

export const assertInterviewKindConfiguration = (
  fields: InterviewKindFields,
) => resolveInterviewConfiguration(fields);

export const isVisualConceptsEnabled = (fields: InterviewKindFields) =>
  resolveInterviewConfiguration(fields).includesVisualConcepts;
