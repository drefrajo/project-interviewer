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
    let queryCount = 0;
    convex.useQuery.mockImplementation(() => {
      const slot = queryCount++ % 3;
      if (slot === 1) {
        return {
          availablePasses: 1,
          reservedPasses: 0,
          introductoryPasses: 1,
          purchasedPasses: 0,
        };
      }
      if (slot === 2) {
        return [
          { packId: "one_pass", passCount: 1, amountMinor: 3100, currency: "eur" },
          { packId: "five_passes", passCount: 5, amountMinor: 12300, currency: "eur" },
        ];
      }
      return {
        displayName: "Studio Example",
        email: "creator@example.com",
        language: "en",
      };
    });
    convex.useMutation.mockReturnValue(vi.fn(async () => null));
    convex.useAction.mockReturnValue(vi.fn(async () => ""));
  });

  it("shows live catalog amounts and puts Passes before identity settings", () => {
    render(<SettingsPage />);

    const passesHeading = screen.getByRole("heading", { name: "Interview Passes" });
    const settingsHeading = screen.getByRole("heading", { name: "Settings" });

    expect(
      passesHeading.compareDocumentPosition(settingsHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Buy for €31" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buy for €123" })).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveValue("en");
  });
});
