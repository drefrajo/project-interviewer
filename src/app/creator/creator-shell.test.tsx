import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductionAuthClient } from "../../infrastructure/auth-client";
import { CreatorShell } from "./creator-shell";

const convex = vi.hoisted(() => ({
  useAction: vi.fn(),
  useMutation: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock("convex/react", () => convex);

const currentProfile = {
  displayName: "Creator",
  email: "creator@example.com",
  language: "en" as const,
};

const currentVersions = {
  accepted: false,
  terms: { version: 1, sha256: "a".repeat(64) },
  dpa: { version: 1, sha256: "b".repeat(64) },
};

const authClient = {
  signOut: vi.fn(async () => undefined),
} as unknown as ProductionAuthClient;

describe("Creator onboarding", () => {
  const getLegalStatus = vi.fn(async () => currentVersions);
  const acceptCurrentLegal = vi.fn(async () => ({
    ...currentVersions,
    accepted: true,
  }));
  const updateSettings = vi.fn(async () => null);
  const createCheckout = vi.fn(async () => ({
    purchaseId: "purchase-1",
    url: "https://checkout.example.test",
  }));

  beforeEach(() => {
    vi.clearAllMocks();
    convex.useQuery.mockImplementation((reference, args) => {
      if (args === "skip") return undefined;
      const functionName = getFunctionName(reference);
      if (functionName === "creator_profiles:getCurrent") return currentProfile;
      if (functionName === "billing:getCatalog") {
        return [
          { packId: "one_pass", passCount: 1, amountMinor: 3100, currency: "eur" },
          { packId: "five_passes", passCount: 5, amountMinor: 12300, currency: "eur" },
        ];
      }
      return {
        availablePasses: 1,
        reservedPasses: 0,
        introductoryPasses: 1,
        purchasedPasses: 0,
      };
    });
    convex.useAction.mockImplementation((reference) => {
      const functionName = getFunctionName(reference);
      if (functionName === "legal:getStatus") return getLegalStatus;
      if (functionName === "legal:acceptCurrent") return acceptCurrentLegal;
      return createCheckout;
    });
    convex.useMutation.mockReturnValue(updateSettings);
  });

  const renderShell = () =>
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<CreatorShell authClient={authClient} />}>
            <Route element={<div>Interviews overview</div>} path="*" />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

  it("walks a new Creator from welcome through profile and passes", async () => {
    const user = userEvent.setup();
    renderShell();

    expect(await screen.findByRole("heading", { name: "Welcome to Interview" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Let's get started" }));
    expect(screen.getByRole("heading", { name: "A quick look at the terms" })).toBeInTheDocument();
    const agree = screen.getByRole("button", { name: "Agree and continue" });
    expect(agree).toBeDisabled();
    expect(screen.getByRole("link", { name: /^Terms/ })).toHaveAttribute(
      "href",
      "https://drefrajo.dev/en/terms",
    );

    await user.click(screen.getByRole("checkbox"));
    await user.click(agree);
    expect(
      await screen.findByRole("heading", { name: "What should Clients see?" }),
    ).toBeInTheDocument();

    expect(screen.getByRole("textbox", { name: /^Client-displayed email/ })).toHaveValue(
      "creator@example.com",
    );
    expect(
      screen.getByRole("textbox", { name: /^Privacy-policy URL \(optional\)/ }),
    ).not.toBeRequired();

    await user.click(screen.getByRole("button", { name: "Save and continue" }));
    await waitFor(() =>
      expect(updateSettings).toHaveBeenCalledWith({
        displayName: "Creator",
        contactEmail: "creator@example.com",
        language: "en",
        contentAnalysisOptIn: false,
      }),
    );
    expect(
      await screen.findByRole("heading", { name: "Your first Interview is free" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buy for €31" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buy for €123" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Get started" }));
    expect(await screen.findByText("Interviews overview")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Your first Interview is free" })).not.toBeInTheDocument();
  });
});
