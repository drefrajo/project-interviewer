import { describe, expect, it } from "vitest";
import {
  BUILT_IN_INTERVIEW_TEMPLATES,
  builtInInterviewTemplateForLanguage,
  interviewTemplates,
  normalizePrivateInterviewTemplate,
  privateInterviewTemplates,
  type PersistedInterviewTemplate,
  type PrivateInterviewTemplate,
} from "./interview-templates";

describe("Built-in Interview Templates", () => {
  it("defines exactly one localized template for each Interview Kind", () => {
    expect(
      BUILT_IN_INTERVIEW_TEMPLATES.map(({ _id }) => _id),
    ).toEqual([
      "built-in:website:en",
      "built-in:website:de",
      "built-in:privacy:en",
      "built-in:privacy:de",
      "built-in:custom:en",
      "built-in:custom:de",
    ]);
    expect(
      BUILT_IN_INTERVIEW_TEMPLATES.map(({ interviewKind }) => interviewKind),
    ).toEqual(["website", "website", "privacy", "privacy", "custom", "custom"]);
  });

  it("exposes localized selector descriptions and concrete Visual Concepts settings", () => {
    const byId = (id: string) =>
      BUILT_IN_INTERVIEW_TEMPLATES.find(({ _id }) => _id === id);

    expect(byId("built-in:website:en")).toMatchObject({
      description: expect.stringContaining("websites"),
      visualConceptsMode: "included",
      includesVisualConcepts: true,
    });
    expect(byId("built-in:privacy:en")).toMatchObject({
      description: expect.stringContaining("data flows"),
      visualConceptsMode: "excluded",
      includesVisualConcepts: false,
    });
    expect(byId("built-in:custom:en")).toMatchObject({
      description: expect.stringContaining("Creator Interview Instructions"),
      visualConceptsMode: "configurable",
      includesVisualConcepts: false,
    });
    expect(byId("built-in:website:de")?.description).not.toBe(
      byId("built-in:website:en")?.description,
    );
    expect(byId("built-in:privacy:de")?.description).toContain("Datenflüssen");
    expect(byId("built-in:custom:de")?.description).toContain(
      "Interview Instructions",
    );
  });

  it("keeps the Website template's defining interaction model central", () => {
    const template = BUILT_IN_INTERVIEW_TEMPLATES.find(
      ({ _id }) => _id === "built-in:website:en",
    );
    const germanTemplate = BUILT_IN_INTERVIEW_TEMPLATES.find(
      ({ _id }) => _id === "built-in:website:de",
    );

    expect(template?.instructions).toContain("defining interaction model");
    expect(template?.instructions).toContain("conventional marketing page");
    expect(template?.instructions).toContain("low-level implementation details");
    expect(germanTemplate?.instructions).toContain(
      "prägende Interaktionsmodell",
    );
    expect(germanTemplate?.instructions).toContain(
      "konventionelle Marketingseite",
    );
  });

  it("keeps Privacy instructions safe and explicit about uncertainty", () => {
    const english = BUILT_IN_INTERVIEW_TEMPLATES.find(
      ({ _id }) => _id === "built-in:privacy:en",
    )?.instructions;
    const german = BUILT_IN_INTERVIEW_TEMPLATES.find(
      ({ _id }) => _id === "built-in:privacy:de",
    )?.instructions;

    expect(english).toContain("not legal advice");
    expect(english).toContain("actual personal data");
    expect(english).toContain("credentials");
    expect(english).toContain("secrets");
    expect(english).toContain("unknowns");
    expect(english).toContain("evidence gaps");
    expect(german).toContain("keine Rechtsberatung");
    expect(german).toContain("echte personenbezogene Daten");
    expect(german).toContain("Beleglücken");
  });

  it("keeps Custom instructions generic and Creator-governed", () => {
    const english = BUILT_IN_INTERVIEW_TEMPLATES.find(
      ({ _id }) => _id === "built-in:custom:en",
    )?.instructions;
    const german = BUILT_IN_INTERVIEW_TEMPLATES.find(
      ({ _id }) => _id === "built-in:custom:de",
    )?.instructions;

    expect(english).toContain("Creator Interview Instructions");
    expect(english).toContain("primary scope");
    expect(english).toContain("do not invent facts");
    expect(english?.toLowerCase()).not.toContain("website");
    expect(german).toContain("Interview Instructions des Creators");
    expect(german).toContain("erfinde keine Fakten");
  });

  it("merges private templates after built-ins and resolves language pairs", () => {
    const privateTemplate: PrivateInterviewTemplate = {
      _id: "private-template",
      kind: "private",
      interviewKind: "custom",
      name: "My template",
      description: "A custom flow",
      sourceLanguage: "en",
      instructions: "Private instructions",
      visualConceptsMode: "configurable",
      includesVisualConcepts: true,
    };
    const templates = interviewTemplates([privateTemplate]);
    const englishBuiltIn = templates.find(
      ({ _id }) => _id === "built-in:website:en",
    );

    expect(templates.at(-1)).toEqual(privateTemplate);
    expect(
      englishBuiltIn &&
        builtInInterviewTemplateForLanguage(englishBuiltIn, "de")?._id,
    ).toBe("built-in:website:de");
    expect(
      builtInInterviewTemplateForLanguage(privateTemplate, "de"),
    ).toBeUndefined();
  });

  it("normalizes legacy private templates with safe Website defaults", () => {
    const legacyPrivate = {
      _id: "legacy-private",
      kind: "private" as const,
      name: "Legacy template",
      sourceLanguage: "de" as const,
      instructions: "Legacy instructions",
    } satisfies PersistedInterviewTemplate;

    expect(privateInterviewTemplates([legacyPrivate])).toEqual([
      expect.objectContaining({
        _id: "legacy-private",
        interviewKind: "website",
        visualConceptsMode: "included",
        includesVisualConcepts: true,
      }),
    ]);
  });

  it("normalizes fixed kinds and preserves the Custom choice", () => {
    const privacy = normalizePrivateInterviewTemplate({
      _id: "privacy-private",
      kind: "private",
      interviewKind: "privacy",
      name: "Privacy",
      sourceLanguage: "en",
      instructions: "Privacy instructions",
      includesVisualConcepts: true,
    });
    const custom = normalizePrivateInterviewTemplate({
      _id: "custom-private",
      kind: "private",
      interviewKind: "custom",
      name: "Custom",
      sourceLanguage: "en",
      instructions: "Custom instructions",
      includesVisualConcepts: true,
    });

    expect(privacy).toMatchObject({
      visualConceptsMode: "excluded",
      includesVisualConcepts: false,
    });
    expect(custom).toMatchObject({
      visualConceptsMode: "configurable",
      includesVisualConcepts: true,
    });
  });

  it("discards legacy persisted built-ins during a rolling deployment", () => {
    const legacyBuiltIn = {
      _id: "persisted-built-in",
      kind: "built_in" as const,
      builtInKey: "single-page-business",
      name: "Legacy built-in",
      sourceLanguage: "de" as const,
      instructions: "Stale persisted instructions",
    } satisfies PersistedInterviewTemplate;

    expect(privateInterviewTemplates([legacyBuiltIn])).toEqual([]);
    expect(
      interviewTemplates([legacyBuiltIn]).some(
        ({ instructions }) => instructions === "Stale persisted instructions",
      ),
    ).toBe(false);
  });
});
