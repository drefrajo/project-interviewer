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
            contactEmail: "creator@example.test",
            privacyPolicyUrl: "https://creator.example/privacy",
          },
          creatorIdentityReady: true,
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
    expect(screen.getByRole("link", { name: "creator@example.test" })).toHaveAttribute(
      "href",
      "mailto:creator@example.test",
    );
    expect(screen.getByRole("link", { name: "Creator privacy policy" })).toHaveAttribute(
      "href",
      "https://creator.example/privacy",
    );
    expect(
      screen.getByText(
        "External providers are used for AI functionality.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("You are interacting with an AI assistant, not a human interviewer."),
    ).toBeInTheDocument();
    expect(screen.getByText(/All Interviews are deleted after 24 months/)).toBeInTheDocument();
    expect(screen.queryByText(/12 months/)).not.toBeInTheDocument();
  });

  it.each(["en", "de"] as const)("blocks start without a public identity in %s", (clientLanguage) => {
    render(
      <WelcomeStep
        interview={{
          interviewId: "interview_1",
          projectName: "Website",
          creator: null,
          creatorIdentityReady: false,
          clientLanguage,
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

    expect(screen.getByRole("button", { name: /start|starten/i })).toBeDisabled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
