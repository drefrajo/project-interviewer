import { useState } from "react";
import { createRoot } from "react-dom/client";
import { ConceptsStep } from "../../src/app/client/concepts-step";
import { VisualDirectionSummary } from "../../src/app/shared/visual-direction-summary";
import { visualDirectionConfirmationSummary, type VisualDirection } from "../../src/domain/visual-direction";
import recording from "../runtime/concept-selection/theo.json";
import "../../src/styles.css";

// Local-only visual QA entry; never imported by the production entry point.
const concepts = recording.concepts.map((concept) => ({ id: concept.id, name: concept.name, description: concept.rationale, imageUrl: `/.scratch/runtime/concept-selection/theo-${concept.id}.png`, state: "ready" as const }));
function Preview() {
  const [direction, setDirection] = useState<VisualDirection>();
  return <main className="min-h-screen bg-canvas p-4 text-ink sm:p-8">
    <p className="mb-5 text-sm text-muted">Local QA preview — no hosted Interview or notification.</p>
    {direction ? <VisualDirectionSummary direction={direction} concepts={concepts} language="en" /> : <ConceptsStep language="en" concepts={concepts} pending={false} onMoreOptions={async () => false} onRetryMoreOptions={async () => false} onRetryFirstOptions={async () => false} onSubmit={async (selection) => setDirection({ ...selection, confirmation: { summary: visualDirectionConfirmationSummary(selection, concepts, "en"), confirmedAt: Date.now() } })} />}
  </main>;
}
createRoot(document.getElementById("root")!).render(<Preview />);
