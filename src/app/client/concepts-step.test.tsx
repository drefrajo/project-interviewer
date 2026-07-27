import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConceptsStep } from "./concepts-step";

describe("ConceptsStep", () => {
  it("shows three image-card skeletons while concepts are generated", () => {
    render(
      <ConceptsStep
        concepts={[]}
        language="de"
        onSubmit={vi.fn()}
        pending
      />,
    );

    expect(screen.getAllByTestId("concept-skeleton")).toHaveLength(3);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(
      "Wir erstellen drei visuelle Konzepte. Bitte warten Sie – dies kann einen Moment dauern.",
    );
    expect(status).toBeVisible();
  });

  it("does not show the generation notice during final submission", () => {
    render(
      <ConceptsStep
        concepts={[
          { id: "concept_1", name: "One", state: "ready" },
          { id: "concept_2", name: "Two", state: "ready" },
          { id: "concept_3", name: "Three", state: "ready" },
        ]}
        language="en"
        onSubmit={vi.fn()}
        pending
      />,
    );

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
