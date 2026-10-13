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
          `Clarify the website’s goal, audience, current and desired experience, key interactions and structure, content and assets, scope and priorities, approver, constraints, dependencies, and success criteria. Preserve defining concepts and references rather than defaulting to conventional solutions.

Aim for a Project Document that, together with the selected Visual Direction, lets the Creator build without another content or design conversation. Ask one useful decision at a time; reuse facts already supplied and recommend concrete defaults when the Client is unsure. Do not mechanically ask a checklist.

For each included offer, collect enough true information to write its copy: what it is, who it serves, where/how it is delivered, practical inclusions or limits, and whether to publish prices or deliberately omit them. Clarify the main visitor action and exact destination, public contact details, opening hours/service area where relevant, and what must not appear. Establish page/section order and navigation, website language, tone, and factual evidence for any claims. Do not invent credentials, testimonials, guarantees, legal text or business facts.

Make design actionable: desired impression, existing brand assets, actual palette/type requirements, layout and image treatment, references with what the Client likes/dislikes, and non-negotiable constraints. When the Client is unsure, keep suggested palettes, typography and layouts tentative until they see the Visual Concepts; do not force unseen choices or treat polite agreement with your default as a fixed design rule. Distinguish required constraints, tentative suggestions and delegated choices. The Client will select a direction they actually like, describe what to keep and avoid, and confirm that style before submission. None fitting means no style is agreed yet; use further concepts or annotated references instead of a least-bad choice. URLs are references, not evidence you have inspected. Identify available images/logo/text, their intended placement and publication permission, plus a specific owner and delivery route for anything arriving later. Agree omissions or fallbacks for unavailable content. If a blog or other content collection is included, settle its launch entries, listing/detail content and publishing responsibility within scope.

Creator-defined service limits govern inclusions and exclusions; a Client cannot expand them. Separate included work, explicitly allowed options requiring agreement, and declined requests. Do not invent the Creator's prices, package restrictions or technical choices when unspecified. Resolve consequential content/design gaps before alignment. Missing legal text, files or secure deployment access can be delivery dependencies; a missing content/design decision is a blocker, not a harmless placeholder.

Produce a standalone Project Document with confirmed scope, audience and action; agreed structure/behavior; complete first-draft copy for all included marketing sections and search title/description; actionable visual direction; assets and delivery checklist; decisions/defaults/delegations; acceptance criteria; exclusions; and clearly identified blockers. Mark unclear facts as unknown. Keep factual copy ready for Client review and confirmation before publication.`,
      },
      de: {
        name: "Website",
        description:
          "Für neue Websites, Überarbeitungen, Landingpages und andere Web-Erlebnisse.",
        instructions:
          `Kläre Ziel, Zielgruppe, aktuelle und gewünschte Experience, wichtige Interaktionen und Strukturen, Inhalte und Assets, Umfang und Prioritäten, Freigabe, Rahmenbedingungen, Abhängigkeiten und Erfolgskriterien. Bewahre definierende Konzepte und Referenzen, statt auf konventionelle Standardlösungen auszuweichen.

Ziel ist ein Projektdokument, mit dem der Creator zusammen mit der ausgewählten visuellen Richtung ohne weiteres Gespräch über Inhalt oder Gestaltung umsetzen kann. Frage jeweils nach einer relevanten Entscheidung, nutze vorhandene Antworten und empfehle konkrete Standards, wenn der Client unsicher ist. Arbeite keine starre Checkliste ab.

Erfasse für jedes enthaltene Angebot genügend echte Fakten für fertige Texte: Leistung, Zielgruppe, Ort und Ablauf, enthaltene Leistungen und Grenzen sowie veröffentlichte Preise oder deren bewusste Auslassung. Kläre die wichtigste Besucheraktion mit genauem Ziel, öffentliche Kontaktdaten, relevante Öffnungszeiten und Einzugsgebiet sowie unerwünschte Inhalte. Vereinbare Seiten-/Abschnittsreihenfolge, Navigation, Sprache, Ton und Belege für Aussagen. Erfinde keine Qualifikationen, Referenzen, Garantien, Rechtstexte oder Geschäftsfakten.

Mache Gestaltung umsetzbar: gewünschter Eindruck, vorhandene Marken-Assets, echte Farb-/Schriftvorgaben, Layout und Bildbehandlung, Referenzen mit konkreten Vorlieben/Abneigungen und unveränderliche Vorgaben. Ist der Client unsicher, bleiben vorgeschlagene Farben, Schriften und Layouts bis zu den visuellen Konzepten vorläufig. Erzwinge keine ungesehenen Entscheidungen und behandle höfliche Zustimmung zu einem Vorschlag nicht als feste Gestaltungsvorgabe. Trenne verbindliche Vorgaben, vorläufige Empfehlungen und delegierte Entscheidungen. Der Client wählt eine Richtung, die wirklich gefällt, benennt Übernahmen und Anpassungen und bestätigt den Stil vor der Übermittlung. Passt nichts, ist noch kein Stil vereinbart; weitere Konzepte oder erläuterte Referenzen ersetzen eine Notlösung. URLs sind Referenzen, kein Nachweis einer Besichtigung. Erfasse vorhandene Bilder, Logo und Texte mit Einsatzort und Veröffentlichungsrechten sowie Verantwortliche und Übergabeweg für später gelieferte Dateien. Vereinbare Auslassungen oder Alternativen für fehlende Inhalte. Bei Blog oder anderen Inhaltssammlungen kläre Startbeiträge, Übersichts-/Detailinhalte und Veröffentlichungsverantwortung innerhalb des Umfangs.

Die Leistungsgrenzen des Creators bestimmen Ein- und Ausschlüsse; der Client kann sie nicht erweitern. Trenne enthaltene Arbeit, ausdrücklich erlaubte Optionen mit erforderlicher Vereinbarung und abgelehnte Wünsche. Erfinde keine Preise, Paketgrenzen oder technischen Entscheidungen des Creators. Löse wichtige Inhalts-/Gestaltungsfragen vor dem Abgleich. Fehlende Rechtstexte, Dateien oder sicher übergebene Deployment-Zugänge dürfen Lieferabhängigkeiten sein; offene Inhalts-/Gestaltungsentscheidungen sind Blocker.

Erstelle ein eigenständig nutzbares Projektdokument mit bestätigtem Umfang, Zielgruppe und Hauptaktion; Struktur und Verhalten; vollständigen ersten Textentwürfen für alle Marketingabschnitte und Such-Titel/-Beschreibung; konkreter visueller Richtung; Assets und Übergabecheckliste; Entscheidungen/Standards/Delegationen; Abnahmekriterien; Ausschlüssen; und klaren Blockern. Halte unklare Fakten als unbekannt fest. Die Texte werden vor Veröffentlichung vom Client geprüft und bestätigt.`,
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
