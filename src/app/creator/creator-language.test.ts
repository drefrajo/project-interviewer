import { describe, expect, it } from "vitest";
import { creatorLanguageFromBrowser } from "./creator-language";

describe("Creator browser language negotiation", () => {
  it.each([
    [["de-AT", "en-US"], "de"],
    [["fr-FR", "de-DE", "en-US"], "de"],
    [["fr-FR", "en-US", "de-DE"], "en"],
    [["fr-FR", "es-ES"], "en"],
  ] as const)("selects the first supported preference from %j", (languages, expected) => {
    expect(creatorLanguageFromBrowser(languages)).toBe(expected);
  });

  it("accepts underscore-separated browser locale tags", () => {
    expect(creatorLanguageFromBrowser(["de_AT"])).toBe("de");
  });
});
