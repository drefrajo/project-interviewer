import { act, render, screen, within } from "@testing-library/react";
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

  it("still offers more options after a tentative concept selection", async () => {
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

    expect(screen.getByTestId("request-more-concepts")).toBeInTheDocument();
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

  it("separates inspiration choice and requires keep and avoid preferences", async () => {
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

    expect(screen.queryByLabelText("What do you like and want to keep?")).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("radio", {
        name: "None of these fit — use inspiration links",
      }),
    );

    expect(screen.getByRole("status")).toHaveTextContent("No visual style is agreed yet");
    const submit = screen.getByRole("button", { name: "Review my visual direction" });
    expect(submit).toBeDisabled();

    await user.type(
      screen.getByPlaceholderText("https://example.com"),
      "https://example.com",
    );
    await user.type(screen.getByLabelText("What do you like and want to keep?"), "Use the warm colours.");
    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText("What should we leave out or adjust?"), "Avoid script fonts.");

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

  it("reviews the selected image and exact preferences before an explicit style confirmation", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => undefined);
    render(<ConceptsStep concepts={readyConcepts.map((concept) => ({ ...concept, description: `Style ${concept.name}`, imageUrl: `https://example.test/${concept.id}.png` }))} language="en" onMoreOptions={async () => true} onRetryMoreOptions={async () => true} onRetryFirstOptions={async () => true} onSubmit={onSubmit} pending={false} />);
    await user.click(screen.getAllByRole("radio")[1]!);
    const review = screen.getByRole("button", { name: "Review my visual direction" });
    expect(review).toBeDisabled();
    await user.type(screen.getByLabelText("What do you like and want to keep?"), "Warm colours and clear headings");
    expect(review).toBeDisabled();
    await user.type(screen.getByLabelText("What should we leave out or adjust?"), "Avoid the sample photos");
    await user.click(review);
    const dialog = screen.getByRole("dialog", { name: "Confirm your visual style" });
    expect(within(dialog).getByRole("img", { name: "Two" })).toHaveAttribute("src", "https://example.test/concept_2.png");
    expect(dialog).toHaveTextContent("Style Two");
    expect(dialog).toHaveTextContent("Warm colours and clear headings");
    expect(dialog).toHaveTextContent("Avoid the sample photos");
    expect(dialog).toHaveTextContent("project scope");
    expect(dialog).toHaveTextContent("illustrative");
    expect(onSubmit).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Confirm this style and submit" }));
    expect(onSubmit).toHaveBeenCalledWith({ kind: "concept", conceptId: "concept_2", preferences: { keep: "Warm colours and clear headings", avoid: "Avoid the sample photos" } });
  });

  it("lets the client adjust a review and clears preferences when choosing another concept", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => undefined);
    render(<ConceptsStep concepts={readyConcepts} language="en" onMoreOptions={async () => true} onRetryMoreOptions={async () => true} onRetryFirstOptions={async () => true} onSubmit={onSubmit} pending={false} />);
    await user.click(screen.getAllByRole("radio")[0]!);
    await user.type(screen.getByLabelText("What do you like and want to keep?"), "This overall style");
    await user.click(screen.getByRole("button", { name: "Nothing specific to change" }));
    await user.click(screen.getByRole("button", { name: "Review my visual direction" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Adjust my choice" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText("What do you like and want to keep?")).toHaveValue("This overall style");
    await user.click(screen.getAllByRole("radio")[2]!);
    expect(screen.getByLabelText("What do you like and want to keep?")).toHaveValue("");
    expect(screen.getByLabelText("What should we leave out or adjust?")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Review my visual direction" })).toBeDisabled();
  });

  it("does not enable review for a failed concept even if an old image URL exists", async () => {
    const user = userEvent.setup();
    render(<ConceptsStep concepts={[{ ...readyConcepts[0]!, state: "failed", imageUrl: "https://example.test/stale.png" }, ...readyConcepts.slice(1)]} language="en" onMoreOptions={async () => true} onRetryMoreOptions={async () => true} onRetryFirstOptions={async () => true} onSubmit={vi.fn()} pending={false} />);
    expect(screen.getAllByRole("radio")[0]).toBeDisabled();
    await user.click(screen.getAllByRole("radio")[1]!);
    await user.type(screen.getByLabelText("What do you like and want to keep?"), "Readable");
    await user.click(screen.getByRole("button", { name: "Nothing specific to change" }));
    expect(screen.getByRole("button", { name: "Review my visual direction" })).toBeDisabled();
  });

  it("closes a review if its displayed concept changes before confirmation", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => undefined);
    const props = { language: "en" as const, pending: false, onMoreOptions: async () => true, onRetryMoreOptions: async () => true, onRetryFirstOptions: async () => true, onSubmit };
    const { rerender } = render(<ConceptsStep {...props} concepts={readyConcepts} />);
    await user.click(screen.getAllByRole("radio")[0]!);
    await user.type(screen.getByLabelText("What do you like and want to keep?"), "This overall style");
    await user.click(screen.getByRole("button", { name: "Nothing specific to change" }));
    await user.click(screen.getByRole("button", { name: "Review my visual direction" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    rerender(<ConceptsStep {...props} concepts={readyConcepts.map((concept) => ({ ...concept, description: "Revised description" }))} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
