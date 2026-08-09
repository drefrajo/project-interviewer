import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SubmittedStep } from "./submitted-step";

describe("SubmittedStep", () => {
  it("keeps the Creator contact and privacy policy available after submission", () => {
    render(
      <SubmittedStep
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
          step: "submitted",
          started: true,
          reservationRequired: false,
          passState: "consumed",
        }}
      />,
    );

    expect(screen.getByRole("link", { name: "creator@example.test" })).toHaveAttribute(
      "href",
      "mailto:creator@example.test",
    );
    expect(screen.getByRole("link", { name: "Creator privacy policy" })).toHaveAttribute(
      "href",
      "https://creator.example/privacy",
    );
  });
});
