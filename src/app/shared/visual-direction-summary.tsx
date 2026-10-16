import type {
  ClientLanguage,
  VisualConcept,
  VisualDirection,
} from "../../infrastructure/interview-api";
import { textLink } from "./form-controls";
import { ImageLightbox } from "./image-lightbox";

const copy = {
  en: {
    selected: "Selected concept",
    unavailable: "The selected concept is no longer available.",
    inspiration: "Selected inspiration",
    note: "Additional note",
    rough: "rough visual direction",
    viewImage: "View larger",
    closeImage: "Close image",
    confirmedStyle: "Confirmed visual style",
    preferences: "Style preferences awaiting confirmation",
    keep: "Carry into my website",
    avoid: "Leave out or adjust",
  },
  de: {
    selected: "Ausgewähltes Konzept",
    unavailable: "Das ausgewählte Konzept ist nicht mehr verfügbar.",
    inspiration: "Ausgewählte Inspiration",
    note: "Zusätzliche Notiz",
    rough: "grobe visuelle Richtung",
    viewImage: "Bild vergrößern",
    closeImage: "Bild schließen",
    confirmedStyle: "Bestätigter visueller Stil",
    preferences: "Stilwünsche vor der Bestätigung",
    keep: "Für meine Website übernehmen",
    avoid: "Weglassen oder anpassen",
  },
} satisfies Record<ClientLanguage, Record<string, string>>;

export const visualDirectionMarkdown = (
  direction: VisualDirection,
  concepts: readonly VisualConcept[],
) => {
  const style = direction.confirmation
    ? ["", "## Confirmed visual style", "", direction.confirmation.summary, "", `Confirmed: ${new Date(direction.confirmation.confirmedAt).toISOString()}`]
    : direction.preferences
      ? ["", "## Style preferences awaiting confirmation", "", `Carry into my website: ${direction.preferences.keep}`, "", `Leave out or adjust: ${direction.preferences.avoid}`]
      : [];
  if (direction.kind === "concept") {
    const concept = concepts.find((item) => item.id === direction.conceptId);
    return [
      "# Visual Direction",
      "",
      `## Selected concept: ${concept?.name ?? "Unavailable"}`,
      ...(!direction.confirmation && concept?.description ? ["", concept.description] : []),
      ...(direction.note ? ["", "## Additional note", "", direction.note] : []),
      ...style,
      "",
    ].join("\n");
  }
  return [
    "# Visual Direction",
    "",
    "## Inspiration links",
    "",
    ...direction.inspirationLinks.map((link) => `- ${link}`),
    ...(direction.note ? ["", "## Additional note", "", direction.note] : []),
    ...style,
    "",
  ].join("\n");
};

export const VisualDirectionSummary = ({
  direction,
  concepts,
  language,
}: {
  direction: VisualDirection;
  concepts: readonly VisualConcept[];
  language: ClientLanguage;
}) => {
  const text = copy[language];
  const preferences = direction.confirmation ? (
    <section className="mt-4 border-l-4 border-forest pl-4">
      <h4 className="font-bold">{text.confirmedStyle}</h4>
      <p className="mt-2 whitespace-pre-wrap leading-7">{direction.confirmation.summary}</p>
      <time className="mt-2 block text-sm text-muted" dateTime={new Date(direction.confirmation.confirmedAt).toISOString()}>
        {new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }).format(direction.confirmation.confirmedAt)}
      </time>
    </section>
  ) : direction.preferences ? (
    <section className="mt-4 border-l-4 border-line pl-4">
      <h4 className="font-bold">{text.preferences}</h4>
      <p className="mt-2 leading-7"><strong>{text.keep}:</strong> {direction.preferences.keep}</p>
      <p className="mt-2 leading-7"><strong>{text.avoid}:</strong> {direction.preferences.avoid}</p>
    </section>
  ) : null;
  if (direction.kind === "concept") {
    const concept = concepts.find((item) => item.id === direction.conceptId);
    if (!concept) {
      return (
        <p className="mt-3 leading-7 text-muted">{text.unavailable}</p>
      );
    }
    return (
      <article className="mt-4 grid overflow-hidden rounded-box border border-line bg-panel sm:grid-cols-[minmax(14rem,20rem)_1fr]">
        {concept.imageUrl ? (
          <ImageLightbox
            alt={`${concept.name}, ${text.rough}`}
            closeLabel={text.closeImage}
            openLabel={text.viewImage}
            src={concept.imageUrl}
          />
        ) : (
          <div
            aria-hidden="true"
            className="aspect-[3/2] bg-soft"
          />
        )}
        <div className="p-5 sm:p-6">
          <p className="text-xs font-extrabold tracking-[0.14em] text-forest uppercase">
            {text.selected}
          </p>
          <h3 className="mt-2 font-display text-2xl font-extrabold">
            {concept.name}
          </h3>
          {!direction.confirmation && concept.description ? (
            <p className="mt-2 leading-7 text-muted">{concept.description}</p>
          ) : null}
          {direction.note ? (
            <div className="mt-4 border-l-4 border-lime pl-4">
              <p className="text-xs font-extrabold tracking-wide text-muted uppercase">
                {text.note}
              </p>
              <p className="mt-1 leading-7">{direction.note}</p>
            </div>
          ) : null}
          {preferences}
        </div>
      </article>
    );
  }

  return (
    <div className="mt-4 rounded-box border border-line bg-panel p-5 sm:p-6">
      <p className="text-xs font-extrabold tracking-[0.14em] text-forest uppercase">
        {text.inspiration}
      </p>
      <ul className="mt-3 grid gap-2">
        {direction.inspirationLinks.map((link) => (
          <li key={link}>
            <a
              className={textLink}
              href={link}
              rel="noreferrer"
              target="_blank"
            >
              {link}
            </a>
          </li>
        ))}
      </ul>
      {direction.note ? (
        <div className="mt-4 border-l-4 border-lime pl-4">
          <p className="text-xs font-extrabold tracking-wide text-muted uppercase">
            {text.note}
          </p>
          <p className="mt-1 leading-7">{direction.note}</p>
        </div>
      ) : null}
      {preferences}
    </div>
  );
};
