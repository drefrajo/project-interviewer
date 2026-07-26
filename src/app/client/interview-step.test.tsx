import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { InterviewStepView } from "./interview-step";

describe("InterviewStepView", () => {
  beforeAll(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it("inserts a current suggested reply as editable text without submitting", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn(async () => true);
    render(
      <InterviewStepView
        language="en"
        messages={[
          {
            id: "assistant-1",
            role: "assistant",
            content: "What should the site help visitors do?",
            suggestedReplies: ["Request a consultation"],
          },
        ]}
        onSend={onSend}
        pending={false}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Request a consultation" }),
    );
    const composer = screen.getByRole("textbox", { name: "Your reply" });
    expect(composer).toHaveValue("Request a consultation");
    expect(onSend).not.toHaveBeenCalled();

    await user.type(composer, " online");
    expect(composer).toHaveValue("Request a consultation online");
    expect(onSend).not.toHaveBeenCalled();
  });

  it("does not project stale replies from an earlier assistant message", () => {
    render(
      <InterviewStepView
        language="en"
        messages={[
          {
            id: "assistant-1",
            role: "assistant",
            content: "What should the site do?",
            suggestedReplies: ["Request a consultation"],
          },
          { id: "client-1", role: "client", content: "Sell products" },
        ]}
        onSend={async () => true}
        pending={false}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Request a consultation" }),
    ).not.toBeInTheDocument();
  });
});
