import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConceptsStep } from "./concepts-step";

const readyConcepts = [
  { id: "concept_1", name: "One", state: "ready" as const },
  { id: "concept_2", name: "Two", state: "ready" as const },
  { id: "concept_3", name: "Three", state: "ready" as const },
];

describe("ConceptsStep", () => {
  it("shows three image-card skeletons while concepts are generated", () => {
    render(
      <ConceptsStep
        additionalConceptsUsed={false}
        concepts={[]}
        generationPhase="planning"
        language="de"
        onMoreOptions={async () => true}
        onRetryMoreOptions={async () => true}
        onRetryFirstOptions={async () => true}
        onSubmit={vi.fn()}
        pending
      />,
    );

    expect(screen.getAllByTestId("concept-skeleton")).toHaveLength(3);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Drei Konzeptbilder werden geplant…");
    expect(status).toBeVisible();
  });

  it("shows when the image models are creating the concepts", () => {
    render(
      <ConceptsStep
        additionalConceptsUsed={false}
        concepts={[]}
        generationPhase="creating"
        language="en"
        onMoreOptions={async () => true}
        onRetryMoreOptions={async () => true}
        onRetryFirstOptions={async () => true}
        onSubmit={vi.fn()}
        pending
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Creating three concept images…",
    );
  });

  it("shows three more skeletons while additional concepts are generated", () => {
    render(
      <ConceptsStep
        additionalConceptsUsed
        concepts={readyConcepts}
        generationPhase="creating"
        language="en"
        onMoreOptions={async () => true}
        onRetryMoreOptions={async () => true}
        onRetryFirstOptions={async () => true}
        onSubmit={vi.fn()}
        pending
      />,
    );

    expect(screen.getAllByTestId("concept-skeleton")).toHaveLength(3);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Creating three concept images…",
    );
  });

  it("does not show the generation notice during final submission", () => {
    render(
      <ConceptsStep
        additionalConceptsUsed={false}
        concepts={readyConcepts}
        language="en"
        onMoreOptions={async () => true}
        onRetryMoreOptions={async () => true}
        onRetryFirstOptions={async () => true}
        onSubmit={vi.fn()}
        pending
      />,
    );

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("offers one low-emphasis request for three more concepts", async () => {
    const user = userEvent.setup();
    const onMoreOptions = vi.fn(async () => true);
    render(
      <ConceptsStep
        additionalConceptsUsed={false}
        concepts={readyConcepts}
        language="en"
        onMoreOptions={onMoreOptions}
        onRetryMoreOptions={async () => true}
        onRetryFirstOptions={async () => true}
        onSubmit={vi.fn()}
        pending={false}
      />,
    );

    await user.click(screen.getByTestId("request-more-concepts"));

    expect(onMoreOptions).toHaveBeenCalledOnce();
  });

  it("does not show more options after a concept is selected", async () => {
    const user = userEvent.setup();
    render(
      <ConceptsStep
        additionalConceptsUsed={false}
        concepts={readyConcepts}
        language="en"
        onMoreOptions={async () => true}
        onRetryMoreOptions={async () => true}
        onRetryFirstOptions={async () => true}
        onSubmit={vi.fn()}
        pending={false}
      />,
    );

    await user.click(screen.getAllByRole("radio")[0]!);

    expect(screen.queryByTestId("request-more-concepts")).not.toBeInTheDocument();
  });

  it("does not show more options after they were already used", () => {
    render(
      <ConceptsStep
        additionalConceptsUsed
        concepts={readyConcepts}
        language="en"
        onMoreOptions={async () => true}
        onRetryMoreOptions={async () => true}
        onRetryFirstOptions={async () => true}
        onSubmit={vi.fn()}
        pending={false}
      />,
    );

    expect(screen.queryByTestId("request-more-concepts")).not.toBeInTheDocument();
  });

  it("offers a temporary retry for only the second concept batch", async () => {
    const user = userEvent.setup();
    const onRetryMoreOptions = vi.fn(async () => true);
    render(
      <ConceptsStep
        additionalConceptsUsed
        concepts={[
          ...readyConcepts,
          { id: "concept_4", name: "Four", state: "ready" as const },
          { id: "concept_5", name: "Five", state: "ready" as const },
          { id: "concept_6", name: "Six", state: "ready" as const },
        ]}
        language="en"
        onMoreOptions={async () => true}
        onRetryMoreOptions={onRetryMoreOptions}
        onRetryFirstOptions={async () => true}
        onSubmit={vi.fn()}
        pending={false}
      />,
    );

    await user.click(screen.getByTestId("retry-second-concept-batch"));

    expect(onRetryMoreOptions).toHaveBeenCalledOnce();
  });

  it("offers a temporary retry for only the first concept batch", async () => {
    const user = userEvent.setup();
    const onRetryFirstOptions = vi.fn(async () => true);
    render(
      <ConceptsStep
        additionalConceptsUsed
        concepts={[
          ...readyConcepts,
          { id: "concept_4", name: "Four", state: "ready" as const },
          { id: "concept_5", name: "Five", state: "ready" as const },
          { id: "concept_6", name: "Six", state: "ready" as const },
        ]}
        language="en"
        onMoreOptions={async () => true}
        onRetryMoreOptions={async () => true}
        onRetryFirstOptions={onRetryFirstOptions}
        onSubmit={vi.fn()}
        pending={false}
      />,
    );

    await user.click(screen.getByTestId("retry-first-concept-batch"));

    expect(onRetryFirstOptions).toHaveBeenCalledOnce();
  });
});
