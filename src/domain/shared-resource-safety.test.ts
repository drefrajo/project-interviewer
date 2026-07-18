import { describe, expect, it } from "vitest";
import { normalizeSafeSharedResource } from "./shared-resource-safety";

describe("Shared Resource safety", () => {
  it.each([
    "https://user:password@example.test",
    "https://example.test?access_token=secret",
    "ftp://example.test/file",
  ])("rejects unsafe URLs: %s", (url) => {
    expect(
      normalizeSafeSharedResource({ label: "Unsafe", url }),
    ).toMatchObject({ accepted: false });
  });

  it.each([
    { note: "Use token ghp_123456789012345678901234567890123456" },
    { note: "Documentation", accountIdentifier: "sk-live-1234567890abcdef" },
  ])("rejects secret-like text: %o", (fields) => {
    expect(
      normalizeSafeSharedResource({
        label: "Unsafe",
        ...fields,
      }),
    ).toMatchObject({ accepted: false });
  });

  it("normalizes a safe link and note", () => {
    expect(
      normalizeSafeSharedResource({
        label: " Docs ",
        url: " https://example.test/docs ",
        note: " Public onboarding notes ",
      }),
    ).toEqual({
      accepted: true,
      value: {
        label: "Docs",
        url: "https://example.test/docs",
        note: "Public onboarding notes",
      },
    });
  });
});
