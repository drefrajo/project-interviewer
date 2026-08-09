import { describe, expect, it } from "vitest";
import {
  addUtcCalendarMonths,
  retentionExpiresAt,
  retentionWarningAt,
} from "./retention";

describe("Interview retention", () => {
  it("expires completed Interviews 24 calendar months after submission", () => {
    const submittedAt = Date.UTC(2025, 0, 31, 12);
    expect(
      retentionExpiresAt({ lastActivityAt: submittedAt, submittedAt }),
    ).toBe(Date.UTC(2027, 0, 31, 12));
  });

  it("expires incomplete Interviews 24 calendar months after last activity", () => {
    const lastActivityAt = Date.UTC(2025, 1, 28, 9, 30);
    expect(retentionExpiresAt({ lastActivityAt })).toBe(
      Date.UTC(2027, 1, 28, 9, 30),
    );
  });

  it("clamps month-end dates and warns 30 days before deletion", () => {
    const expiresAt = addUtcCalendarMonths(Date.UTC(2024, 1, 29), 24);
    expect(expiresAt).toBe(Date.UTC(2026, 1, 28));
    expect(retentionWarningAt(expiresAt)).toBe(
      expiresAt - 30 * 24 * 60 * 60 * 1000,
    );
  });
});
