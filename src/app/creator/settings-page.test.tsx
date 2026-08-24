import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
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
    const balance = {
      availablePasses: 1,
      reservedPasses: 0,
      introductoryPasses: 1,
      purchasedPasses: 0,
    };
    const catalog = [
      { packId: "one_pass", passCount: 1, amountMinor: 3100, currency: "eur" },
      { packId: "five_passes", passCount: 5, amountMinor: 12300, currency: "eur" },
    ];
    const profile = {
      displayName: "Studio Example",
      email: "creator@example.com",
      contactEmail: "hello@studio.example",
      privacyPolicyUrl: "https://studio.example/privacy",
      language: "en",
    };
    convex.useQuery.mockImplementation((reference) => {
      const name = getFunctionName(reference);
      if (name === "billing:getBalance") return balance;
      if (name === "billing:getCatalog") return catalog;
      if (name === "creator_profiles:getCurrent") return profile;
      return undefined;
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
    expect(screen.getByRole("textbox", { name: /Creator contact email/ })).toHaveValue(
      "hello@studio.example",
    );
    const privacyPolicy = screen.getByRole("textbox", { name: /Creator privacy-policy URL/ });
    expect(privacyPolicy).toHaveValue("https://studio.example/privacy");
    expect(privacyPolicy).not.toBeRequired();
    expect(screen.getByRole("textbox", { name: /Private OAuth sign-in email/ })).toHaveValue(
      "creator@example.com",
    );
  });

  it("starts the product-improvement opt-in from the stored choice and persists changes", async () => {
    const user = userEvent.setup();
    const update = vi.fn(async () => null);
    convex.useMutation.mockReturnValue(update);
    render(<SettingsPage />);

    const optIn = screen.getByRole("checkbox", { name: /Help improve Interview/ });
    expect(optIn).not.toBeChecked();

    await user.click(optIn);
    await user.click(screen.getByRole("button", { name: "Save settings" }));

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ contentAnalysisOptIn: true }),
    );
  });
});
