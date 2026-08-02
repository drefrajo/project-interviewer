import { describe, expect, it } from "vitest";
import type { Doc } from "../_generated/dataModel";
import {
  dashboardStatus,
  interviewDto,
  MAX_SUGGESTED_REPLY_LENGTH,
  suggestedRepliesFromProvider,
} from "./domain";

describe("suggestedRepliesFromProvider", () => {
  it("normalizes at most four non-empty bounded replies", () => {
    expect(
      suggestedRepliesFromProvider([
        "  A brochure site  ",
        "An online store",
        "An online store",
      ]),
    ).toEqual(["A brochure site", "An online store"]);
  });

  it.each([
    null,
    "A brochure site",
    ["one", "two", "three", "four", "five"],
    ["valid", ""],
    ["valid", 3],
    ["x".repeat(MAX_SUGGESTED_REPLY_LENGTH + 1)],
  ])("rejects an invalid reply collection", (value) => {
    expect(suggestedRepliesFromProvider(value)).toEqual([]);
  });
});

describe("dashboardStatus", () => {
  it("keeps a committed submission submitted when background email fails", () => {
    const interview = {
      submission: { id: "submission_1" },
      operation: {
        kind: "email_notification",
        status: "failed",
        attempt: 1,
        errorCode: "EMAIL_CONFIGURATION_MISSING",
      },
    } as unknown as Doc<"interviews">;

    expect(dashboardStatus(interview)).toBe("submitted");
  });
});

it("exposes the planning boundary while the first follow-up is pending", async () => {
  const interview = {
    _id: "interview",
    projectName: "Portfolio",
    clientLanguage: "en",
    model: "gpt-5.6-terra",
    instructions: "Interview the Client.",
    step: "interview",
    frozenAt: 1,
    clientMessageCount: 1,
    concepts: [],
    operation: {
      kind: "interview_response",
      status: "running",
      attempt: 1,
    },
    createdAt: 1,
    updatedAt: 1,
  } as unknown as Doc<"interviews">;

  expect((await interviewDto(interview, async () => null)).operation).toMatchObject({
    phase: "planning",
  });
  expect(
    (
      await interviewDto(
        { ...interview, interviewPlan: "Next: confirm tone." },
        async () => null,
      )
    ).operation,
  ).toMatchObject({ phase: "responding" });
});

it("exposes the current Visual Concept generation phase", async () => {
  const interview = {
    _id: "interview",
    projectName: "Portfolio",
    clientLanguage: "en",
    model: "gpt-5.6-terra",
    instructions: "Interview the Client.",
    step: "concepts",
    frozenAt: 1,
    clientMessageCount: 3,
    concepts: [],
    operation: {
      kind: "concept_generation",
      status: "running",
      attempt: 1,
      phase: "concept_creating",
    },
    createdAt: 1,
    updatedAt: 1,
  } as unknown as Doc<"interviews">;

  expect((await interviewDto(interview, async () => null)).operation).toMatchObject({
    phase: "concept_creating",
  });
});
