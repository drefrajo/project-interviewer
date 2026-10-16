import { describe, expect, it } from "vitest";
import { visualDirectionConfirmationSummary } from "./visual-direction";

describe("image-based style confirmation", () => {
  it.each(["de", "en"] as const)("does not approve a pre-render description that can contradict the image (%s)", language => {
    const summary = visualDirectionConfirmationSummary(
      { kind: "concept", conceptId: "concept_1", preferences: { keep: "Keep the left sidebar shown in the image", avoid: "No horizontal navigation" } },
      [{ id: "concept_1", name: "Warm clarity", description: "Upper horizontal navigation provides orientation." }],
      language,
    );
    expect(summary).toContain("Warm clarity");
    expect(summary).toContain("Keep the left sidebar shown in the image");
    expect(summary).not.toContain("Upper horizontal navigation");
    expect(summary).toContain(language === "de" ? "das gezeigte Bild" : "displayed image");
  });
});
