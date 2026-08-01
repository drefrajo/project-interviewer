import { describe, expect, it } from "vitest";
import { resolveInterviewTurn } from "./interview_turn";

describe("resolveInterviewTurn", () => {
  it("keeps questions and alignment checkpoints in the conversation", () => {
    expect(resolveInterviewTurn("question", false)).toBe("reply");
    expect(resolveInterviewTurn("alignment", false)).toBe("reply");
  });

  it("blocks premature completion before a separate alignment checkpoint", () => {
    expect(() => resolveInterviewTurn("ready", false)).toThrowError(
      expect.objectContaining({ name: "INTERVIEW_ALIGNMENT_REQUIRED" }),
    );
    expect(() => resolveInterviewTurn("document", false)).toThrowError(
      expect.objectContaining({ name: "INTERVIEW_ALIGNMENT_REQUIRED" }),
    );
  });

  it("allows document generation after the Client received an alignment checkpoint", () => {
    expect(resolveInterviewTurn("ready", true)).toBe("document");
    expect(resolveInterviewTurn("document", true)).toBe("document");
  });
});
