import { describe, expect, it } from "vitest";
import { parseInterviewOutput } from "./interview_output";

describe("parseInterviewOutput", () => {
  it("parses bare JSON", () => {
    expect(
      parseInterviewOutput(
        JSON.stringify({
          kind: "question",
          content: "What should the website achieve?",
          suggestedReplies: ["Generate leads"],
        }),
      ),
    ).toEqual({
      kind: "question",
      content: "What should the website achieve?",
      suggestedReplies: ["Generate leads"],
      projectDocument: undefined,
    });
  });

  it("parses JSON wrapped in a single Markdown fence", () => {
    const content = [
      "```json",
      "{",
      '  "kind": "question",',
      '  "content": "Welche Ziele soll die Website erreichen?",',
      '  "suggestedReplies": ["Mehr Anfragen erhalten"]',
      "}",
      "```",
    ].join("\n");

    expect(parseInterviewOutput(content)).toEqual({
      kind: "question",
      content: "Welche Ziele soll die Website erreichen?",
      suggestedReplies: ["Mehr Anfragen erhalten"],
      projectDocument: undefined,
    });
  });

  it("preserves genuinely non-JSON provider output", () => {
    expect(parseInterviewOutput("What should the website achieve?")).toEqual({
      kind: "question",
      content: "What should the website achieve?",
      suggestedReplies: [],
    });
  });
});
