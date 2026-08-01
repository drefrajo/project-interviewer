import { describe, expect, it } from "vitest";
import {
  clientFacingInterviewContent,
  parseInterviewOutput,
} from "./interview_output";

// eslint-disable-next-line no-irregular-whitespace -- Exact production regression fixture.
const malformedOutput = String.raw`{":": {",": "}kind"questions"content":": "Vielen Dank für die Rückmeldung.\n\n**Vorschlag zur Kontaktaufnahme:** Ein dezenter, immer sichtbarer Button am unteren Bildschirmrand (z. B. „Anfragen“) – ähnlich wie der „Profil“-Button bei Instagram. Darüber öffnet sich ein kleines Overlay mit Ihrer E-Mail-Adresse und Telefonnummer, optional mit einem kurzen Formular. So bleibt der Feed klar und die Kontaktmöglichkeit jederzeit griffbereit.\n\nDamit ich die Umsetzung vorbereiten kann, bitte ich um drei Angaben:\n\n1. **Welche E-Mail und Telefonnummer** sollen angezeigt werden?\n2. **Wie soll die visuelle Tonalität sein** – sehr hell/minimalistisch oder eher mit dunklem Hintergrund, um Ihre schlichten Bilder hervorzuheben?\n3. **Haben Sie einen Namen/Logo** für Ihre Fotografie (z. B. „Atelier [Name]“)?\n\nDiese Informationen sind notwendig, damit die Seite professionell wirkt und Besucher Sie sofort kontaktieren können.\n","suggestedReplies":["E-Mail: mail@beispiel.de, Tel: 0123-4567890","Heller, fast weißer Hintergrund – wie Instagram","Mein Name ist [Vorname Nachname] – soll als Logo reichen","Ich entscheide später – mach erstmal einen Vorschlag"]}"}}`;

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

  it("parses a recommended direction that requires Client alignment", () => {
    expect(
      parseInterviewOutput(
        JSON.stringify({
          kind: "alignment",
          content:
            "I recommend a compact visual feed with persistent contact access. Does that direction feel right?",
          suggestedReplies: [
            "Yes, that feels right",
            "Mostly, but I want to change something",
          ],
        }),
      ),
    ).toEqual({
      kind: "alignment",
      content:
        "I recommend a compact visual feed with persistent contact access. Does that direction feel right?",
      suggestedReplies: [
        "Yes, that feels right",
        "Mostly, but I want to change something",
      ],
      projectDocument: undefined,
    });
  });

  it("parses readiness only after a separate alignment turn", () => {
    expect(
      parseInterviewOutput(
        JSON.stringify({
          kind: "ready",
          content: "Great — I’ll prepare the Project Document now.",
        }),
      ),
    ).toEqual({
      kind: "ready",
      content: "Great — I’ll prepare the Project Document now.",
      suggestedReplies: [],
      projectDocument: undefined,
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

  it("rejects malformed JSON-like output instead of exposing it to the Client", () => {
    expect(() => parseInterviewOutput(malformedOutput)).toThrowError(
      expect.objectContaining({ name: "INTERVIEW_OUTPUT_INVALID_JSON" }),
    );
  });
});

describe("clientFacingInterviewContent", () => {
  it("replaces a legacy malformed German response with a readable error", () => {
    expect(clientFacingInterviewContent(malformedOutput, "de")).toBe(
      "Diese Antwort konnte wegen eines Formatierungsfehlers nicht angezeigt werden.",
    );
  });

  it("unwraps a legacy valid JSON response", () => {
    const stored = JSON.stringify({
      kind: "question",
      content: "First line\n\nSecond line",
      suggestedReplies: ["Continue"],
    });

    expect(clientFacingInterviewContent(stored, "en")).toBe(
      "First line\n\nSecond line",
    );
  });

  it("preserves ordinary assistant Markdown", () => {
    const content = "**Question:** What should the website achieve?";

    expect(clientFacingInterviewContent(content, "en")).toBe(content);
  });

  it("does not mistake a leading Markdown link for structured output", () => {
    const content = "[View the portfolio](https://example.com)";

    expect(clientFacingInterviewContent(content, "en")).toBe(content);
  });
});
