export type InterviewTurnKind =
  | "question"
  | "alignment"
  | "ready"
  | "document";

const alignmentRequired = () => {
  const error = new Error(
    "Interview completion requires a separate Client alignment checkpoint.",
  );
  error.name = "INTERVIEW_ALIGNMENT_REQUIRED";
  return error;
};

export const resolveInterviewTurn = (
  kind: InterviewTurnKind,
  alignmentAsked: boolean,
) => {
  if (kind === "question" || kind === "alignment") return "reply" as const;
  if (!alignmentAsked) throw alignmentRequired();
  return "document" as const;
};
