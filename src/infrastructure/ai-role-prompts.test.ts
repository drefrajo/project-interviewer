import { describe, expect, it } from "vitest";
import { AI_ROLE_PROMPTS } from "./ai-role-prompts";

describe("developer-controlled AI role prompts", () => {
  it("keeps File Analysis descriptive, source-located, and non-prescriptive", () => {
    expect(AI_ROLE_PROMPTS.file_analyzer).toContain("fixed category");
    expect(AI_ROLE_PROMPTS.file_analyzer).toContain("exact source locator");
    expect(AI_ROLE_PROMPTS.file_analyzer).toContain("Do not resolve contradictions");
  });

  it("keeps Interview decisions evidence-backed and outside agreement authority", () => {
    expect(AI_ROLE_PROMPTS.interview_agent).toContain(
      "Candidate Requirement",
    );
    expect(AI_ROLE_PROMPTS.interview_agent).toContain(
      "Never make scope agreed",
    );
    expect(AI_ROLE_PROMPTS.interview_agent).toContain(
      "list → summary → search → bounded inspection",
    );
    expect(AI_ROLE_PROMPTS.interview_reviewer).toContain("read-only");
  });

  it("requires a natural conversation without exposing the Interview Plan", () => {
    expect(AI_ROLE_PROMPTS.interview_planner).toContain(
      "natural opening of a conversation",
    );
    expect(AI_ROLE_PROMPTS.interview_planner).toContain(
      "never as questionnaire instructions",
    );
    expect(AI_ROLE_PROMPTS.interview_agent).toContain(
      "briefly acknowledge the Client's answer",
    );
    expect(AI_ROLE_PROMPTS.interview_agent).toContain(
      "Never narrate the questionnaire",
    );
    expect(AI_ROLE_PROMPTS.interview_agent).toContain(
      "mention the Interview Plan or Coverage Areas",
    );
  });

  it("forbids invented commitments and carries the default brief contract", () => {
    expect(AI_ROLE_PROMPTS.brief_generator).toContain(
      "Never invent price, deadline, architecture, legal commitment",
    );
    expect(AI_ROLE_PROMPTS.brief_generator).toContain(
      "evidence-appendix",
    );
    expect(AI_ROLE_PROMPTS.brief_generator).toContain(
      "software-project-brief-generator-v1",
    );
  });
});
