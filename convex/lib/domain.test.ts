import { describe, expect, it } from "vitest";
import type { Doc } from "../_generated/dataModel";
import {
  dashboardStatus,
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
