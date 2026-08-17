import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DocumentReviewStep } from "./document-review-step";

const renderReview = (pending = false, onContinue = vi.fn()) =>
  render(
    <DocumentReviewStep
      language="en"
      markdown="# Project Document"
      onContinue={onContinue}
      onRequestChanges={async () => true}
      pending={pending}
    />,
  );

describe("DocumentReviewStep", () => {
  it("uses the softer change prompt and a floating composer", () => {
    renderReview();

    expect(screen.getByText("Should anything be changed?")).toBeInTheDocument();
    expect(screen.getByTestId("document-review-composer")).toHaveClass(
      "sticky",
      "bottom-4",
    );
  });

  it("overlays working feedback on the change input while pending", () => {
    renderReview(true);

    expect(screen.getByTestId("document-review-working")).toHaveTextContent(
      "Working on the Project Document",
    );
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("confirms before leaving Project Document review", async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    renderReview(false, onContinue);

    await user.click(screen.getByRole("button", { name: "Continue to concepts" }));

    expect(screen.getByRole("dialog")).toHaveTextContent(
      "you cannot return to this Project Document review",
    );
    expect(onContinue).not.toHaveBeenCalled();

    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Continue",
      }),
    );

    expect(onContinue).toHaveBeenCalledOnce();
  });

  it("uses a direct submission confirmation when Visual Concepts are excluded", async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    render(
      <DocumentReviewStep
        includesVisualConcepts={false}
        language="en"
        markdown="# Project Document"
        onContinue={onContinue}
        onRequestChanges={async () => true}
        pending={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Submit Project Document" }));
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Once you submit, you cannot return",
    );
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Submit Project Document",
      }),
    );
    expect(onContinue).toHaveBeenCalledOnce();
  });
});
