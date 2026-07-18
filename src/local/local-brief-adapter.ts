import {
  BRIEF_SECTION_IDS,
  type BriefGeneratorDraft,
  type BriefItemDraft,
  type BriefSectionId,
  type ProjectBriefAdapters,
} from "../domain/project-brief";
import type { DiscoveryFinding } from "../domain/discovery-interview";
import type { Language } from "../domain/project-interviewer";

const titles: Record<
  Language,
  Record<BriefSectionId, string>
> = {
  en: {
    "executive-summary": "Executive summary",
    "goals-and-success": "Project goals and measurable success signals",
    "users-and-stakeholders": "Users and stakeholders",
    "in-scope": "In scope",
    "out-of-scope": "Out of scope",
    "functional-requirements": "Functional Requirements",
    "quality-and-constraints": "Quality requirements and constraints",
    "ux-content-design": "UX, content, and design expectations",
    "data-and-integrations": "Data and integrations",
    "targets-and-external-constraints": "Client targets and external constraints",
    "delivery-and-commercial": "Freelancer-confirmed delivery/commercial parameters",
    "open-trade-offs": "Still-open trade-offs",
    assumptions: "Assumptions",
    risks: "Risks",
    "gaps-and-contradictions": "Gaps and unresolved Contradictions",
    "key-decisions": "Key decisions",
    "evidence-appendix": "Evidence appendix",
  },
  de: {
    "executive-summary": "Zusammenfassung",
    "goals-and-success": "Projektziele und messbare Erfolgssignale",
    "users-and-stakeholders": "Nutzer und Beteiligte",
    "in-scope": "Im Umfang",
    "out-of-scope": "Außerhalb des Umfangs",
    "functional-requirements": "Funktionale Anforderungen",
    "quality-and-constraints": "Qualitätsanforderungen und Rahmenbedingungen",
    "ux-content-design": "UX-, Inhalts- und Designerwartungen",
    "data-and-integrations": "Daten und Integrationen",
    "targets-and-external-constraints": "Client-Ziele und externe Rahmenbedingungen",
    "delivery-and-commercial": "Vom Freelancer bestätigte Liefer- und Geschäftsparameter",
    "open-trade-offs": "Offene Abwägungen",
    assumptions: "Annahmen",
    risks: "Risiken",
    "gaps-and-contradictions": "Lücken und ungelöste Widersprüche",
    "key-decisions": "Wichtige Entscheidungen",
    "evidence-appendix": "Quellenanhang",
  },
};

const unsupported = (language: Language): string =>
  language === "de" ? "Nicht festgestellt" : "Not established";

const requirementSection = (
  statement: string,
): BriefSectionId => {
  const text = statement.toLocaleLowerCase();
  if (
    /security|secure|performance|latency|accessible|reliable|constraint|budget|deadline|sicher|leistung|barriere|zuverläss|rahmen|budget|frist/.test(
      text,
    )
  ) {
    return "quality-and-constraints";
  }
  if (/data|integration|api|database|daten|schnittstelle/.test(text)) {
    return "data-and-integrations";
  }
  if (/design|content|copy|ux|ui|inhalt|gestaltung/.test(text)) {
    return "ux-content-design";
  }
  return "functional-requirements";
};

const itemForFinding = (
  finding: DiscoveryFinding,
): {
  sectionId: BriefSectionId;
  item: BriefItemDraft;
} | null => {
  const base = {
    text: finding.statement,
    sources: finding.sources,
    findingId: finding.id,
  };
  switch (finding.type) {
    case "candidate_requirement":
      return {
        sectionId: requirementSection(finding.statement),
        item: {
          ...base,
          kind: "requirement",
          scopeStatus: "open",
          priority: null,
        },
      };
    case "assumption":
      return {
        sectionId: "assumptions",
        item: { ...base, kind: "assumption" },
      };
    case "risk":
      return {
        sectionId: "risks",
        item: { ...base, kind: "risk" },
      };
    case "gap":
      return {
        sectionId: "gaps-and-contradictions",
        item: { ...base, kind: "gap" },
      };
    case "contradiction":
      return {
        sectionId: "gaps-and-contradictions",
        item: { ...base, kind: "contradiction" },
      };
  }
};

export const localBriefGenerator: NonNullable<
  ProjectBriefAdapters["generator"]
> = {
  async generate(input): Promise<BriefGeneratorDraft> {
    const items = new Map<BriefSectionId, BriefItemDraft[]>(
      BRIEF_SECTION_IDS.map((id) => [id, []]),
    );
    const establishedContent = new Map<BriefSectionId, string>();
    const establishedSources = new Map<
      BriefSectionId,
      BriefItemDraft["sources"]
    >();
    for (const finding of input.findings.filter(
      ({ status }) => status !== "resolved",
    )) {
      const mapped = itemForFinding(finding);
      if (mapped) items.get(mapped.sectionId)!.push(mapped.item);
    }

    const latestCorrectionByTurn = new Map(
      input.corrections.map((correction) => [
        correction.turnId,
        correction,
      ]),
    );
    for (const turn of input.turns.filter(
      ({ answerKind }) => answerKind === "answer",
    )) {
      const correction = latestCorrectionByTurn.get(turn.id);
      const answer =
        correction?.correctedAnswer.trim() || turn.answer.trim();
      if (!answer) continue;
      const sources: BriefItemDraft["sources"] = correction
        ? [
            {
              type: "correction",
              correctionId: correction.id,
            },
          ]
        : [{ type: "turn", turnId: turn.id }];
      switch (turn.question.coverageAreaId) {
        case "goals-users":
          establishedContent.set("goals-and-success", answer);
          establishedContent.set("users-and-stakeholders", answer);
          establishedSources.set("goals-and-success", sources);
          establishedSources.set("users-and-stakeholders", sources);
          break;
        case "success":
          establishedContent.set("goals-and-success", answer);
          establishedSources.set("goals-and-success", sources);
          items.get("targets-and-external-constraints")!.push({
            kind: "target",
            text: answer,
            sources,
          });
          break;
        case "delivery":
          establishedContent.set("users-and-stakeholders", answer);
          establishedSources.set("users-and-stakeholders", sources);
          break;
        case "constraints":
          establishedContent.set("quality-and-constraints", answer);
          establishedSources.set(
            "quality-and-constraints",
            sources,
          );
          if (
            /target|goal|prefer|budgetziel|zielbudget|zieltermin|wunsch|reduzier|steiger/i.test(
              answer,
            )
          ) {
            items.get("targets-and-external-constraints")!.push({
              kind: "target",
              text: answer,
              sources,
            });
          }
          break;
      }
    }

    const candidate = input.findings.find(
      ({ type, status }) =>
        type === "candidate_requirement" && status !== "resolved",
    );
    if (candidate) {
      const matches = await input.searchEvidence(
        candidate.statement,
        3,
      );
      if (matches[0]) {
        await input.inspectEvidence(matches[0].materialId, 2_000);
      }
    }

    const executiveSummary =
      input.language === "de"
        ? `Discovery-Zusammenfassung für: ${input.projectDescription}`
        : `Discovery summary for: ${input.projectDescription}`;
    const executiveSources: BriefItemDraft["sources"] = [
      { type: "project_description" },
    ];
    return {
      sections: BRIEF_SECTION_IDS.map((id) => {
        const sectionItems = items.get(id)!;
        let content = unsupported(input.language);
        if (id === "executive-summary") {
          content = executiveSummary;
        } else if (establishedContent.has(id)) {
          content = establishedContent.get(id)!;
        } else if (sectionItems.length) {
          content =
            input.language === "de"
              ? "Siehe die quellengestützten Punkte unten."
              : "See the source-linked items below.";
        } else if (id === "evidence-appendix") {
          content =
            input.language === "de"
              ? "Detaillierte Quellen werden beim Export hier aufgeführt."
              : "Detailed sources are listed here on export.";
        }
        return {
          id,
          title: titles[input.language][id],
          content,
          sources:
            id === "executive-summary"
              ? executiveSources
              : establishedSources.get(id) ?? [],
          items: sectionItems,
        };
      }),
      model: "local-file-first-brief-generator-v1",
      provider: "local",
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: 0,
      },
    };
  },
};
