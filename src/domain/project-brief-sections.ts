export const BRIEF_SECTION_IDS = [
  "executive-summary",
  "goals-and-success",
  "users-and-stakeholders",
  "in-scope",
  "out-of-scope",
  "functional-requirements",
  "quality-and-constraints",
  "ux-content-design",
  "data-and-integrations",
  "targets-and-external-constraints",
  "delivery-and-commercial",
  "open-trade-offs",
  "assumptions",
  "risks",
  "gaps-and-contradictions",
  "key-decisions",
  "evidence-appendix",
] as const;

export type BriefSectionId = (typeof BRIEF_SECTION_IDS)[number];
