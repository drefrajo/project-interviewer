import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConceptsStep } from "./concepts-step";

const readyConcepts = [
  { id: "concept_1", name: "One", state: "ready" as const },
  { id: "concept_2", name: "Two", state: "ready" as const },
  { id: "concept_3", name: "Three", state: "ready" as const },
];

describe("ConceptsStep", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows three image-card skeletons while concepts are generated", () => {
    render(
      <ConceptsStep
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

  it("adds a longer-wait notice after 20 seconds of generation", () => {
    vi.useFakeTimers();
    render(
      <ConceptsStep
        concepts={[]}
        generationPhase="planning"
        language="en"
        onMoreOptions={async () => true}
        onRetryMoreOptions={async () => true}
        onRetryFirstOptions={async () => true}
        onSubmit={vi.fn()}
        pending
      />,
    );

    expect(screen.getByRole("status")).not.toHaveTextContent(
      "This may take a while.",
    );
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "This may take a while.",
    );
  });

  it("shows three more skeletons while additional concepts are generated", () => {
    render(
      <ConceptsStep
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

  it("offers a low-emphasis request for a second batch while one batch is ready", async () => {
    const user = userEvent.setup();
    const onMoreOptions = vi.fn(async () => true);
    render(
      <ConceptsStep
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

  it("does not show more options when a second batch already exists", () => {
    render(
      <ConceptsStep
        concepts={[
          ...readyConcepts,
          { id: "concept_4", name: "Four", state: "ready" as const },
          { id: "concept_5", name: "Five", state: "ready" as const },
          { id: "concept_6", name: "Six", state: "ready" as const },
        ]}
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

  it("separates inspiration choice and requires a note for it", async () => {
    const user = userEvent.setup();
    render(
      <ConceptsStep
        concepts={readyConcepts}
        language="en"
        onMoreOptions={async () => true}
        onRetryMoreOptions={async () => true}
        onRetryFirstOptions={async () => true}
        onSubmit={vi.fn()}
        pending={false}
      />,
    );

    expect(screen.getByText("Optional note")).toBeInTheDocument();
    await user.click(
      screen.getByRole("radio", {
        name: "None of these fit — use inspiration links",
      }),
    );

    expect(screen.getByText("Required note")).toBeInTheDocument();
    const submit = screen.getByRole("button", { name: "Submit project" });
    expect(submit).toBeDisabled();

    await user.type(
      screen.getByPlaceholderText("https://example.com"),
      "https://example.com",
    );
    await user.type(screen.getByLabelText("Required note"), "Use this mood.");

    expect(submit).toBeEnabled();
  });

  it("can expose the temporary second-batch retry when enabled", async () => {
    const user = userEvent.setup();
    const onRetryMoreOptions = vi.fn(async () => true);
    render(
      <ConceptsStep
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
        temporaryConceptBatchRetriesEnabled
      />,
    );

    await user.click(screen.getByTestId("retry-second-concept-batch"));

    expect(onRetryMoreOptions).toHaveBeenCalledOnce();
  });

  it("can expose the temporary first-batch retry when enabled", async () => {
    const user = userEvent.setup();
    const onRetryFirstOptions = vi.fn(async () => true);
    render(
      <ConceptsStep
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
        temporaryConceptBatchRetriesEnabled
      />,
    );

    await user.click(screen.getByTestId("retry-first-concept-batch"));

    expect(onRetryFirstOptions).toHaveBeenCalledOnce();
  });

  it("hides temporary batch retries when disabled", () => {
    render(
      <ConceptsStep
        concepts={[
          ...readyConcepts,
          { id: "concept_4", name: "Four", state: "ready" as const },
          { id: "concept_5", name: "Five", state: "ready" as const },
          { id: "concept_6", name: "Six", state: "ready" as const },
        ]}
        language="en"
        onMoreOptions={async () => true}
        onRetryMoreOptions={async () => true}
        onRetryFirstOptions={async () => true}
        onSubmit={vi.fn()}
        pending={false}
      />,
    );

    expect(screen.queryByTestId("retry-first-concept-batch")).not.toBeInTheDocument();
    expect(screen.queryByTestId("retry-second-concept-batch")).not.toBeInTheDocument();
  });
});
