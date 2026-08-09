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

describe("Creator Interview detail access", () => {
  const queryCalls: Array<{ name: string; args: unknown }> = [];

  beforeEach(() => {
    queryCalls.length = 0;
    convex.useAction.mockReturnValue(vi.fn());
    convex.useMutation.mockReturnValue(vi.fn());
    convex.useQuery.mockImplementation((reference, args) => {
      queryCalls.push({ name: getFunctionName(reference), args });
      return getFunctionName(reference) === "interviews:get" ? null : undefined;
    });
  });

  it("shows an unavailable state and skips the transcript for an inaccessible Interview", () => {
    render(
      <MemoryRouter initialEntries={["/interviews/not-owned"]}>
        <Routes>
          <Route path="/interviews/:interviewId" element={<InterviewDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "Interview unavailable" }),
    ).toBeInTheDocument();
    expect(
      queryCalls.find(({ name }) => name === "transcripts:listForCreator")?.args,
    ).toBe("skip");
  });
});
