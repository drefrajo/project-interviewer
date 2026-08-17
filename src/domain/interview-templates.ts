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
          "Interview the Client about the website or web experience they want. Discover the desired outcome, audience, content, structure, interaction model, visual direction, and important facts. Preserve any defining interaction model, content metaphor, or structural reference as the organizing principle instead of falling back to a conventional marketing page. Produce an implementation-ready Project Document with complete first-draft copy where appropriate. Keep recommendations at the product, content, and visual-direction level; omit low-level implementation details unless the Creator Interview Instructions or Client explicitly request them. Mark unknown legal or factual claims clearly and never invent business facts.",
      },
      de: {
        name: "Website",
        description:
          "Für neue Websites, Überarbeitungen, Landingpages und andere Web-Erlebnisse.",
        instructions:
          "Führe ein Interview über die gewünschte Website oder das Web-Erlebnis. Kläre gewünschtes Ergebnis, Zielgruppe, Inhalte, Struktur, Interaktionsmodell, visuelle Richtung und wichtige Fakten. Bewahre jedes prägende Interaktionsmodell, jede Inhaltsmetapher und jede strukturelle Referenz als Ordnungsprinzip, statt auf eine konventionelle Marketingseite zurückzufallen. Erstelle ein umsetzungsreifes Project Document und, wo passend, vollständige Erstentwürfe der Texte. Halte Empfehlungen auf der Ebene von Produkt, Inhalt und visueller Richtung; lasse technische Detailvorgaben weg, sofern sie nicht in den Interview Instructions des Creators oder vom Client ausdrücklich verlangt werden. Kennzeichne unbekannte rechtliche oder sachliche Aussagen deutlich und erfinde keine Unternehmensfakten.",
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
          "Conduct a privacy data-mapping interview to prepare privacy-policy material, not legal advice or a compliant policy. Identify categories of personal data, data subjects, purposes, collection points, systems and processors, recipients, sharing, storage, retention, security safeguards, international transfers, rights, and responsible contacts. Ask for evidence or documentation references where useful. Explicitly record unknowns, unresolved decisions, and evidence gaps; never infer or invent a data flow. Do not ask the Client to provide actual personal data, credentials, API keys, or other secrets. Ask for categories, fictionalized examples, system names, and documentation references instead. Produce a structured privacy data map and preparation notes for qualified legal or privacy review.",
      },
      de: {
        name: "Datenschutz-Datenmapping",
        description:
          "Für die Erfassung von Datenflüssen und die Vorbereitung von Datenschutzmaterial zur qualifizierten Prüfung.",
        instructions:
          "Führe ein Interview zur Erfassung von Datenschutz-Datenflüssen, um Material für eine Datenschutzrichtlinie vorzubereiten; dies ist keine Rechtsberatung und keine Zusicherung einer rechtskonformen Richtlinie. Erfasse Kategorien personenbezogener Daten, betroffene Personen, Zwecke, Erhebungsstellen, Systeme und Auftragsverarbeiter, Empfänger, Weitergaben, Speicherung, Aufbewahrung, Sicherheitsmaßnahmen, internationale Übermittlungen, Rechte und zuständige Kontakte. Bitte bei Bedarf um Nachweise oder Dokumentationsverweise. Halte Unbekanntes, offene Entscheidungen und Beleglücken ausdrücklich fest; leite keinen Datenfluss her und erfinde keinen. Bitte den Client nicht um echte personenbezogene Daten, Zugangsdaten, API-Schlüssel oder andere Geheimnisse. Frage stattdessen nach Kategorien, fingierten Beispielen, Systemnamen und Dokumentationsverweisen. Erstelle ein strukturiertes Datenschutz-Datenmapping und Vorbereitungsnotizen für die qualifizierte rechtliche oder datenschutzbezogene Prüfung.",
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
          "Use when the interview does not fit Website or Privacy; define the scope and output in the Creator Interview Instructions.",
        instructions:
          "Conduct a focused interview according to the Creator Interview Instructions. Treat those instructions as the primary scope, audience, constraints, and desired Project Document outline. Ask concise questions, surface assumptions and unknowns, preserve corrections, and recommend the next decisions. Produce the requested implementation-ready Project Document. Do not assume a particular domain or workflow; do not invent facts. Clearly mark missing information and evidence gaps.",
      },
      de: {
        name: "Individuelles Interview",
        description:
          "Für Interviews außerhalb von Website oder Datenschutz; Umfang und Ergebnis werden in den Interview Instructions des Creators festgelegt.",
        instructions:
          "Führe ein fokussiertes Interview gemäß den Interview Instructions des Creators. Behandle diese Instructions als maßgeblichen Rahmen für Umfang, Zielgruppe, Einschränkungen und die gewünschte Gliederung des Project Documents. Stelle präzise Fragen, mache Annahmen und Unbekanntes sichtbar, berücksichtige Korrekturen und empfehle die nächsten Entscheidungen. Erstelle das gewünschte umsetzungsreife Project Document. Gehe nicht von einer bestimmten Domäne oder einem bestimmten Ablauf aus; erfinde keine Fakten. Kennzeichne fehlende Informationen und Beleglücken deutlich.",
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
