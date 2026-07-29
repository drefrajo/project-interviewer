export type ClientLanguage = "en" | "de";

export interface BuiltInInterviewTemplate {
  readonly _id: string;
  readonly builtInKey: string;
  readonly kind: "built_in";
  readonly name: string;
  readonly sourceLanguage: ClientLanguage;
  readonly instructions: string;
}

export interface PrivateInterviewTemplate {
  readonly _id: string;
  readonly kind: "private";
  readonly name: string;
  readonly sourceLanguage: ClientLanguage;
  readonly instructions: string;
  readonly updatedAt?: number;
}

export type InterviewTemplate =
  | BuiltInInterviewTemplate
  | PrivateInterviewTemplate;

type BuiltInInterviewTemplateDefinition = {
  key: string;
  name: string;
  instructions: Record<ClientLanguage, string>;
};

const definitions: readonly BuiltInInterviewTemplateDefinition[] = [
  {
    key: "single-page-business",
    name: "Single-page business website",
    instructions: {
      en: "Interview the Client for a focused single-page business website. First identify and preserve any defining interaction model, content metaphor, or structural reference; make it the organizing principle instead of defaulting to a conventional marketing page. Produce an implementation-ready experience outline and complete first-draft copy. Cover the offer, audience, differentiation, proof, calls to action, contact details, visual tone, and any legal or factual unknowns. Keep recommendations at the product, content, and visual-direction level; omit low-level technical specifications unless the Creator Interview Instructions or Client explicitly request them. Never invent business facts.",
      de: "Führe ein fokussiertes Interview für eine einseitige Unternehmenswebsite. Identifiziere und bewahre zuerst jedes prägende Interaktionsmodell, jede Inhaltsmetapher und jede strukturelle Referenz; mache sie zum Ordnungsprinzip, statt auf eine konventionelle Marketingseite zurückzufallen. Erstelle eine umsetzungsreife Beschreibung des Erlebnisses und vollständige Erstentwürfe der Texte. Kläre Angebot, Zielgruppe, Differenzierung, Nachweise, Handlungsaufforderungen, Kontaktdaten, visuelle Tonalität sowie rechtliche oder sachliche Lücken. Halte Empfehlungen auf der Ebene von Produkt, Inhalt und visueller Richtung; lasse technische Detailvorgaben weg, sofern sie nicht in den Interview Instructions des Creators vorgegeben sind oder vom Client ausdrücklich verlangt werden. Erfinde keine Unternehmensfakten.",
    },
  },
  {
    key: "multi-page-business",
    name: "Multi-page business website",
    instructions: {
      en: "Interview the client for a multi-page business website. Produce an implementation-ready sitemap, page-by-page purpose, and complete first-draft copy. Cover the offer, audience, conversion paths, proof, navigation, contact details, visual tone, and unknown legal or factual claims. Never invent business facts.",
      de: "Führe ein Interview für eine mehrseitige Unternehmenswebsite. Erstelle eine umsetzungsreife Sitemap, den Zweck jeder Seite und vollständige Erstentwürfe der Texte. Kläre Angebot, Zielgruppe, Konversionspfade, Nachweise, Navigation, Kontaktdaten, visuelle Tonalität sowie unbekannte rechtliche oder sachliche Aussagen. Erfinde keine Unternehmensfakten.",
    },
  },
  {
    key: "campaign-landing-page",
    name: "Campaign landing page",
    instructions: {
      en: "Interview the client for a campaign landing page. Produce an implementation-ready conversion narrative and complete first-draft copy. Cover the campaign goal, audience, offer, traffic source, proof, objections, call to action, measurement needs, visual direction, and unknown factual claims. Never invent business facts.",
      de: "Führe ein Interview für eine Kampagnen-Landingpage. Erstelle eine umsetzungsreife Konversionsgeschichte und vollständige Erstentwürfe der Texte. Kläre Kampagnenziel, Zielgruppe, Angebot, Traffic-Quelle, Nachweise, Einwände, Handlungsaufforderung, Messanforderungen, visuelle Richtung und unbekannte Tatsachen. Erfinde keine Unternehmensfakten.",
    },
  },
];

export const BUILT_IN_INTERVIEW_TEMPLATES: readonly BuiltInInterviewTemplate[] =
  definitions.flatMap(({ key, name, instructions }) =>
    (["en", "de"] as const).map((sourceLanguage) => ({
      _id: `built-in:${key}:${sourceLanguage}`,
      builtInKey: key,
      kind: "built_in" as const,
      name,
      sourceLanguage,
      instructions: instructions[sourceLanguage],
    })),
  );

export const interviewTemplates = (
  persistedTemplates: readonly InterviewTemplate[] | undefined,
): InterviewTemplate[] => [
  ...BUILT_IN_INTERVIEW_TEMPLATES,
  ...privateInterviewTemplates(persistedTemplates),
];

export const privateInterviewTemplates = (
  persistedTemplates: readonly InterviewTemplate[] | undefined,
): PrivateInterviewTemplate[] =>
  (persistedTemplates ?? []).filter(
    (template): template is PrivateInterviewTemplate =>
      template.kind === "private",
  );

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
