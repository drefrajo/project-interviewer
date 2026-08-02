import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WelcomeStep } from "./welcome-step";

describe("WelcomeStep", () => {
  it("prominently identifies the inviter and shows the exact model", () => {
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
          modelFamily: "GPT-5.6 Terra",
        temporaryConceptBatchRetriesEnabled: false,
        step: "interview",
        started: false,
        reservationRequired: false,
        passState: "reserved",
      }}
        onStart={() => undefined}
        pending={false}
      />,
    );

    expect(screen.getByText("GPT-5.6 Terra")).toBeInTheDocument();
    expect(screen.getByText("You were invited by")).toBeInTheDocument();
    expect(screen.getByText("Creator")).toBeInTheDocument();
    expect(screen.getByText("creator@example.test")).toBeInTheDocument();
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
