import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WelcomeStep } from "./welcome-step";

describe("WelcomeStep", () => {
  it("shows the exact model and a concise external-provider disclosure", () => {
    render(
      <WelcomeStep
        interview={{
          interviewId: "interview_1",
          projectName: "Website",
          creator: {
            displayName: "Creator",
            email: "creator@example.test",
          },
          clientLanguage: "en",
          modelFamily: "DeepSeek V4 Flash",
          temporaryConceptBatchRetriesEnabled: false,
          step: "interview",
          started: false,
        }}
        onStart={() => undefined}
        pending={false}
      />,
    );

    expect(screen.getByText("DeepSeek V4 Flash")).toBeInTheDocument();
    expect(
      screen.getByText(
        "External providers are used for AI functionality.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /privacy/i }),
    ).not.toBeInTheDocument();
  });
});
