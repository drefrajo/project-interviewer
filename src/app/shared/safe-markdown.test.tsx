import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SafeMarkdown } from "./safe-markdown";

describe("SafeMarkdown", () => {
  it("renders useful Markdown while containing active and remote content", () => {
    const { container } = render(
      <SafeMarkdown
        markdown={[
          "# Project Document",
          "",
          '<script>alert("unsafe")</script>',
          "",
          "[safe](https://example.com/reference)",
          "",
          "[unsafe](javascript:alert('unsafe'))",
          "",
          "![tracking pixel](https://tracker.example/pixel.png)",
        ].join("\n")}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Project Document" }),
    ).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("link", { name: "safe" })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
    expect(screen.getByRole("link", { name: "safe" })).toHaveAttribute(
      "referrerpolicy",
      "no-referrer",
    );
    expect(
      screen.queryByRole("link", { name: "unsafe" }),
    ).not.toBeInTheDocument();
  });
});

