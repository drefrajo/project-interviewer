import type {
  ClientLanguage,
  VisualConcept,
  VisualDirection,
} from "../../infrastructure/interview-api";

const copy = {
  en: {
    selected: "Selected concept",
    unavailable: "The selected concept is no longer available.",
    inspiration: "Selected inspiration",
    note: "Additional note",
  },
  de: {
    selected: "Ausgewähltes Konzept",
    unavailable: "Das ausgewählte Konzept ist nicht mehr verfügbar.",
    inspiration: "Ausgewählte Inspiration",
    note: "Zusätzliche Notiz",
  },
} satisfies Record<ClientLanguage, Record<string, string>>;

export const visualDirectionMarkdown = (
  direction: VisualDirection,
  concepts: readonly VisualConcept[],
) => {
  if (direction.kind === "concept") {
    const concept = concepts.find((item) => item.id === direction.conceptId);
    return [
      "# Visual Direction",
      "",
      `## Selected concept: ${concept?.name ?? "Unavailable"}`,
      ...(concept?.description ? ["", concept.description] : []),
      ...(direction.note ? ["", "## Additional note", "", direction.note] : []),
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
  if (direction.kind === "concept") {
    const concept = concepts.find((item) => item.id === direction.conceptId);
    if (!concept) {
      return (
        <p className="mt-3 leading-7 text-muted">{text.unavailable}</p>
      );
    }
    return (
      <article className="mt-4 grid overflow-hidden rounded-xl border border-line bg-white sm:grid-cols-[minmax(14rem,20rem)_1fr]">
        {concept.imageUrl ? (
          <img
            alt={`${concept.name}, rough visual direction`}
            className="aspect-[3/2] h-full w-full object-cover"
            src={concept.imageUrl}
          />
        ) : (
          <div
            aria-hidden="true"
            className="aspect-[3/2] bg-[#eef2eb]"
          />
        )}
        <div className="p-5 sm:p-6">
          <p className="text-xs font-extrabold tracking-[0.14em] text-forest uppercase">
            {text.selected}
          </p>
          <h3 className="mt-2 font-display text-2xl font-extrabold">
            {concept.name}
          </h3>
          {concept.description ? (
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
        </div>
      </article>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-line bg-white p-5 sm:p-6">
      <p className="text-xs font-extrabold tracking-[0.14em] text-forest uppercase">
        {text.inspiration}
      </p>
      <ul className="mt-3 grid gap-2">
        {direction.inspirationLinks.map((link) => (
          <li key={link}>
            <a
              className="font-bold text-forest underline decoration-line underline-offset-4"
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
    </div>
  );
};
