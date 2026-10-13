import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(
    (reference: Parameters<typeof getFunctionName>[0]) => {
      void reference;
      return vi.fn();
    },
  ),
}));

vi.mock("convex/react", () => mocks);
vi.mock("react-router-dom", () => ({
  useParams: () => ({ interviewToken: "unactivated-token" }),
}));

import { ClientInterviewPage } from "./client-interview-page";

describe("Client Interview reservation gate", () => {
  it("does not imply that a permanently deleted Interview is recoverable", () => {
    mocks.useQuery.mockReturnValue(null);

    render(<ClientInterviewPage />);

    expect(screen.getByText(/cannot be restored/i)).toBeInTheDocument();
  });

  it.each([
    ["en", "This Interview is waiting for a pass reservation"],
    ["de", "Dieses Interview wartet auf eine Pass-Reservierung"],
  ] as const)("blocks the workflow in %s", (language, title) => {
    mocks.useQuery.mockImplementation((_reference, args) =>
      args === "skip"
        ? undefined
        : {
            interviewId: "interview_1",
            projectName: "Portfolio",
            creator: {
              displayName: "Creator",
              contactEmail: "creator@example.test",
              privacyPolicyUrl: "https://creator.example/privacy",
            },
            creatorIdentityReady: true,
            clientLanguage: language,
            modelFamily: "GPT-6.1 Sol",
            temporaryConceptBatchRetriesEnabled: false,
            step: "interview",
            started: false,
            reservationRequired: true,
          },
    );

    render(<ClientInterviewPage />);

    expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start|starten/i })).not.toBeInTheDocument();
  });

  it("omits the Concepts step and submits directly from document review", async () => {
    const user = userEvent.setup();
    const submit = vi.fn(async () => null);
    const view = {
      interviewId: "interview_1",
      projectName: "Privacy mapping",
      creator: {
        displayName: "Creator",
        contactEmail: "creator@example.test",
      },
      creatorIdentityReady: true,
      clientLanguage: "en" as const,
      modelFamily: "GPT-6.1 Sol",
      temporaryConceptBatchRetriesEnabled: false,
      interviewKind: "privacy" as const,
      includesVisualConcepts: false,
      step: "review" as const,
      started: true,
      reservationRequired: false,
      passState: "consumed" as const,
      projectDocument: "# Privacy data map",
    };
    mocks.useQuery.mockImplementation((_reference, args) =>
      args === "skip" ? undefined : view,
    );
    mocks.useMutation.mockImplementation((reference: Parameters<typeof getFunctionName>[0]) =>
      getFunctionName(reference) === "client:submit" ? submit : vi.fn(),
    );

    render(<ClientInterviewPage />);

    expect(screen.queryByText("Concepts")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Submit Project Document" }));
    const dialog = screen.getByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Submit Project Document" }),
    );

    expect(submit).toHaveBeenCalledWith({ token: "unactivated-token" });
  });

  it("sends the explicit visual confirmation only after reviewing the style", async () => {
    const user = userEvent.setup();
    const submit = vi.fn(async () => null);
    mocks.useQuery.mockImplementation((_reference, args) => args === "skip" ? undefined : {
      interviewId: "interview_1", projectName: "Site", creator: { displayName: "Creator", contactEmail: "creator@example.test" },
      creatorIdentityReady: true, clientLanguage: "en", modelFamily: "GPT-6.1 Sol", temporaryConceptBatchRetriesEnabled: false,
      interviewKind: "website", includesVisualConcepts: true, step: "concepts", started: true, reservationRequired: false,
      passState: "consumed", projectDocument: "# Content", concepts: [1, 2, 3].map((index) => ({ id: `concept_${index}`, name: `Style ${index}`, state: "ready" })),
    });
    mocks.useMutation.mockImplementation((reference) => getFunctionName(reference) === "client:submit" ? submit : vi.fn());
    render(<ClientInterviewPage />);
    await user.click(screen.getAllByRole("radio")[0]!);
    await user.type(screen.getByLabelText("What do you like and want to keep?"), "Clear type and generous space");
    await user.click(screen.getByRole("button", { name: "Nothing specific to change" }));
    await user.click(screen.getByRole("button", { name: "Review my visual direction" }));
    expect(submit).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Confirm this style and submit" }));
    expect(submit).toHaveBeenCalledWith({ token: "unactivated-token", confirmVisualDirection: true, direction: { kind: "concept", conceptId: "concept_1", preferences: { keep: "Clear type and generous space", avoid: "Nothing specific to change" } } });
  });
});
