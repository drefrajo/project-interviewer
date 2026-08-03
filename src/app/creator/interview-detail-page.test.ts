import { describe, expect, it } from "vitest";
import { shouldShowDetailStep } from "./interview-detail-page";

describe("Creator interview detail status", () => {
  it.each([
    ["not_started", false],
    ["in_progress", true],
    ["needs_attention", true],
    ["submitted", false],
  ] as const)("shows the workflow step for %s: %s", (status, expected) => {
    expect(shouldShowDetailStep(status)).toBe(expected);
  });
});
