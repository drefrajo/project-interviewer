import { describe, expect, it } from "vitest";
import { buildInterviewMessages } from "./interview_messages";

describe("buildInterviewMessages", () => {
  it("adds a non-persisted user kickoff to a fresh Interview", () => {
    expect(buildInterviewMessages("Interview policy", "de", [])).toEqual([
      { role: "system", content: "Interview policy" },
      {
        role: "user",
        content: "Beginne das Interview mit deinen ersten Fragen.",
      },
    ]);
  });

  it("preserves a real transcript without adding another kickoff", () => {
    const transcript = [
      { role: "user" as const, content: "We need a new company website." },
      { role: "assistant" as const, content: "Who is it for?" },
    ];

    expect(
      buildInterviewMessages("Interview policy", "en", transcript),
    ).toEqual([{ role: "system", content: "Interview policy" }, ...transcript]);
  });
});
