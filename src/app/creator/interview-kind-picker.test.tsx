import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BUILT_IN_INTERVIEW_TEMPLATES } from "../../domain/interview-templates";
import { InterviewTemplatePicker } from "./interview-kind-picker";

describe("InterviewTemplatePicker", () => {
  it("can show creator-language metadata while retaining the client source language", () => {
    const englishWebsite = BUILT_IN_INTERVIEW_TEMPLATES.find(
      (template) => template._id === "built-in:website:en",
    )!;
    const germanWebsite = BUILT_IN_INTERVIEW_TEMPLATES.find(
      (template) => template._id === "built-in:website:de",
    )!;

    render(
      <InterviewTemplatePicker
        language="de"
        legend="Vorlage"
        onSelect={() => undefined}
        selectedTemplateId={englishWebsite._id}
        sourceLabels={{ builtIn: "Integriert", private: "Privat" }}
        templates={[
          {
            ...englishWebsite,
            displayName: germanWebsite.name,
            displayDescription: germanWebsite.description,
          },
        ]}
      />,
    );

    expect(screen.getByText(germanWebsite.description)).toBeInTheDocument();
    expect(screen.getByDisplayValue(englishWebsite._id)).toBeChecked();
    expect(screen.getByText(/Integriert/)).toHaveTextContent("EN");
  });
});
