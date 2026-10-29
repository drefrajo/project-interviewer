import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  visualDirectionMarkdown,
  VisualDirectionSummary,
} from "./visual-direction-summary";

const concepts = [
  {
    id: "concept_3",
    name: "Interactive & Tech-forward",
    description: "A futuristic direction with clear service cards.",
    imageUrl: "https://example.test/concept.png",
    state: "ready" as const,
  },
];

describe("VisualDirectionSummary", () => {
  it("resolves a concept ID into the chosen concept presentation", () => {
    render(
      <VisualDirectionSummary
        concepts={concepts}
        direction={{
          kind: "concept",
          conceptId: "concept_3",
          note: "Keep the navigation restrained.",
        }}
        language="de"
      />,
    );

    expect(screen.getByText("Ausgewähltes Konzept")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Interactive & Tech-forward" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("concept_3")).not.toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: "Interactive & Tech-forward, grobe visuelle Richtung",
      }),
    ).toHaveAttribute("src", "https://example.test/concept.png");
    expect(screen.getByText("Keep the navigation restrained.")).toBeInTheDocument();
  });

  it("renders inspiration links as links instead of JSON", () => {
    render(
      <VisualDirectionSummary
        concepts={[]}
        direction={{
          kind: "inspiration_links",
          inspirationLinks: ["https://example.test/reference"],
        }}
        language="en"
      />,
    );

    expect(
      screen.getByRole("link", { name: "https://example.test/reference" }),
    ).toHaveAttribute("href", "https://example.test/reference");
  });

  it("exports readable Markdown rather than serialized JSON", () => {
    const markdown = visualDirectionMarkdown(
      { kind: "concept", conceptId: "concept_3" },
      concepts,
    );

    expect(markdown).toContain(
      "## Selected concept: Interactive & Tech-forward",
    );
    expect(markdown).not.toContain("conceptId");
  });

  it("shows and exports the exact confirmed summary, including keep and avoid preferences", () => {
    const direction = {
      kind: "concept" as const, conceptId: "concept_3",
      preferences: { keep: "Clear service cards", avoid: "No neon colours" },
      confirmation: { summary: "Selected visual basis.\n\nKeep clear service cards.\n\nAvoid neon colours.\n\nAgreed scope still applies.", confirmedAt: Date.UTC(2026, 9, 13) },
    };
    render(<VisualDirectionSummary concepts={concepts} direction={direction} language="en" />);
    expect(screen.getByRole("heading", { name: "Confirmed visual style" })).toBeInTheDocument();
    expect(screen.getByText(/Keep clear service cards/)).toHaveTextContent("Avoid neon colours");
    const markdown = visualDirectionMarkdown(direction, concepts);
    expect(markdown).toContain(direction.confirmation.summary);
    expect(markdown).not.toContain(concepts[0]!.description);
    expect(screen.queryByText(concepts[0]!.description)).not.toBeInTheDocument();
    expect(markdown).toContain("2026-10-13T00:00:00.000Z");
  });
});
