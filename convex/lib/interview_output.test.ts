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

  it("extracts a structured answer when prose precedes the JSON object", () => {
    const content = [
      "I still need your real details:",
      "",
      "- Your business name",
      "- Your preferred contact method",
      "",
      JSON.stringify({
        kind: "question",
        content:
          "What is your business name, preferred contact method, and call to action?",
        suggestedReplies: ["Sweet Layers", "hello@sweetlayers.com"],
      }),
    ].join("\n");

    expect(parseInterviewOutput(content)).toEqual({
      kind: "question",
      content:
        "What is your business name, preferred contact method, and call to action?",
      suggestedReplies: ["Sweet Layers", "hello@sweetlayers.com"],
      projectDocument: undefined,
    });
  });

  it("skips unrelated JSON before the valid Interview answer", () => {
    const content = [
      'The Client typed {"unexpected":true}.',
      JSON.stringify({
        kind: "question",
        content: 'Which design should feature the label "{signature}"?',
        suggestedReplies: ["Galaxy cake"],
      }),
    ].join("\n");

    expect(parseInterviewOutput(content)).toMatchObject({
      kind: "question",
      content: 'Which design should feature the label "{signature}"?',
      suggestedReplies: ["Galaxy cake"],
    });
  });

  it("extracts a Project Document from a mixed provider response", () => {
    const content = [
      "The Interview is complete.",
      JSON.stringify({
        kind: "document",
        content: "Your Project Document is ready.",
        projectDocument: "# Sweet Layers\n\nComplete website copy.",
      }),
    ].join("\n");

    expect(parseInterviewOutput(content)).toEqual({
      kind: "document",
      content: "Your Project Document is ready.",
      suggestedReplies: [],
      projectDocument: "# Sweet Layers\n\nComplete website copy.",
    });
  });

  it("does not expose Markdown code fences in a Client-facing answer", () => {
    expect(
      parseInterviewOutput(
        JSON.stringify({
          kind: "question",
          content: "Please provide:\n```text\nYour business name\n```",
          suggestedReplies: [],
        }),
      ),
    ).toMatchObject({
      kind: "question",
      content: "Please provide:\nYour business name",
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
