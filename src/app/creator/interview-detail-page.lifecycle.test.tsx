import { render, screen } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const convex = vi.hoisted(() => ({
  useAction: vi.fn(),
  useMutation: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock("convex/react", () => convex);

import { InterviewDetailPage } from "./interview-detail-page";

const balance = {
  availablePasses: 1,
  reservedPasses: 0,
  introductoryPasses: 1,
  purchasedPasses: 0,
};

const baseInterview = {
  _id: "interview-1",
  projectName: "Sample project",
  clientLanguage: "en",
  interviewKind: "website",
  includesVisualConcepts: true,
  interviewModel: "gpt-6.1-sol",
  status: "not_started",
  step: "interview",
  passState: "reserved",
  instructions: "Do the thing.",
  interviewUrl: "http://localhost:5173/i/token",
  configurationFrozen: false,
  retentionExpiresAt: 1850000000000,
};

const transcriptEntry = { id: "m1", role: "client", content: "Hello there." };

const renderDetail = () =>
  render(
    <MemoryRouter initialEntries={["/interviews/interview-1"]}>
      <Routes>
        <Route path="/interviews/:interviewId" element={<InterviewDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe("Creator Interview detail lifecycle", () => {
  beforeEach(() => {
    convex.useAction.mockReturnValue(vi.fn());
    convex.useMutation.mockReturnValue(vi.fn());
  });

  const mockData = ({
    interview,
    transcript,
  }: {
    interview: Record<string, unknown> | null;
    transcript?: Array<Record<string, unknown>>;
  }) => {
    convex.useQuery.mockImplementation((reference) => {
      const name = getFunctionName(reference);
      if (name === "interviews:get") return interview;
      if (name === "transcripts:listForCreator") return transcript ?? [];
      if (name === "billing:getBalance") return balance;
      return undefined;
    });
  };

  it("shows the lifecycle badge in the header and emphasizes the link while preparing to share", () => {
    mockData({ interview: baseInterview, transcript: [] });
    renderDetail();

    const readyBadge = screen.getByText("Ready");
    expect(readyBadge).toHaveClass("bg-soft", "text-muted");

    const headingOrder = screen
      .getAllByRole("heading")
      .map((heading) => heading.textContent);
    expect(headingOrder.indexOf("Interview Link")).toBeLessThan(
      headingOrder.indexOf("Handoff artifacts"),
    );

    expect(
      screen.getByRole("button", { name: "Regenerate link" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Deactivate link" }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: "Export everything (ZIP)" }),
    ).toBeDisabled();
    expect(
      screen.queryByText("Interview Transcript"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Data retention: permanent deletion on/),
    ).toBeInTheDocument();
  });

  it("flags a missing pass reservation with the warning badge and reserve action", () => {
    mockData({ interview: { ...baseInterview, passState: "unreserved" } });
    renderDetail();

    const badge = screen.getByText("Needs pass reservation");
    expect(badge).toHaveClass("bg-error-surface", "text-error-text");
    expect(
      screen.getByRole("button", { name: "Reserve 1 pass and copy link" }),
    ).toBeInTheDocument();
  });

  it("leads with the handoff artifacts after submission and demotes the link", () => {
    mockData({
      interview: {
        ...baseInterview,
        status: "submitted",
        step: "submitted",
        passState: "consumed",
        configurationFrozen: true,
        projectDocument: "# Sample document",
      },
      transcript: [transcriptEntry],
    });
    renderDetail();

    const submittedBadge = screen.getByText("Submitted");
    expect(submittedBadge).toHaveClass("bg-lime", "text-forest");

    const headingOrder = screen
      .getAllByRole("heading")
      .map((heading) => heading.textContent);
    expect(headingOrder.indexOf("Handoff artifacts")).toBeLessThan(
      headingOrder.indexOf("Interview Link"),
    );

    const linkSection = screen
      .getByRole("heading", { name: "Interview Link" })
      .closest("section");
    expect(linkSection).not.toHaveClass("border-forest/30");

    expect(
      screen.getByRole("button", { name: "Export everything (ZIP)" }),
    ).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Deactivate link" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Interview Transcript")).toBeInTheDocument();
  });

  it("keeps the working status above the link while the Client is still working", () => {
    mockData({
      interview: {
        ...baseInterview,
        status: "in_progress",
        step: "review",
        passState: "consumed",
        configurationFrozen: true,
        operation: { state: "pending" },
      },
    });
    renderDetail();

    const statusRegion = screen.getByText("Working").closest("div");
    const linkHeading = screen.getByRole("heading", { name: "Interview Link" });
    expect(statusRegion).not.toBeNull();
    if (!statusRegion) return;
    expect(
      statusRegion.compareDocumentPosition(linkHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText("Document Review")).toBeInTheDocument();
  });

  it("keeps the retention note as a collapsed footnote", () => {
    mockData({ interview: baseInterview, transcript: [] });
    renderDetail();

    const note = screen
      .getByText(/Data retention: permanent deletion on/)
      .closest("details");
    expect(note).not.toBeNull();
    expect(note).not.toHaveAttribute("open");
  });
});
