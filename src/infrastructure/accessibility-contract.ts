export const REQUIRED_ACCESSIBILITY_PATTERNS = [
  {
    source: "room",
    description: "Reachable narrow-screen tabs",
    pattern: /overflow-x-auto[\s\S]*lg:flex-col/,
  },
  {
    source: "room",
    description: "Constrained narrow-screen Project Room grid",
    pattern: /grid-cols-\[minmax\(0,1fr\)\]/,
  },
  {
    source: "styles",
    description: "Visible keyboard focus",
    pattern: /:focus-visible[\s\S]*outline:\s*3px/,
  },
  {
    source: "styles",
    description: "Reduced motion",
    pattern: /@media \(prefers-reduced-motion:\s*reduce\)/,
  },
  {
    source: "workspace",
    description: "Minimum workspace interaction target",
    pattern: /min-h-11/,
  },
  {
    source: "room",
    description: "Minimum Project Room interaction target",
    pattern: /min-h-11/,
  },
  {
    source: "room",
    description: "Minimum checkbox target",
    pattern: /size-[56][\s\S]*type="checkbox"/,
  },
  {
    source: "shell",
    description: "Keyboard skip link",
    pattern: /href="#main-content"/,
  },
  {
    source: "routes",
    description: "Skip-link destination",
    pattern: /id="main-content"/,
  },
  {
    source: "interview",
    description: "Interview screen-reader live region",
    pattern: /aria-live="polite"/,
  },
  {
    source: "material",
    description: "Material screen-reader live region",
    pattern: /aria-live="polite"/,
  },
  {
    source: "brief",
    description: "Brief screen-reader live region",
    pattern: /aria-live="polite"/,
  },
] as const;

const channel = (hex: string, offset: number) => {
  const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return value <= 0.04045
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex: string) => {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) {
    throw new Error(`Expected a six-digit hex color, received ${hex}.`);
  }
  return (
    0.2126 * channel(hex, 1) +
    0.7152 * channel(hex, 3) +
    0.0722 * channel(hex, 5)
  );
};

export const contrastRatio = (foreground: string, background: string) => {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
};
