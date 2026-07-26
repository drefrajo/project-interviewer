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
    expect(
      screen.getByText("Visuelle Entwürfe werden erstellt…"),
    ).toBeInTheDocument();
  });
});
