import { suggestedRepliesFromProvider } from "./domain";
import { parseEmbeddedProviderJson } from "./provider_json";

const withoutMarkdownCodeFences = (content: string) =>
  content
    .replace(/^[\t ]*```[^\r\n]*(?:\r?\n|$)/gm, "")
    .trim();

type InterviewOutputEnvelope = {
  kind: "question" | "alignment" | "ready" | "document";
  content: string;
  projectDocument?: unknown;
  suggestedReplies?: unknown;
};

const isInterviewOutputEnvelope = (
  value: unknown,
): value is InterviewOutputEnvelope =>
  typeof value === "object" &&
  value !== null &&
  "kind" in value &&
  (value.kind === "question" ||
    value.kind === "alignment" ||
    value.kind === "ready" ||
    value.kind === "document") &&
  "content" in value &&
  typeof value.content === "string";

const resemblesStructuredInterviewOutput = (content: string) => {
  const trimmed = content
    .trim()
    .replace(/^```(?:json)?[^\S\r\n]*(?:\r?\n|$)/i, "")
    .trimStart();
  if (trimmed.startsWith("{")) return true;
  const fieldNames = [
    "kind",
    "content",
    "suggestedReplies",
    "projectDocument",
  ];
  return (
    content.includes("{") &&
    fieldNames.filter((fieldName) => content.includes(fieldName)).length >= 2
  );
};

const invalidStructuredOutput = () => {
  const error = new Error(
    "Interview Model returned malformed structured output.",
  );
  error.name = "INTERVIEW_OUTPUT_INVALID_JSON";
  return error;
};

export const parseInterviewOutput = (content: string) => {
  try {
    const parsed = parseEmbeddedProviderJson(
      content,
      isInterviewOutputEnvelope,
    );
    return {
      kind: parsed.kind,
      content: withoutMarkdownCodeFences(parsed.content),
      suggestedReplies:
        parsed.kind === "question" || parsed.kind === "alignment"
          ? suggestedRepliesFromProvider(parsed.suggestedReplies)
          : [],
      projectDocument:
        parsed.kind === "document" &&
        typeof parsed.projectDocument === "string"
          ? parsed.projectDocument
          : undefined,
    };
  } catch {
    if (resemblesStructuredInterviewOutput(content)) {
      throw invalidStructuredOutput();
    }
    // A provider can occasionally ignore JSON mode with useful plain text.
  }
  return {
    kind: "question" as const,
    content: withoutMarkdownCodeFences(content),
    suggestedReplies: [] as string[],
  };
};

const malformedResponseMessages = {
  de: "Diese Antwort konnte wegen eines Formatierungsfehlers nicht angezeigt werden.",
  en: "This response could not be displayed because of a formatting error.",
} as const;

export const isMalformedStructuredInterviewOutput = (content: string) => {
  if (!resemblesStructuredInterviewOutput(content)) return false;
  try {
    parseEmbeddedProviderJson(content, isInterviewOutputEnvelope);
    return false;
  } catch {
    return true;
  }
};

export const clientFacingInterviewContent = (
  content: string,
  clientLanguage: keyof typeof malformedResponseMessages,
) => {
  if (!resemblesStructuredInterviewOutput(content)) return content;
  try {
    return parseInterviewOutput(content).content;
  } catch {
    return malformedResponseMessages[clientLanguage];
  }
};
