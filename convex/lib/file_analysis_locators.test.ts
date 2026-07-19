import { describe, expect, it } from "vitest";
import {
  authorizedSourceLocators,
  normalizeAuthorizedSourceLocator,
} from "./file_analysis_commit";

describe("File Analysis source locators", () => {
  it("authorizes the canonical image locator when there are no text chunks", () => {
    expect(
      authorizedSourceLocators({
        actualContentType: "image/png",
        chunks: [],
      }),
    ).toContain(JSON.stringify({ kind: "image", label: "Image 1", image: 1 }));
  });

  it("does not authorize image locators for text-only extraction", () => {
    expect(
      authorizedSourceLocators({
        actualContentType: "text/plain",
        chunks: [],
      }),
    ).not.toContain(JSON.stringify({ kind: "image", label: "Image 1", image: 1 }));
  });

  it("normalizes provider image locators to the single uploaded image", () => {
    expect(
      normalizeAuthorizedSourceLocator(
        { kind: "image", label: "Uploaded image", image: 0, page: 1 },
        { actualContentType: "image/png", chunks: [] },
      ),
    ).toEqual({ kind: "image", label: "Image 1", image: 1 });
  });

  it("rejects an image locator for a nonexistent image", () => {
    expect(
      normalizeAuthorizedSourceLocator(
        { kind: "image", label: "Image 999", image: 999 },
        { actualContentType: "image/png", chunks: [] },
      ),
    ).toBeNull();
  });

  it("maps a provider page-one reference to the single uploaded image", () => {
    expect(
      normalizeAuthorizedSourceLocator(
        { kind: "page", label: "Page 1", page: 1 },
        { actualContentType: "image/jpeg", chunks: [] },
      ),
    ).toEqual({ kind: "image", label: "Image 1", image: 1 });
  });

  it("maps zero-based page references to the single uploaded image", () => {
    expect(
      normalizeAuthorizedSourceLocator(
        { kind: "page", label: "page 0", page: 0 },
        { actualContentType: "image/webp", chunks: [] },
      ),
    ).toEqual({ kind: "image", label: "Image 1", image: 1 });
  });

  it("matches text locators by source coordinates instead of provider labels", () => {
    expect(
      normalizeAuthorizedSourceLocator(
        { kind: "page", label: "first page", page: 1 },
        {
          actualContentType: "application/pdf",
          chunks: [
            {
              text: "Project brief",
              locator: { kind: "page", label: "Page 1", page: 1 },
              embedding: Array.from({ length: 1536 }, () => 0),
            },
          ],
        },
      ),
    ).toEqual({ kind: "page", label: "Page 1", page: 1 });
  });
});
