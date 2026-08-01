import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OperationFeedback } from "./operation-feedback";

describe("OperationFeedback", () => {
  it("can defer pending feedback to an in-context skeleton", () => {
    render(
      <OperationFeedback
        hidePending
        language="de"
        operation={{ state: "pending" }}
      />,
    );

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("does not expose internal error identifiers", () => {
    render(
      <OperationFeedback
        language="en"
        operation={{ state: "failed", message: "INTERVIEW_PLAN_INVALID" }}
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(
      "This step could not be completed.",
    );
    expect(alert).not.toHaveTextContent(
      "INTERVIEW_PLAN_INVALID",
    );
    expect(alert).toHaveClass("mx-auto", "mt-4", "w-full", "max-w-3xl");
  });

  it("does not expose the default JavaScript Error name", () => {
    render(
      <OperationFeedback
        language="de"
        operation={{ state: "failed", message: "Error" }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Dieser Schritt konnte nicht abgeschlossen werden.",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent("Error");
  });
});
