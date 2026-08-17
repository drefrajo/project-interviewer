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

  it("keeps the Creator contact available when no privacy policy was provided", () => {
    render(
      <SubmittedStep
        interview={{
          interviewId: "interview_1",
          projectName: "Website",
          creator: {
            displayName: "Creator",
            contactEmail: "creator@example.test",
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

    expect(screen.getByRole("link", { name: "creator@example.test" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Creator privacy policy" })).not.toBeInTheDocument();
  });

  it("omits Visual Concepts and Visual Direction for a document-only submission", () => {
    render(
      <SubmittedStep
        interview={{
          interviewId: "interview_1",
          projectName: "Privacy mapping",
          creator: null,
          creatorIdentityReady: false,
          clientLanguage: "en",
          modelFamily: "GPT-5.6 Terra",
          temporaryConceptBatchRetriesEnabled: false,
          interviewKind: "privacy",
          includesVisualConcepts: false,
          step: "submitted",
          started: true,
          reservationRequired: false,
          passState: "consumed",
          projectDocument: "# Privacy data map",
          concepts: [{ id: "concept_1", name: "Should be hidden" }],
          visualDirection: { kind: "inspiration_links", inspirationLinks: [] },
        }}
      />,
    );

    expect(screen.getByText("Privacy data map")).toBeInTheDocument();
    expect(screen.queryByText("Visual Concepts")).not.toBeInTheDocument();
    expect(screen.queryByText("Visual Direction")).not.toBeInTheDocument();
    expect(screen.queryByText("Should be hidden")).not.toBeInTheDocument();
  });
});
