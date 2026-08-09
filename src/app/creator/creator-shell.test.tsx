import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductionAuthClient } from "../../infrastructure/auth-client";
import { CreatorShell } from "./creator-shell";

const convex = vi.hoisted(() => ({
  useAction: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock("convex/react", () => convex);

const currentProfile = {
  displayName: "Creator",
  email: "creator@example.com",
  contactEmail: "hello@example.com",
  privacyPolicyUrl: "https://example.com/privacy",
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

describe("Creator legal acceptance gate", () => {
  beforeEach(() => {
    convex.useQuery.mockImplementation((reference, args) => {
      if (args === "skip") return undefined;
      return getFunctionName(reference) === "creator_profiles:getCurrent"
        ? currentProfile
        : {
            availablePasses: 1,
            reservedPasses: 0,
            introductoryPasses: 1,
            purchasedPasses: 0,
          };
    });
  });

  it("keeps the continue button disabled until the required checkbox is checked", async () => {
    const getLegalStatus = vi.fn(async () => currentVersions);
    const acceptCurrentLegal = vi.fn(async () => ({
      ...currentVersions,
      accepted: true,
    }));
    convex.useAction.mockImplementation((reference) =>
      getFunctionName(reference) === "legal:getStatus"
        ? getLegalStatus
        : acceptCurrentLegal,
    );

    render(
      <MemoryRouter>
        <CreatorShell authClient={authClient} />
      </MemoryRouter>,
    );

    const checkbox = await screen.findByRole("checkbox");
    const continueButton = screen.getByRole("button", {
      name: "Agree and continue",
    });
    expect(checkbox).not.toBeChecked();
    expect(continueButton).toBeDisabled();
    expect(screen.getByRole("link", { name: /^Terms/ })).toHaveAttribute(
      "href",
      "https://drefrajo.dev/en/terms",
    );
    expect(
      screen.getByRole("link", { name: /^Data Processing Agreement/ }),
    ).toHaveAttribute(
      "href",
      "https://drefrajo.dev/en/dpa",
    );

    await userEvent.click(checkbox);
    expect(continueButton).toBeEnabled();
    await userEvent.click(continueButton);
    await waitFor(() => expect(acceptCurrentLegal).toHaveBeenCalledWith({}));
  });
});
