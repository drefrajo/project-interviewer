import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DocumentFeedback,
  SubmissionFeedback,
} from "./interview-feedback";

const convex = vi.hoisted(() => ({
  useMutation: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock("convex/react", () => convex);

const record = vi.fn(async () => null);

describe("Creator interview feedback", () => {
  beforeEach(() => {
    record.mockClear();
    convex.useMutation.mockReturnValue(record);
    convex.useQuery.mockReturnValue(undefined);
  });

  it("disables document rating until the query resolves", () => {
    render(<DocumentFeedback interviewId="i1" language="en" />);

    expect(screen.getByRole("button", { name: "Helpful" })).toBeDisabled();
    expect(
      screen.queryByRole("status", { name: /Thanks/ }),
    ).not.toBeInTheDocument();
  });

  it("records a one-tap Project Document rating and confirms it", async () => {
    const user = userEvent.setup();
    convex.useQuery.mockReturnValue([]);
    const { rerender } = render(
      <DocumentFeedback interviewId="i1" language="en" />,
    );

    await user.click(screen.getByRole("button", { name: "Helpful" }));
    expect(record).toHaveBeenCalledWith({
      interviewId: "i1",
      target: "project_document",
      rating: "up",
    });

    convex.useQuery.mockReturnValue([
      {
        target: "project_document",
        rating: "up",
        createdAt: 1,
      },
    ]);
    rerender(<DocumentFeedback interviewId="i1" language="en" />);

    expect(screen.getByRole("button", { name: "Helpful" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("status")).toHaveTextContent(/Thanks/);
  });

  it("asks whether the submission saved time and collects an optional note", async () => {
    const user = userEvent.setup();
    convex.useQuery.mockReturnValue([]);
    render(<SubmissionFeedback interviewId="i2" language="en" />);

    expect(
      screen.getByRole("heading", { name: "Two quick questions" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Was this Project Document helpful?"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Did this Project Submission save you time?"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Not really/ }));
    expect(record).toHaveBeenCalledWith({
      interviewId: "i2",
      target: "project_submission",
      rating: "down",
    });
  });

  it("saves an explanatory note for a negative submission rating", async () => {
    const user = userEvent.setup();
    convex.useQuery.mockReturnValue([
      {
        target: "project_submission",
        rating: "down",
        createdAt: 2,
      },
    ]);
    render(<SubmissionFeedback interviewId="i2" language="en" />);

    await user.type(
      screen.getByPlaceholderText("What worked, what didn't? (optional)"),
      "Copy was too generic.",
    );
    await user.click(screen.getByRole("button", { name: "Save note" }));

    expect(record).toHaveBeenCalledWith({
      interviewId: "i2",
      target: "project_submission",
      rating: "down",
      comment: "Copy was too generic.",
    });
  });

  it("queries feedback for the owning Creator only", () => {
    render(<DocumentFeedback interviewId="i3" language="de" />);
    const [reference] = convex.useQuery.mock.calls[0]!;
    expect(getFunctionName(reference)).toBe("feedback:getForInterview");
  });
});
