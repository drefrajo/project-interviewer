import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TemplatesPage } from "./templates-page";

const convex = vi.hoisted(() => ({
  useMutation: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock("convex/react", () => convex);

describe("TemplatesPage", () => {
  beforeEach(() => {
    convex.useQuery.mockReturnValue([
      {
        _id: "persisted-built-in",
        builtInKey: "single-page-business",
        kind: "built_in",
        name: "Single-page business website",
        sourceLanguage: "de",
        instructions: "Stale persisted instructions",
      },
    ]);
    convex.useMutation.mockReturnValue(vi.fn(async () => null));
  });

  it("renders current Built-in Interview Templates without backend rows", () => {
    render(<TemplatesPage />);

    expect(screen.getAllByRole("heading", { name: "Website" })).toHaveLength(2);
    expect(screen.getAllByRole("heading", { name: "Privacy data mapping" })).toHaveLength(1);
    expect(screen.getAllByRole("heading", { name: "Custom interview" })).toHaveLength(1);
    expect(
      screen.getByText(/Use for new websites, redesigns/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Use to map an organization's data flows/),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Visual Concepts: included/)).toHaveLength(2);
    expect(screen.getAllByText(/Visual Concepts: not included/)).toHaveLength(2);
    expect(
      screen.getByText("No Private Interview Templates yet."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Stale persisted instructions"),
    ).not.toBeInTheDocument();
  });

  it("saves private kind, description, and fixed concept setting", async () => {
    const user = userEvent.setup();
    const create = vi.fn(async () => "template_1");
    convex.useMutation.mockImplementation((reference) =>
      getFunctionName(reference) === "templates:create"
        ? create
        : vi.fn(async () => null),
    );
    render(<TemplatesPage />);

    await user.click(screen.getByRole("button", { name: "New Private Template" }));
    expect(screen.getByRole("textbox", { name: "Interview Instructions" })).toHaveClass(
      "font-normal",
    );
    await user.type(screen.getByRole("textbox", { name: "Template name" }), "Privacy template");
    await user.type(
      screen.getByRole("textbox", { name: "When to use this template (optional)" }),
      "Use for processor and retention mapping.",
    );
    await user.type(
      screen.getByRole("textbox", { name: "Interview Instructions" }),
      "Ask about data categories and systems.",
    );
    await user.click(screen.getByDisplayValue("privacy"));
    await user.click(screen.getByRole("button", { name: "Save template" }));

    expect(create).toHaveBeenCalledWith({
      name: "Privacy template",
      sourceLanguage: "en",
      instructions: "Ask about data categories and systems.",
      interviewKind: "privacy",
      includesVisualConcepts: false,
      description: "Use for processor and retention mapping.",
    });
  });
});
