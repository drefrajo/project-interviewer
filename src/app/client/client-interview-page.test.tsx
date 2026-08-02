import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => vi.fn()),
}));

vi.mock("convex/react", () => mocks);
vi.mock("react-router-dom", () => ({
  useParams: () => ({ interviewToken: "unactivated-token" }),
}));

import { ClientInterviewPage } from "./client-interview-page";

describe("Client Interview reservation gate", () => {
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
            creator: { displayName: "Creator", email: "creator@example.test" },
            clientLanguage: language,
            modelFamily: "GPT-5.6 Terra",
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
});
