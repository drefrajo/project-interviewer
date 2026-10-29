export type ClientLanguage = "en" | "de";

/** Product-owned behavior and output configuration for an Interview. */
export type InterviewKind = "website" | "privacy" | "custom";

/** Whether a kind fixes or lets the Creator choose Visual Concepts. */
export type VisualConceptsMode =
  | "included"
  | "excluded"
  | "configurable";

export interface BuiltInInterviewTemplate {
  readonly _id: string;
  readonly builtInKey: InterviewKind;
  /** Storage provenance; this is not the Interview's product behavior. */
  readonly kind: "built_in";
  readonly interviewKind: InterviewKind;
  readonly name: string;
  readonly description: string;
  readonly sourceLanguage: ClientLanguage;
  readonly instructions: string;
  readonly visualConceptsMode: VisualConceptsMode;
  readonly includesVisualConcepts: boolean;
}

export interface PrivateInterviewTemplate {
  readonly _id: string;
  /** Storage provenance; this is not the Interview's product behavior. */
  readonly kind: "private";
  readonly interviewKind: InterviewKind;
  readonly name: string;
  readonly description?: string;
  readonly sourceLanguage: ClientLanguage;
  readonly instructions: string;
  readonly visualConceptsMode: VisualConceptsMode;
  readonly includesVisualConcepts: boolean;
  readonly updatedAt?: number;
}

/**
 * Shape accepted from persisted records while a schema migration is rolling
 * out. Callers should use `normalizePrivateInterviewTemplate` before using it
 * as a concrete template.
 */
export type LegacyPrivateInterviewTemplate = Omit<
  PrivateInterviewTemplate,
  | "interviewKind"
  | "description"
  | "visualConceptsMode"
  | "includesVisualConcepts"
> & {
  readonly interviewKind?: InterviewKind;
  readonly description?: string;
  readonly visualConceptsMode?: VisualConceptsMode;
  readonly includesVisualConcepts?: boolean;
};

/** Legacy built-ins are ignored; their definitions are owned by this module. */
type LegacyBuiltInInterviewTemplate = Omit<
  BuiltInInterviewTemplate,
  | "builtInKey"
  | "interviewKind"
  | "description"
  | "visualConceptsMode"
  | "includesVisualConcepts"
> & {
  readonly builtInKey?: string;
  readonly interviewKind?: InterviewKind;
  readonly description?: string;
  readonly visualConceptsMode?: VisualConceptsMode;
  readonly includesVisualConcepts?: boolean;
};

export type PersistedInterviewTemplate =
  | BuiltInInterviewTemplate
  | PrivateInterviewTemplate
  | LegacyPrivateInterviewTemplate
  | LegacyBuiltInInterviewTemplate;

export type InterviewTemplate =
  | BuiltInInterviewTemplate
  | PrivateInterviewTemplate;

type BuiltInInterviewTemplateDefinition = {
  key: InterviewKind;
  visualConceptsMode: VisualConceptsMode;
  variants: Record<
    ClientLanguage,
    {
      name: string;
      description: string;
      instructions: string;
    }
  >;
};

const definitions: readonly BuiltInInterviewTemplateDefinition[] = [
  {
    key: "website",
    visualConceptsMode: "included",
    variants: {
      en: {
        name: "Website",
        description:
          "Use for new websites, redesigns, landing pages, and other web experiences.",
        instructions:
          "Clarify the website’s goal, audience, current and desired experience, key interactions and structure, content and assets, scope and priorities, approver, constraints, dependencies, and success criteria. Preserve defining concepts and references rather than defaulting to conventional solutions. Mark unclear points as unknown. Summarize confirmed decisions, priorities, needs, constraints, and open questions.",
      },
      de: {
        name: "Website",
        description:
          "Für neue Websites, Überarbeitungen, Landingpages und andere Web-Erlebnisse.",
        instructions:
          "Kläre Ziel, Zielgruppe, aktuelle und gewünschte Experience, wichtige Interaktionen und Strukturen, Inhalte und Assets, Umfang und Prioritäten, Freigabe, Rahmenbedingungen, Abhängigkeiten und Erfolgskriterien. Bewahre definierende Konzepte und Referenzen, statt auf konventionelle Standardlösungen auszuweichen. Halte Unklares als unbekannt fest. Fasse bestätigte Entscheidungen, Prioritäten, Anforderungen, Rahmenbedingungen und offene Fragen zusammen.",
      },
    },
  },
  {
    key: "privacy",
    visualConceptsMode: "excluded",
    variants: {
      en: {
        name: "Privacy data mapping",
        description:
          "Use to map an organization's data flows and prepare privacy-policy material for qualified review.",
        instructions:
          "Map how personal data is collected, used, shared, stored, retained, and deleted, including systems, vendors, recipients, purposes, owners, and available evidence. Mark uncertain flows, missing documentation, and unanswered questions without making assumptions. Do not request personal data, credentials, secrets, or other sensitive values. This is preparation, not legal advice. Summarize confirmed facts, ownership, evidence gaps, and items requiring review.",
      },
      de: {
        name: "Datenschutz-Datenmapping",
        description:
          "Für die Erfassung von Datenflüssen und die Vorbereitung von Datenschutzmaterial zur qualifizierten Prüfung.",
        instructions:
          "Erfasse, wie personenbezogene Daten erhoben, genutzt, weitergegeben, gespeichert, aufbewahrt und gelöscht werden, einschließlich Systemen, Dienstleistern, Empfängern, Zwecken, Verantwortlichen und vorhandenen Nachweisen. Kennzeichne unsichere Datenflüsse, fehlende Dokumentation und offene Fragen, ohne Annahmen zu treffen. Frage keine personenbezogenen Daten, Zugangsdaten, Geheimnisse oder andere sensible Werte ab. Dies dient der Vorbereitung und ist keine Rechtsberatung. Fasse bestätigte Fakten, Verantwortlichkeiten, Nachweislücken und Prüfbedarf zusammen.",
      },
    },
  },
  {
    key: "custom",
    visualConceptsMode: "configurable",
    variants: {
      en: {
        name: "Custom interview",
        description:
          "Use for interviews outside Website and Privacy.",
        instructions:
          "Clarify the desired outcome, participants, current situation, intended change, scope and priorities, required inputs, constraints, dependencies, decision-makers, and acceptance criteria where relevant. Skip irrelevant questions and mark assumptions, conflicts, and undecided points as unknown. Summarize the confirmed direction, priorities, responsibilities, dependencies, acceptance criteria, and open questions in terms appropriate to the project.",
      },
      de: {
        name: "Individuelles Interview",
        description:
          "Für Interviews außerhalb von Website und Datenschutz.",
        instructions:
          "Kläre, soweit relevant, das gewünschte Ergebnis, beteiligte Personen, die aktuelle Situation, die angestrebte Veränderung, Umfang und Prioritäten, benötigte Inputs, Rahmenbedingungen, Abhängigkeiten, Entscheidungsträger und Abnahmekriterien. Überspringe irrelevante Fragen und halte Annahmen, Widersprüche und offene Entscheidungen als unbekannt fest. Fasse die bestätigte Richtung, Prioritäten, Verantwortlichkeiten, Abhängigkeiten, Abnahmekriterien und offenen Fragen passend zum Projekt zusammen.",
      },
    },
  },
];

export const BUILT_IN_INTERVIEW_TEMPLATES: readonly BuiltInInterviewTemplate[] =
  definitions.flatMap(({ key, visualConceptsMode, variants }) =>
    (Object.keys(variants) as ClientLanguage[]).map((sourceLanguage) => ({
      _id: `built-in:${key}:${sourceLanguage}`,
      builtInKey: key,
      kind: "built_in" as const,
      interviewKind: key,
      name: variants[sourceLanguage].name,
      description: variants[sourceLanguage].description,
      sourceLanguage,
      instructions: variants[sourceLanguage].instructions,
      visualConceptsMode,
      includesVisualConcepts: visualConceptsMode === "included",
    })),
  );

export const visualConceptsModeForInterviewKind = (
  interviewKind: InterviewKind,
): VisualConceptsMode => {
  switch (interviewKind) {
    case "website":
      return "included";
    case "privacy":
      return "excluded";
    case "custom":
      return "configurable";
  }
};

export const defaultIncludesVisualConceptsForInterviewKind = (
  interviewKind: InterviewKind,
): boolean => interviewKind === "website";

export const normalizePrivateInterviewTemplate = (
  template: PrivateInterviewTemplate | LegacyPrivateInterviewTemplate,
): PrivateInterviewTemplate => {
  const interviewKind = template.interviewKind ?? "website";
  const visualConceptsMode =
    visualConceptsModeForInterviewKind(interviewKind);
  const includesVisualConcepts =
    visualConceptsMode === "included"
      ? true
      : visualConceptsMode === "excluded"
        ? false
        : (template.includesVisualConcepts ?? false);

  return {
    _id: template._id,
    kind: "private",
    interviewKind,
    name: template.name,
    ...(template.description === undefined
      ? {}
      : { description: template.description }),
    sourceLanguage: template.sourceLanguage,
    instructions: template.instructions,
    visualConceptsMode,
    includesVisualConcepts,
    ...(template.updatedAt === undefined
      ? {}
      : { updatedAt: template.updatedAt }),
  };
};

export const interviewTemplates = (
  persistedTemplates: readonly PersistedInterviewTemplate[] | undefined,
): InterviewTemplate[] => [
  ...BUILT_IN_INTERVIEW_TEMPLATES,
  ...privateInterviewTemplates(persistedTemplates),
];

export const privateInterviewTemplates = (
  persistedTemplates: readonly PersistedInterviewTemplate[] | undefined,
): PrivateInterviewTemplate[] =>
  (persistedTemplates ?? [])
    .filter(
      (
        template,
      ): template is PrivateInterviewTemplate | LegacyPrivateInterviewTemplate =>
        template.kind === "private",
    )
    .map(normalizePrivateInterviewTemplate);

export const builtInInterviewTemplateForLanguage = (
  template: InterviewTemplate,
  sourceLanguage: ClientLanguage,
): BuiltInInterviewTemplate | undefined =>
  template.kind === "built_in"
    ? BUILT_IN_INTERVIEW_TEMPLATES.find(
        (candidate) =>
          candidate.builtInKey === template.builtInKey &&
          candidate.sourceLanguage === sourceLanguage,
      )
    : undefined;
