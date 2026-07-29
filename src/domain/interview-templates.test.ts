import { describe, expect, it } from "vitest";
import {
  BUILT_IN_INTERVIEW_TEMPLATES,
  builtInInterviewTemplateForLanguage,
  interviewTemplates,
  privateInterviewTemplates,
  type BuiltInInterviewTemplate,
  type PrivateInterviewTemplate,
} from "./interview-templates";

describe("Built-in Interview Templates", () => {
  it("defines stable localized variants in frontend product code", () => {
    expect(
      BUILT_IN_INTERVIEW_TEMPLATES.map(({ _id }) => _id),
    ).toEqual([
      "built-in:single-page-business:en",
      "built-in:single-page-business:de",
      "built-in:multi-page-business:en",
      "built-in:multi-page-business:de",
      "built-in:campaign-landing-page:en",
      "built-in:campaign-landing-page:de",
    ]);
  });

  it("keeps a Client's defining interaction model central in the single-page template", () => {
    const template = BUILT_IN_INTERVIEW_TEMPLATES.find(
      ({ _id }) => _id === "built-in:single-page-business:en",
    );
    const germanTemplate = BUILT_IN_INTERVIEW_TEMPLATES.find(
      ({ _id }) => _id === "built-in:single-page-business:de",
    );

    expect(template?.instructions).toContain("defining interaction model");
    expect(template?.instructions).toContain("conventional marketing page");
    expect(template?.instructions).toContain(
      "low-level technical specifications",
    );
    expect(germanTemplate?.instructions).toContain(
      "prägende Interaktionsmodell",
    );
    expect(germanTemplate?.instructions).toContain(
      "konventionelle Marketingseite",
    );
  });

  it("merges private templates after built-ins and resolves language pairs", () => {
    const privateTemplate: PrivateInterviewTemplate = {
      _id: "private-template",
      kind: "private",
      name: "My template",
      sourceLanguage: "en",
      instructions: "Private instructions",
    };
    const templates = interviewTemplates([privateTemplate]);
    const englishBuiltIn = templates.find(
      ({ _id }) => _id === "built-in:single-page-business:en",
    );

    expect(templates.at(-1)).toBe(privateTemplate);
    expect(
      englishBuiltIn &&
        builtInInterviewTemplateForLanguage(englishBuiltIn, "de")?._id,
    ).toBe("built-in:single-page-business:de");
    expect(
      builtInInterviewTemplateForLanguage(privateTemplate, "de"),
    ).toBeUndefined();
  });

  it("discards legacy persisted built-ins during a rolling deployment", () => {
    const legacyBuiltIn: BuiltInInterviewTemplate = {
      _id: "persisted-built-in",
      builtInKey: "single-page-business",
      kind: "built_in",
      name: "Single-page business website",
      sourceLanguage: "de",
      instructions: "Stale persisted instructions",
    };

    expect(privateInterviewTemplates([legacyBuiltIn])).toEqual([]);
    expect(
      interviewTemplates([legacyBuiltIn]).some(
        ({ instructions }) => instructions === "Stale persisted instructions",
      ),
    ).toBe(false);
  });
});
