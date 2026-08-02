import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InterviewsPage } from "./interviews-page";

const convex = vi.hoisted(() => ({ useQuery: vi.fn() }));

vi.mock("convex/react", () => convex);

describe("InterviewsPage status badges", () => {
  beforeEach(() => {
    convex.useQuery.mockReturnValue([
      {
        _id: "unreserved-interview",
        projectName: "Needs reservation",
        clientLanguage: "en",
        interviewModel: "gpt-5.6-terra",
        status: "not_started",
        step: "interview",
        passState: "unreserved",
      },
      {
        _id: "reserved-interview",
        projectName: "Ready interview",
        clientLanguage: "en",
        interviewModel: "gpt-5.6-terra",
        status: "not_started",
        step: "interview",
        passState: "reserved",
      },
    ]);
  });

  it("uses the existing workflow badge for reservation readiness", () => {
    render(
      <MemoryRouter>
        <InterviewsPage />
      </MemoryRouter>,
    );

    expect(screen.getAllByText("Needs pass reservation")).toHaveLength(2);
    expect(screen.getByText("Ready")).toHaveClass("bg-forest");
    expect(screen.getByText("Ready")).not.toHaveClass("bg-lime");
    for (const openLink of screen.getAllByText("Open")) {
      expect(openLink).toHaveClass(
        "group-hover:underline",
        "group-focus-visible:underline",
      );
    }
    expect(screen.queryByText("Not started")).not.toBeInTheDocument();
  });
});
