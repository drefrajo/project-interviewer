import type {
  Language,
  ProjectPhase,
} from "../domain/project-interviewer";

const phaseLabels: Record<
  Language,
  Record<ProjectPhase, string>
> = {
  en: {
    setup: "Setup",
    discovery: "Discovery",
    freelancer_review: "Freelancer review",
    client_review: "Client review",
    approved: "Approved",
    archived: "Archived",
  },
  de: {
    setup: "Einrichtung",
    discovery: "Klärung",
    freelancer_review: "Freelancer-Prüfung",
    client_review: "Client-Prüfung",
    approved: "Freigegeben",
    archived: "Archiviert",
  },
};

export const projectPhaseLabel = (
  phase: ProjectPhase,
  locale: Language,
): string => phaseLabels[locale][phase];
