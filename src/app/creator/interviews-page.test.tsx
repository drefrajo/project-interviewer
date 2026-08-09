import { render, screen } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InterviewsPage } from "./interviews-page";

const convex = vi.hoisted(() => ({ useQuery: vi.fn() }));

vi.mock("convex/react", () => convex);

const completeProfile = {
  displayName: "Ready Creator",
  email: "private@example.test",
  contactEmail: "hello@example.test",
  privacyPolicyUrl: "https://example.test/privacy",
};

const interviews = [
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
  {
    _id: "in-progress-interview",
    projectName: "In progress interview",
    clientLanguage: "en",
    interviewModel: "gpt-5.6-terra",
    status: "in_progress",
    step: "review",
    passState: "consumed",
  },
  {
    _id: "submitted-interview",
    projectName: "Submitted interview",
    clientLanguage: "en",
    interviewModel: "gpt-5.6-terra",
    status: "submitted",
    step: "submitted",
    passState: "consumed",
  },
];

describe("InterviewsPage status badges", () => {
  beforeEach(() => {
    convex.useQuery.mockImplementation((reference) =>
      getFunctionName(reference) === "creator_profiles:getCurrent"
        ? completeProfile
        : interviews,
    );
  });

  it("uses the existing workflow badge for reservation readiness", () => {
    render(
      <MemoryRouter>
        <InterviewsPage />
      </MemoryRouter>,
    );

    expect(screen.getAllByText("Needs pass reservation")).toHaveLength(2);
    expect(screen.getByText("Ready")).toHaveClass("bg-soft", "text-muted");
    expect(screen.getByText("Ready")).not.toHaveClass("bg-lime");
    for (const openLink of screen.getAllByText("Open")) {
      expect(openLink).toHaveClass(
        "group-hover:underline",
        "group-focus-visible:underline",
      );
    }
    expect(screen.queryByText("Not started")).not.toBeInTheDocument();
  });

  it("uses an incremental lifecycle palette", () => {
    render(
      <MemoryRouter>
        <InterviewsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Ready")).toHaveClass("bg-soft", "text-muted");
    expect(screen.getByText("In progress")).toHaveClass(
      "bg-forest",
      "text-white",
    );
    expect(screen.getByText("Submitted")).toHaveClass("bg-lime", "text-forest");
  });

  it("sends Creators with incomplete public identity to Settings", () => {
    convex.useQuery.mockImplementation((reference) =>
      getFunctionName(reference) === "creator_profiles:getCurrent"
        ? { ...completeProfile, contactEmail: undefined }
        : interviews,
    );

    render(
      <MemoryRouter>
        <InterviewsPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("link", { name: "Complete Settings" }),
    ).toHaveAttribute("href", "/settings#settings-profile");
    expect(
      screen.queryByRole("link", { name: "New Interview" }),
    ).not.toBeInTheDocument();
  });
});
