import { describe, expect, it } from "vitest";
import {
  buildConceptSeedMessages,
  buildInterviewPolicy,
  buildProjectDocumentRevisionMessages,
  buildVisualConceptImagePrompt,
} from "./interview_prompts";

const instagramLikeInstructions = `
Use an Instagram-like interface for a photographer's portfolio.
Client galleries are presented as stories and the photographer's works as posts.
`;

describe("Interview prompt contracts", () => {
  it("tells the Interview Model to preserve a defining interaction model and avoid unsolicited technical prescriptions", () => {
    const policy = buildInterviewPolicy({
      clientLanguage: "en",
      instructions: instagramLikeInstructions,
    });
    const normalized = policy.replace(/\s+/g, " ");

    expect(normalized).toContain("organizing principle");
    expect(normalized).toContain("Do not replace it with a conventional website");
    expect(normalized).toContain("Do not add low-level technical specifications");
    expect(normalized).toContain("numerical asset budgets");
  });

  it("carries Creator Interview Instructions into Visual Concept prompt generation", () => {
    const context = {
      instructions: instagramLikeInstructions,
      projectDocument:
        "# Photographer portfolio\n\nShow still life and portrait work.",
    };
    const messages = buildConceptSeedMessages(context);
    const serialized = JSON.stringify(messages);

    expect(serialized).toContain("Instagram-like interface");
    expect(serialized).toContain(
      "Client galleries are presented as stories",
    );
    expect(serialized).toContain("non-negotiable");
    expect(serialized).toContain("generic marketing homepage");
  });

  it("repeats the defining interaction model at the image-rendering boundary", () => {
    const prompt = buildVisualConceptImagePrompt({
      instructions: instagramLikeInstructions,
      projectDocument:
        "# Experience\n\nThe work is browsed as a continuously scrolling feed.",
      conceptPrompt: "A high-contrast editorial direction.",
    });
    const normalized = prompt.replace(/\s+/g, " ");

    expect(normalized).toContain("Instagram-like interface");
    expect(normalized).toContain("Client galleries are presented as stories");
    expect(normalized).toContain("full interface grammar");
    expect(normalized).toContain(
      "do not substitute a generic hero-led marketing page",
    );
  });

  it("keeps the prompt contract when revising a Project Document", () => {
    const messages = buildProjectDocumentRevisionMessages({
      instructions: instagramLikeInstructions,
      projectDocument: "# Existing document",
      feedback: "Use a darker visual direction.",
    });
    const normalized = messages
      .map(({ content }) => content)
      .join(" ")
      .replace(/\s+/g, " ");

    expect(normalized).toContain("Instagram-like interface");
    expect(normalized).toContain("remain authoritative");
    expect(normalized).toContain("defining interaction model");
    expect(normalized).toContain("unsolicited low-level technical specifications");
  });
});
