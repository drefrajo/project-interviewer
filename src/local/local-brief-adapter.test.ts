import { describe, expect, it, vi } from "vitest";
import { BRIEF_SECTION_IDS } from "../domain/project-brief";
import { localBriefGenerator } from "./local-brief-adapter";
import {
  localInterviewPlanner,
} from "./local-interview-adapters";
import { SOFTWARE_PROJECT_PROFILE } from "../domain/discovery-interview";

const inputFor = async (language: "en" | "de") => {
  const planDraft = await localInterviewPlanner.plan({
    language,
    projectDescription: "A self-service portal.",
    freelancerGuidance: "",
    contextPack: null,
    profile: SOFTWARE_PROJECT_PROFILE,
  });
  const inspectEvidence = vi.fn(async () => []);
  return {
    language,
    projectDescription: "A self-service portal.",
    contextPack: null,
    plan: {
      ...planDraft,
      id: "plan",
      roomId: "room",
      language,
      promptVersion:
        "software-project-interview-planner-v1" as const,
      schemaVersion: "interview-plan-v1" as const,
      createdAt: 1,
      updatedAt: 1,
    },
    findings: [
      {
        id: "candidate",
        roomId: "room",
        interviewId: "interview",
        type: "candidate_requirement" as const,
        statement:
          language === "de"
            ? "Das Produkt muss Single Sign-on unterstützen."
            : "The product must support single sign-on.",
        sources: [{ type: "turn" as const, turnId: "turn-1" }],
        status: "active" as const,
        createdAt: 1,
      },
      {
        id: "gap",
        roomId: "room",
        interviewId: "interview",
        type: "gap" as const,
        statement:
          language === "de"
            ? "Die Datenaufbewahrung ist nicht geklärt."
            : "Data retention is not established.",
        sources: [{ type: "turn" as const, turnId: "turn-1" }],
        status: "explicitly_open" as const,
        createdAt: 1,
      },
    ],
    turns: [
      {
        id: "turn-1",
        roomId: "room",
        interviewId: "interview",
        sequence: 1,
        question: {
          id: "question",
          text: "What is required?",
          coverageAreaId: "scope",
          kind: "primary" as const,
          reason: "Establish scope.",
          askedAt: 1,
        },
        answer: "The product must support single sign-on.",
        answerKind: "answer" as const,
        idempotencyKey: "answer",
        contextPackRevisionId: null,
        contextPackRevision: null,
        acceptedAt: 2,
      },
    ],
    corrections: [],
    searchEvidence: vi.fn(async () => [
      {
        materialId: "material",
        text: "SSO is requested.",
        locator: {
          kind: "paragraph" as const,
          label: "Paragraph 1",
          paragraph: 1,
        },
        score: 1,
      },
    ]),
    inspectEvidence,
  };
};

describe("local Project Brief Generator", () => {
  it("emits the complete localized structure and labels unsupported sections without filler", async () => {
    for (const language of ["en", "de"] as const) {
      const input = await inputFor(language);
      const draft = await localBriefGenerator.generate(input);
      expect(draft.sections.map(({ id }) => id)).toEqual(
        BRIEF_SECTION_IDS,
      );
      expect(
        draft.sections.filter(
          ({ content, items }) =>
            items.length === 0 &&
            /Not established|Nicht festgestellt/.test(content),
        ).length,
      ).toBeGreaterThan(5);
      expect(
        draft.sections
          .find(({ id }) => id === "functional-requirements")
          ?.items[0],
      ).toMatchObject({
        kind: "requirement",
        scopeStatus: "open",
        findingId: "candidate",
        sources: [{ type: "turn", turnId: "turn-1" }],
      });
    }
  });

  it("keeps open findings explicit and never promotes them into confirmed requirements", async () => {
    const draft = await localBriefGenerator.generate(
      await inputFor("en"),
    );
    expect(
      draft.sections
        .find(({ id }) => id === "gaps-and-contradictions")
        ?.items,
    ).toEqual([
      expect.objectContaining({
        kind: "gap",
        text: "Data retention is not established.",
      }),
    ]);
    expect(
      draft.sections
        .flatMap(({ items }) => items)
        .filter(({ kind }) => kind === "requirement"),
    ).toHaveLength(1);
  });

  it("uses staged retrieval with bounded inspection", async () => {
    const input = await inputFor("en");
    await localBriefGenerator.generate(input);
    expect(input.searchEvidence).toHaveBeenCalledWith(
      expect.stringMatching(/single sign-on/i),
      3,
    );
    expect(input.inspectEvidence).toHaveBeenCalledWith(
      "material",
      2_000,
    );
  });

  it("carries established success and delivery facts into their sections as Targets, not Requirements", async () => {
    const input = await inputFor("en");
    const successTurn = {
      ...input.turns[0]!,
      id: "turn-success",
      sequence: 2,
      question: {
        ...input.turns[0]!.question,
        id: "question-success",
        coverageAreaId: "success",
        text: "How will success be measured?",
      },
      answer: "Reduce support requests by 50 percent.",
    };
    const deliveryTurn = {
      ...input.turns[0]!,
      id: "turn-delivery",
      sequence: 3,
      question: {
        ...input.turns[0]!.question,
        id: "question-delivery",
        coverageAreaId: "delivery",
        text: "How should feedback work?",
      },
      answer: "The Client product owner provides weekly feedback.",
    };
    input.turns.push(successTurn, deliveryTurn);
    input.plan.coverageAreas.find(
      ({ id }) => id === "success",
    )!.evidence = [{ type: "turn", turnId: successTurn.id }];
    input.plan.coverageAreas.find(
      ({ id }) => id === "delivery",
    )!.evidence = [{ type: "turn", turnId: deliveryTurn.id }];

    const draft = await localBriefGenerator.generate(input);

    expect(
      draft.sections.find(({ id }) => id === "goals-and-success")
        ?.content,
    ).toMatch(/50 percent/i);
    expect(
      draft.sections.find(({ id }) => id === "users-and-stakeholders")
        ?.content,
    ).toMatch(/weekly feedback/i);
    expect(
      draft.sections.find(({ id }) => id === "delivery-and-commercial")
        ?.content,
    ).toBe("Not established");
    expect(
      draft.sections.find(
        ({ id }) => id === "targets-and-external-constraints",
      )?.items,
    ).toEqual([
      expect.objectContaining({
        kind: "target",
        text: "Reduce support requests by 50 percent.",
        sources: [{ type: "turn", turnId: "turn-success" }],
      }),
    ]);
  });
});
