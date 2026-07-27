import { suggestedRepliesFromProvider } from "./domain";
import { parseEmbeddedProviderJson } from "./provider_json";

const withoutMarkdownCodeFences = (content: string) =>
  content
    .replace(/^[\t ]*```[^\r\n]*(?:\r?\n|$)/gm, "")
    .trim();

type InterviewOutputEnvelope = {
  kind: "question" | "document";
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
  (value.kind === "question" || value.kind === "document") &&
  "content" in value &&
  typeof value.content === "string";

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
        parsed.kind === "question"
          ? suggestedRepliesFromProvider(parsed.suggestedReplies)
          : [],
      projectDocument:
        parsed.kind === "document" &&
        typeof parsed.projectDocument === "string"
          ? parsed.projectDocument
          : undefined,
    };
  } catch {
    // A provider can occasionally ignore JSON mode; preserve a useful reply.
  }
  return {
    kind: "question" as const,
    content: withoutMarkdownCodeFences(content),
    suggestedReplies: [] as string[],
  };
};
