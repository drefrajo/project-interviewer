import { describe, expect, it } from "vitest";
import {
  resolveInterviewConfiguration,
  type InterviewKindFields,
} from "./interview_kind";

describe("Interview Kind compatibility", () => {
  it("resolves legacy rows to the original website flow", () => {
    expect(resolveInterviewConfiguration({})).toEqual({
      interviewKind: "website",
      includesVisualConcepts: true,
    });
  });

  it.each<readonly [InterviewKindFields, boolean]>([
    [{ interviewKind: "website", includesVisualConcepts: true }, true],
    [{ interviewKind: "privacy", includesVisualConcepts: false }, true],
    [{ interviewKind: "custom", includesVisualConcepts: false }, true],
    [{ interviewKind: "custom", includesVisualConcepts: true }, true],
  ])("accepts valid concrete configuration %#", (fields, expected) => {
    expect(() => resolveInterviewConfiguration(fields)).not.toThrow();
    expect(Boolean(resolveInterviewConfiguration(fields))).toBe(expected);
  });

  it("rejects impossible website and privacy combinations", () => {
    expect(() =>
      resolveInterviewConfiguration({
        interviewKind: "website",
        includesVisualConcepts: false,
      }),
    ).toThrow("Website Interviews must include Visual Concepts.");
    expect(() =>
      resolveInterviewConfiguration({
        interviewKind: "privacy",
        includesVisualConcepts: true,
      }),
    ).toThrow("Privacy Interviews cannot include Visual Concepts.");
  });

  it("defaults new custom configuration to document-only while allowing either mode", () => {
    expect(resolveInterviewConfiguration({ interviewKind: "custom" })).toEqual({
      interviewKind: "custom",
      includesVisualConcepts: false,
    });
    expect(
      resolveInterviewConfiguration({
        interviewKind: "custom",
        includesVisualConcepts: true,
      }),
    ).toEqual({ interviewKind: "custom", includesVisualConcepts: true });
  });
});
