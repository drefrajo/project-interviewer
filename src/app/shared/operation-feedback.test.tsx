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
});
