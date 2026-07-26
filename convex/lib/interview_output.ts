import { suggestedRepliesFromProvider } from "./domain";
import { parseProviderJson } from "./provider_json";

export const parseInterviewOutput = (content: string) => {
  try {
    const parsed = parseProviderJson<{
      kind?: unknown;
      content?: unknown;
      projectDocument?: unknown;
      suggestedReplies?: unknown;
    }>(content);
    if (
      (parsed.kind === "question" || parsed.kind === "document") &&
      typeof parsed.content === "string"
    ) {
      return {
        kind: parsed.kind,
        content: parsed.content,
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
    }
  } catch {
    // A provider can occasionally ignore JSON mode; preserve a useful reply.
  }
  return {
    kind: "question" as const,
    content,
    suggestedReplies: [] as string[],
  };
};
