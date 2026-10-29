export interface VisualPreferences {
  keep: string;
  avoid: string;
}

export interface VisualDirectionConfirmation {
  summary: string;
  confirmedAt: number;
}

type DirectionFields = {
  note?: string;
  /** Optional on historical records; required for new selections. */
  preferences?: VisualPreferences;
  /** Written by the server only when the Client explicitly confirms. */
  confirmation?: VisualDirectionConfirmation;
};

export type VisualDirection = DirectionFields & (
  | { kind: "concept"; conceptId: string }
  | { kind: "inspiration_links"; inspirationLinks: string[] }
);

export const VISUAL_CONFIRMATION_COPY = {
  en: {
    keep: "Carry into my website",
    avoid: "Leave out or adjust",
    scope: "My keep/avoid preferences explain how to adapt this rough direction. The project scope and Creator's requirements still apply. This confirms the visual style, not additional features.",
    illustrative: "The image shows a rough style direction. Example photos and wording are illustrative; the agreed content and supplied assets will be used.",
    imageBasis: "The displayed image and my preferences below define the direction. A description written before image generation is not part of this confirmation.",
    references: "Direction based on my inspiration links and the preferences below. The linked pages have not been inspected by the interviewer.",
    referenceUse: "These references guide the style through my descriptions; they do not promise an exact copy or new functionality.",
  },
  de: {
    keep: "Für meine Website übernehmen",
    avoid: "Weglassen oder anpassen",
    scope: "Meine Wünsche beschreiben, wie diese grobe Richtung angepasst werden soll. Der Projektumfang und die Vorgaben des Creators gelten weiterhin. Bestätigt wird der visuelle Stil, keine zusätzliche Funktionalität.",
    illustrative: "Das Bild zeigt eine grobe Stilrichtung. Beispielbilder und Texte dienen der Veranschaulichung; verwendet werden die vereinbarten Inhalte und gelieferten Assets.",
    imageBasis: "Grundlage sind das gezeigte Bild und meine folgenden Wünsche. Eine vor der Bilderstellung verfasste Beschreibung ist nicht Teil dieser Bestätigung.",
    references: "Richtung auf Grundlage meiner Inspirationslinks und der folgenden Wünsche. Der Interviewer hat die verlinkten Seiten nicht besichtigt.",
    referenceUse: "Meine Beschreibungen bestimmen, wie die Referenzen den Stil prägen. Eine exakte Kopie oder zusätzliche Funktionalität wird nicht zugesagt.",
  },
} as const;

/** Exact reflection of the displayed basis and Client preferences, without inference. */
export const visualDirectionConfirmationSummary = (
  direction: VisualDirection,
  concepts: readonly { id: string; name: string; description?: string }[],
  language: keyof typeof VISUAL_CONFIRMATION_COPY,
) => {
  const text = VISUAL_CONFIRMATION_COPY[language];
  const concept = direction.kind === "concept"
    ? concepts.find((item) => item.id === direction.conceptId)
    : undefined;
  if (direction.kind === "concept" && !concept) {
    throw new Error("Selected Visual Concept is not available.");
  }
  if (!direction.preferences?.keep.trim() || !direction.preferences.avoid.trim()) {
    throw new Error("Describe what to keep and what to leave out or adjust.");
  }
  return [
    ...(concept
      ? [concept.name, text.imageBasis]
      : [text.references, ...(direction.kind === "inspiration_links" ? direction.inspirationLinks : [])]),
    `${text.keep}: ${direction.preferences.keep.trim()}`,
    `${text.avoid}: ${direction.preferences.avoid.trim()}`,
    ...(direction.note?.trim() ? [direction.note.trim()] : []),
    concept ? text.illustrative : text.referenceUse,
    text.scope,
  ].join("\n\n");
};
