import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "./settings-page";

const convex = vi.hoisted(() => ({
  useAction: vi.fn(),
  useMutation: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock("convex/react", () => convex);

describe("Creator settings layout", () => {
  beforeEach(() => {
    convex.useQuery.mockReturnValue({
      displayName: "Studio Example",
      email: "creator@example.com",
    });
    convex.useMutation.mockReturnValue(vi.fn(async () => null));
    convex.useAction.mockReturnValue(vi.fn(async () => ""));
  });

  it("shows Passes before the identity settings section", () => {
    render(<SettingsPage />);

    const passesHeading = screen.getByRole("heading", { name: "Interview Passes" });
    const settingsHeading = screen.getByRole("heading", { name: "Settings" });

    expect(
      passesHeading.compareDocumentPosition(settingsHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Buy for €29" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buy for €99" })).toBeInTheDocument();
  });
});
