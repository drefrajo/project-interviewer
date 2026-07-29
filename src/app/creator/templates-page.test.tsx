import { render, screen } from "@testing-library/react";
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

    expect(
      screen.getAllByRole("heading", {
        name: "Single-page business website",
      }),
    ).toHaveLength(2);
    expect(
      screen.getByText(/Identifiziere und bewahre zuerst jedes prägende/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/First identify and preserve any defining interaction model/),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No Private Interview Templates yet."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Stale persisted instructions"),
    ).not.toBeInTheDocument();
  });
});
