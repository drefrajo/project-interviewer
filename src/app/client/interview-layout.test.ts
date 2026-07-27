import { describe, expect, it } from "vitest";
import { activeInterviewMainClassName } from "./interview-layout";

describe("active interview layout", () => {
  it("keeps the history flush with the progress bar and leaves room below the composer", () => {
    expect(activeInterviewMainClassName).not.toMatch(
      /(?:^|\s)(?:py|pt|my|mt)-/,
    );
    expect(activeInterviewMainClassName).toContain("pb-4");
    expect(activeInterviewMainClassName).toContain("sm:pb-6");
  });
});
