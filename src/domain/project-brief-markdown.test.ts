import { describe, expect, it } from "vitest";
import {
  BRIEF_SECTION_IDS,
  type BriefDraft,
} from "./project-brief";
import {
  ProjectBriefMarkdownError,
  replaceProjectBriefMarkdown,
  serializeProjectBriefMarkdown,
} from "./project-brief-markdown";

const draft = (): BriefDraft => ({
  id: "draft_1",
  roomId: "room_1",
  revision: 1,
  language: "en",
  status: "editing",
  markdown: "",
  sections: BRIEF_SECTION_IDS.map((id, index) => ({
    id,
    title: `Section ${index + 1}`,
    content: `Content ${index + 1}`,
    sources: [{ type: "project_description" as const }],
    items:
      id === "functional-requirements"
        ? [
            {
              id: "item_requirement",
              sectionId: id,
              kind: "requirement" as const,
              text: "Support single sign-on.",
              scopeStatus: "open" as const,
              priority: "P1",
              sources: [{ type: "turn" as const, turnId: "turn_1" }],
              findingId: "finding_1",
              authoredBy: "generator" as const,
              requirementState: "candidate" as const,
              order: 0,
              createdAt: 1,
              updatedAt: 1,
            },
          ]
        : [],
  })),
  warnings: [],
  createdAt: 1,
  updatedAt: 1,
});

describe("Project Brief Markdown document seam", () => {
  it("round-trips unchanged structure without losing evidence or Requirement state", () => {
    const source = draft();
    const markdown = serializeProjectBriefMarkdown(source);
    const result = replaceProjectBriefMarkdown(source, markdown, {
      nextId: (prefix) => `${prefix}_next`,
      now: 2,
    });
    const requirement = result.sections
      .find(({ id }) => id === "functional-requirements")!
      .items[0]!;

    expect(requirement).toMatchObject({
      id: "item_requirement",
      sources: [{ type: "turn", turnId: "turn_1" }],
      findingId: "finding_1",
      requirementState: "candidate",
      authoredBy: "generator",
    });
  });

  it("adds Freelancer provenance when a marker-preserved item changes", () => {
    const source = draft();
    const markdown = serializeProjectBriefMarkdown(source).replace(
      "Support single sign-on.",
      "Support single sign-on for all staff.",
    );
    const result = replaceProjectBriefMarkdown(source, markdown, {
      nextId: (prefix) => `${prefix}_next`,
      now: 2,
    });
    const requirement = result.sections
      .find(({ id }) => id === "functional-requirements")!
      .items[0]!;

    expect(requirement).toMatchObject({
      id: "item_requirement",
      requirementState: "candidate",
      authoredBy: "freelancer",
    });
    expect(requirement.findingId).toBeUndefined();
    expect(requirement.sources).toContainEqual(
      expect.objectContaining({ type: "freelancer_edit" }),
    );
  });

  it("rejects renamed or incomplete headings before a Review Version can be sent", () => {
    const source = draft();
    const markdown = serializeProjectBriefMarkdown(source).replace(
      "## Section 1",
      "## Renamed summary",
    );

    expect(() =>
      replaceProjectBriefMarkdown(source, markdown, {
        nextId: (prefix) => `${prefix}_next`,
        now: 2,
      }),
    ).toThrow(ProjectBriefMarkdownError);
  });
});
