import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { UI_COPY } from "../app/i18n";
import {
  contrastRatio,
  REQUIRED_ACCESSIBILITY_PATTERNS,
} from "./accessibility-contract";

const readSource = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

describe("accessible multilingual application contract", () => {
  it("keeps English and German interface copy structurally complete", () => {
    expect(Object.keys(UI_COPY.en).sort()).toEqual(
      Object.keys(UI_COPY.de).sort(),
    );
    expect(Object.values(UI_COPY.en).every(Boolean)).toBe(true);
    expect(Object.values(UI_COPY.de).every(Boolean)).toBe(true);
  });

  it("meets WCAG AA contrast at the declared interaction surfaces", () => {
    expect(contrastRatio("#13221d", "#fffefa")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#64716c", "#fffefa")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#ffffff", "#174f3d")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#255dff", "#fffefa")).toBeGreaterThanOrEqual(3);
  });

  it("keeps phone, keyboard, focus, live-region, and reduced-motion seams observable", () => {
    const sources = {
      styles: readSource("../styles.css"),
      shell: readSource("../app/application-shell.tsx"),
      routes: readSource("../app/routes.tsx"),
      interview: readSource("../app/discovery-interview-panel.tsx"),
      material: readSource("../app/project-material-panel.tsx"),
      brief: readSource("../app/project-brief-panel.tsx"),
    };

    for (const requirement of REQUIRED_ACCESSIBILITY_PATTERNS) {
      expect(
        sources[requirement.source].match(requirement.pattern),
        requirement.description,
      ).not.toBeNull();
    }
  });
});
