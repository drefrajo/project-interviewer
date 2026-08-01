import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { InterviewStepView } from "./interview-step";

describe("InterviewStepView", () => {
  beforeAll(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it("keeps scrolling on the history while the composer remains outside it", () => {
    render(
      <InterviewStepView
        language="en"
        messages={[
          {
            id: "assistant-1",
            role: "assistant",
            content: "What should the site do?",
          },
        ]}
        onRetry={async () => true}
        onSend={async () => true}
        pending={false}
      />,
    );

    expect(screen.getByTestId("interview-history")).toHaveClass(
      "overflow-y-auto",
      "overscroll-contain",
      "py-4",
      "sm:py-5",
      "-mx-4",
      "sm:-mx-8",
      "sm:[scrollbar-gutter:stable_both-edges]",
    );
    expect(screen.getByTestId("interview-shell")).not.toHaveClass(
      "max-w-3xl",
      "overflow-hidden",
    );
    expect(screen.getByTestId("interview-history-content")).toHaveClass(
      "mx-auto",
      "max-w-3xl",
    );
    expect(screen.getByTestId("interview-composer")).toHaveClass(
      "max-w-3xl",
    );
    expect(screen.getByTestId("interview-shell")).toHaveClass("gap-0");
    expect(screen.getByTestId("interview-composer")).not.toHaveClass(
      "sticky",
      "overflow-y-auto",
      "shadow-xl",
    );
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
        onRetry={async () => true}
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

  it("auto-grows the composer and caps it at fourteen lines", async () => {
    const user = userEvent.setup();
    render(
      <InterviewStepView
        language="en"
        messages={[]}
        onRetry={async () => true}
        onSend={async () => true}
        pending={false}
      />,
    );
    const composer = screen.getByRole("textbox", { name: "Your reply" });
    expect(composer).toHaveAttribute("data-max-lines", "14");
    expect(composer).toHaveStyle({ height: "112px", overflowY: "hidden" });

    Object.defineProperty(composer, "scrollHeight", {
      configurable: true,
      value: 220,
    });
    await user.type(composer, "Several lines of project context");
    expect(composer).toHaveStyle({ height: "220px", overflowY: "hidden" });

    Object.defineProperty(composer, "scrollHeight", {
      configurable: true,
      value: 500,
    });
    await user.type(composer, " and more");
    expect(composer).toHaveStyle({ height: "354px", overflowY: "auto" });
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
        onRetry={async () => true}
        onSend={async () => true}
        pending={false}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Request a consultation" }),
    ).not.toBeInTheDocument();
  });

  it("shows progressive work inside the composer while preparing the first question", () => {
    render(
      <InterviewStepView
        language="en"
        messages={[]}
        onRetry={async () => true}
        onSend={async () => true}
        pending
      />,
    );

    const status = screen.getByRole("status", {
      name: "Preparing the first question…",
    });
    expect(status.closest("form")).not.toBeNull();
    expect(status).toHaveClass("backdrop-blur-sm");
    expect(screen.getByTestId("composer-working-badge")).toHaveClass(
      "backdrop-blur-md",
    );
    expect(screen.getByRole("textbox", { name: "Your reply" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("explains when a response has been processing for more than a minute", async () => {
    vi.useFakeTimers();
    const { unmount } = render(
      <InterviewStepView
        language="en"
        messages={[]}
        onRetry={async () => true}
        onSend={async () => true}
        pending
      />,
    );

    try {
      expect(
        screen.getByRole("status", { name: "Preparing the first question…" }),
      ).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(60_000);
      });

      expect(
        screen.getByRole("status", { name: "This is taking a little longer" }),
      ).toHaveTextContent("This response needs a little more careful thought.");
    } finally {
      unmount();
      vi.useRealTimers();
    }
  });

  it("hides stale reply suggestions while preparing the next question", () => {
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
        ]}
        onRetry={async () => true}
        onSend={async () => true}
        pending
      />,
    );

    expect(
      screen.getByRole("status", { name: "Working on the next question" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Request a consultation" }),
    ).not.toBeInTheDocument();
  });

  it("explains the longer planning step after the first Client reply", () => {
    const { rerender } = render(
      <InterviewStepView
        language="en"
        messages={[
          {
            id: "assistant-1",
            role: "assistant",
            content: "What should the site do?",
          },
          { id: "client-1", role: "client", content: "Present my work." },
        ]}
        onRetry={async () => true}
        onSend={async () => true}
        pending
        planning
      />,
    );

    expect(
      screen.getByRole("status", {
        name: "Planning the interview direction",
      }),
    ).toHaveTextContent("This first step takes a little longer");

    rerender(
      <InterviewStepView
        language="en"
        messages={[
          {
            id: "assistant-1",
            role: "assistant",
            content: "What should the site do?",
          },
          { id: "client-1", role: "client", content: "Present my work." },
        ]}
        onRetry={async () => true}
        onSend={async () => true}
        pending
        planning={false}
      />,
    );

    expect(
      screen.getByRole("status", { name: "Working on the next question" }),
    ).toBeInTheDocument();
  });

  it("renders an assistant reply as one flat message container", () => {
    render(
      <InterviewStepView
        language="en"
        messages={[
          {
            id: "assistant-1",
            role: "assistant",
            content: "What should the site help visitors do?",
          },
        ]}
        onRetry={async () => true}
        onSend={async () => true}
        pending={false}
      />,
    );

    expect(
      screen
        .getByText("What should the site help visitors do?")
        .closest("[data-markdown-variant]"),
    ).toHaveAttribute("data-markdown-variant", "plain");
  });

  it("offers to retry a malformed assistant response without sending a message", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn(async () => true);
    const onSend = vi.fn(async () => true);
    render(
      <InterviewStepView
        language="en"
        messages={[
          {
            id: "assistant-malformed",
            role: "assistant",
            content:
              "This response could not be displayed because of a formatting error.",
            retryable: true,
          },
        ]}
        onRetry={onRetry}
        onSend={onSend}
        pending={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Retry response" }));

    expect(onRetry).toHaveBeenCalledOnce();
    expect(onSend).not.toHaveBeenCalled();
  });
});
