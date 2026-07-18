export const REQUIRED_ACCESSIBILITY_PATTERNS = [
  {
    source: "styles",
    description: "Phone layout",
    pattern: /@media \(max-width:\s*760px\)/,
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
    source: "styles",
    description: "Minimum interaction target",
    pattern: /\.button[\s\S]*min-height:\s*2\.75rem/,
  },
  {
    source: "styles",
    description: "Minimum compact-link target",
    pattern: /\.back-link[\s\S]*min-height:\s*2\.75rem/,
  },
  {
    source: "styles",
    description: "Minimum checkbox target",
    pattern: /input\[type="checkbox"\][\s\S]*height:\s*1\.5rem/,
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
