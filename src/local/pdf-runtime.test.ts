import { describe, expect, it } from "vitest";
import { loadPdfJsTextRuntime } from "./pdf-runtime";

describe("PDF text runtime", () => {
  it("installs the bundled worker handler before loading PDF.js", async () => {
    Reflect.deleteProperty(globalThis, "pdfjsWorker");

    await loadPdfJsTextRuntime();

    expect(
      (globalThis as unknown as Record<string, unknown>).pdfjsWorker,
    ).toBeDefined();
  });
});
