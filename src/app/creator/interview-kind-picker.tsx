import type { ReactNode } from "react";
import {
  defaultIncludesVisualConceptsForInterviewKind,
  type ClientLanguage,
  type InterviewKind,
  type VisualConceptsMode,
} from "../../domain/interview-templates";

export type { InterviewKind } from "../../domain/interview-templates";

export type TemplateConfigurationSource = {
  _id?: string;
  kind?: "built_in" | "private";
  builtInKey?: string;
  interviewKind?: InterviewKind;
  visualConceptsMode?: VisualConceptsMode;
  includesVisualConcepts?: boolean;
  description?: string;
  sourceLanguage?: ClientLanguage;
  name?: string;
  displayName?: string;
  displayDescription?: string;
  instructions?: string;
};

export type ResolvedInterviewConfiguration = {
  interviewKind: InterviewKind;
  includesVisualConcepts: boolean;
};

export const resolveInterviewConfiguration = (
  value: TemplateConfigurationSource | null | undefined,
): ResolvedInterviewConfiguration => {
  const interviewKind = value?.interviewKind ?? "website";
  return {
    interviewKind,
    includesVisualConcepts:
      interviewKind === "website"
        ? true
        : interviewKind === "privacy"
          ? false
          : (value?.includesVisualConcepts ??
            defaultIncludesVisualConceptsForInterviewKind(interviewKind)),
  };
};

export const fixedConceptSetting = (
  interviewKind: InterviewKind,
): boolean | undefined =>
  interviewKind === "website"
    ? true
    : interviewKind === "privacy"
      ? false
      : undefined;

export const defaultInterviewKindDescription = (
  interviewKind: InterviewKind,
  language: "en" | "de" = "en",
) => {
  if (language === "de") {
    if (interviewKind === "privacy") {
      return "Für Datenflüsse, Zwecke, Systeme, Empfänger, Aufbewahrung und offene Datenschutzfragen.";
    }
    if (interviewKind === "custom") {
      return "Für ein frei gestaltbares Interview mit eigener Zielsetzung und eigenen Anweisungen.";
    }
    return "Für Websites, Landingpages, Redesigns und andere digitale Webprojekte.";
  }
  if (interviewKind === "privacy") {
    return "For data flows, purposes, systems, recipients, retention, and open privacy questions.";
  }
  if (interviewKind === "custom") {
    return "For a flexible interview with your own objective and instructions.";
  }
  return "For websites, landing pages, redesigns, and other digital web projects.";
};

export const interviewKindLabel = (
  interviewKind: InterviewKind,
  language: "en" | "de" = "en",
) => {
  if (language === "de") {
    return {
      website: "Website allgemein",
      privacy: "Datenschutz-Datenmapping",
      custom: "Benutzerdefiniert",
    }[interviewKind];
  }
  return {
    website: "Website discovery",
    privacy: "Privacy data mapping",
    custom: "Custom interview",
  }[interviewKind];
};

export const conceptsLabel = (
  includesVisualConcepts: boolean | undefined,
  language: "en" | "de" = "en",
) => {
  if (includesVisualConcepts === undefined) {
    return language === "de"
      ? "Visuelle Konzepte: optional"
      : "Visual Concepts: optional";
  }
  if (includesVisualConcepts) {
    return language === "de"
      ? "Visuelle Konzepte: enthalten"
      : "Visual Concepts: included";
  }
  return language === "de"
    ? "Visuelle Konzepte: nicht enthalten"
    : "Visual Concepts: not included";
};

export const templateDescription = (
  template: TemplateConfigurationSource,
  language: "en" | "de" = "en",
) => {
  if (template.description?.trim()) return template.description;
  return defaultInterviewKindDescription(
    resolveInterviewConfiguration(template).interviewKind,
    language,
  );
};

export type TemplateCardValue = TemplateConfigurationSource & {
  _id: string;
  name: string;
  sourceLanguage: ClientLanguage;
  instructions: string;
};

export const InterviewTemplatePicker = ({
  templates,
  selectedTemplateId,
  language,
  legend,
  hint,
  compact = false,
  disabled = false,
  sourceLabels,
  onSelect,
}: {
  templates: readonly TemplateCardValue[];
  selectedTemplateId: string;
  language: "en" | "de";
  legend: string;
  hint?: string;
  compact?: boolean;
  disabled?: boolean;
  sourceLabels: { builtIn: string; private: string };
  onSelect(templateId: string): void;
}) => (
  <fieldset className="grid gap-3">
    <legend className="text-sm font-bold text-ink">{legend}</legend>
    {hint ? <p className="text-sm leading-6 text-muted">{hint}</p> : null}
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {templates.map((template) => {
        const configuration = resolveInterviewConfiguration(template);
        const checked = selectedTemplateId === template._id;
        const description = templateDescription(template, language);
        const inputId = `interview-template-${template._id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
        const descriptionId = `${inputId}-description`;
        return (
          <label
            className={`group relative grid cursor-pointer rounded-box border transition hover:border-primary hover:shadow-md has-[:checked]:border-primary has-[:checked]:bg-soft ${
              compact ? "gap-2 p-3" : "gap-3 p-4"
            } ${
              checked
                ? "border-primary bg-soft"
                : "border-line bg-panel"
            }`}
            data-template-id={template._id}
            htmlFor={inputId}
            key={template._id}
          >
            <input
              aria-describedby={descriptionId}
              checked={checked}
              className="absolute right-4 top-4 size-4 accent-[var(--color-primary)]"
              disabled={disabled}
              id={inputId}
              name="interview-template"
              onChange={() => onSelect(template._id)}
              type="radio"
              value={template._id}
            />
            <span className="pr-8 text-xs font-extrabold tracking-[0.12em] text-forest uppercase">
              {template.kind === "private"
                ? sourceLabels.private
                : sourceLabels.builtIn}
              {template.sourceLanguage
                ? ` · ${template.sourceLanguage.toUpperCase()}`
                : ""}
            </span>
            <span className={`font-display font-extrabold ${compact ? "text-lg" : "text-xl"}`}>
              {template.displayName ?? template.name}
            </span>
            <span className="text-sm leading-6 text-muted" id={descriptionId}>
              {template.displayDescription ?? description}
            </span>
            <span className="text-sm font-bold text-primary">
              {interviewKindLabel(configuration.interviewKind, language)} · {conceptsLabel(
                template.kind === "built_in" &&
                  configuration.interviewKind === "custom"
                  ? undefined
                  : configuration.includesVisualConcepts,
                language,
              )}
            </span>
          </label>
        );
      })}
    </div>
  </fieldset>
);

export const InterviewKindPicker = ({
  value,
  language,
  legend,
  onChange,
  children,
}: {
  value: InterviewKind;
  language: "en" | "de";
  legend: string;
  onChange(value: InterviewKind): void;
  children?: ReactNode;
}) => (
  <fieldset className="grid gap-3">
    <legend className="text-sm font-bold text-ink">{legend}</legend>
    <div className="grid gap-3 md:grid-cols-3">
      {(["website", "privacy", "custom"] as const).map((kind) => (
        <label
          className={`grid cursor-pointer gap-2 rounded-box border p-4 transition hover:border-primary has-[:checked]:border-primary has-[:checked]:bg-soft ${
            value === kind ? "border-primary bg-soft" : "border-line bg-panel"
          }`}
          htmlFor={`interview-kind-${kind}`}
          key={kind}
        >
          <input
            checked={value === kind}
            className="size-4 accent-[var(--color-primary)]"
            id={`interview-kind-${kind}`}
            name="interview-kind"
            onChange={() => onChange(kind)}
            type="radio"
            value={kind}
          />
          <span className="font-display text-lg font-extrabold">
            {interviewKindLabel(kind, language)}
          </span>
          <span className="text-sm leading-6 text-muted">
            {defaultInterviewKindDescription(kind, language)}
          </span>
          <span className="text-sm font-bold text-primary">
            {conceptsLabel(fixedConceptSetting(kind), language)}
          </span>
        </label>
      ))}
    </div>
    {children}
  </fieldset>
);
