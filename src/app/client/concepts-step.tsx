import { useMemo, useState } from "react";
import type {
  ClientLanguage,
  VisualConcept,
  VisualDirection,
} from "../../infrastructure/interview-api";
import { ConfirmDialog } from "../shared/confirm-dialog";
import { primaryButton, TextArea, TextInput } from "../shared/form-controls";
import { CLIENT_COPY } from "./client-copy";

const isHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const ConceptImageSkeleton = () => (
  <div
    aria-hidden="true"
    className="aspect-[3/2] animate-pulse bg-[#e6ebe3]"
  />
);

const ConceptCardSkeleton = () => (
  <article
    aria-hidden="true"
    className="overflow-hidden rounded-xl border-2 border-line bg-white"
    data-testid="concept-skeleton"
  >
    <ConceptImageSkeleton />
    <div className="space-y-3 p-4">
      <div className="h-5 w-2/3 animate-pulse rounded bg-[#e6ebe3]" />
      <div className="h-3 w-full animate-pulse rounded bg-[#eef2eb]" />
      <div className="h-3 w-4/5 animate-pulse rounded bg-[#eef2eb]" />
    </div>
  </article>
);

export const ConceptsStep = ({
  language,
  concepts,
  pending,
  onSubmit,
}: {
  language: ClientLanguage;
  concepts: VisualConcept[];
  pending: boolean;
  onSubmit(direction: VisualDirection): Promise<void>;
}) => {
  const text = CLIENT_COPY[language];
  const [mode, setMode] = useState<"concept" | "links">("concept");
  const [selected, setSelected] = useState("");
  const [links, setLinks] = useState([""]);
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const creatingConcepts =
    pending &&
    (concepts.length < 3 ||
      concepts.some((concept) => concept.state !== "ready"));
  const normalizedLinks = links.map((link) => link.trim()).filter(Boolean);
  const valid = useMemo(
    () =>
      mode === "concept"
        ? Boolean(selected)
        : normalizedLinks.length > 0 &&
          normalizedLinks.length <= 3 &&
          normalizedLinks.every(isHttpUrl),
    [mode, normalizedLinks, selected],
  );
  const direction: VisualDirection =
    mode === "concept"
      ? { kind: "concept", conceptId: selected, ...(note.trim() ? { note: note.trim() } : {}) }
      : {
          kind: "inspiration_links",
          inspirationLinks: normalizedLinks,
          ...(note.trim() ? { note: note.trim() } : {}),
        };

  return (
    <section className="mx-auto w-full max-w-6xl">
      <h1 className="font-display text-3xl font-extrabold">{text.conceptsTitle}</h1>
      <p className="mt-3 max-w-3xl leading-7 text-muted">{text.conceptsIntro}</p>
      {creatingConcepts ? (
        <p
          aria-atomic="true"
          className="mt-5 max-w-3xl rounded-lg border border-line bg-[#eef2eb] p-4 font-bold text-forest"
          role="status"
        >
          {text.conceptsPending}
        </p>
      ) : null}
      <div
        aria-busy={creatingConcepts}
        className={`${creatingConcepts ? "mt-5" : "mt-7"} grid gap-5 lg:grid-cols-3`}
      >
        {pending && concepts.length === 0
          ? Array.from({ length: 3 }, (_, index) => (
              <ConceptCardSkeleton key={index} />
            ))
          : concepts.map((concept) => (
              <label
                className={`overflow-hidden rounded-xl border-2 bg-white ${
                  selected === concept.id && mode === "concept"
                    ? "border-forest"
                    : "border-line"
                }`}
                key={concept.id}
              >
                {concept.imageUrl ? (
                  <img
                    alt={`${concept.name}, rough visual direction`}
                    className="aspect-[3/2] w-full object-cover"
                    src={concept.imageUrl}
                  />
                ) : pending && concept.state !== "failed" ? (
                  <ConceptImageSkeleton />
                ) : (
                  <div className="grid aspect-[3/2] place-items-center bg-[#eef2eb] px-5 text-center font-bold text-muted">
                    {concept.state === "failed"
                      ? language === "de"
                        ? "Konzept konnte nicht erstellt werden"
                        : "Concept could not be generated"
                      : language === "de"
                        ? "Konzept wird erstellt…"
                        : "Concept is being generated…"}
                  </div>
                )}
                <span className="block p-4">
                  <span className="flex items-start gap-3">
                    <input
                      checked={selected === concept.id && mode === "concept"}
                      className="mt-1 size-5"
                      disabled={concept.state !== "ready" && !concept.imageUrl}
                      name="visual-concept"
                      onChange={() => {
                        setMode("concept");
                        setSelected(concept.id);
                      }}
                      type="radio"
                    />
                    <span>
                      <strong className="block font-display text-xl">
                        {concept.name}
                      </strong>
                      {concept.description ? (
                        <span className="mt-1 block text-sm leading-6 text-muted">
                          {concept.description}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </span>
              </label>
            ))}
      </div>
      <section className="mt-7 rounded-xl border border-line bg-surface p-5">
        <label className="flex items-center gap-3 font-bold">
          <input
            checked={mode === "links"}
            className="size-5"
            name="visual-concept"
            onChange={() => setMode("links")}
            type="radio"
          />
          {text.inspiration}
        </label>
        {mode === "links" ? (
          <div className="mt-4 grid gap-3">
            {links.map((link, index) => (
              <TextInput
                aria-label={`${language === "de" ? "Inspirationslink" : "Inspiration link"} ${index + 1}`}
                key={index}
                onChange={(event) =>
                  setLinks((current) =>
                    current.map((value, currentIndex) =>
                      currentIndex === index ? event.target.value : value,
                    ),
                  )
                }
                placeholder="https://example.com"
                type="url"
                value={link}
              />
            ))}
            {links.length < 3 ? (
              <button
                className="w-fit font-bold text-forest"
                onClick={() => setLinks((current) => [...current, ""])}
                type="button"
              >
                {language === "de" ? "+ Weiteren Link hinzufügen" : "+ Add another link"}
              </button>
            ) : null}
          </div>
        ) : null}
        <label className="mt-5 grid gap-2 font-bold">
          {text.note}
          <TextArea
            maxLength={2_000}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            value={note}
          />
        </label>
        {mode === "links" &&
        normalizedLinks.some((link) => !isHttpUrl(link)) ? (
          <p className="mt-2 text-sm font-bold text-[#852f21]" role="alert">
            {language === "de"
              ? "Verwenden Sie nur vollständige HTTP(S)-Links."
              : "Use complete HTTP(S) links only."}
          </p>
        ) : null}
        <div className="mt-5 flex justify-end">
          <button
            className={primaryButton}
            disabled={!valid || pending}
            onClick={() => setConfirming(true)}
            type="button"
          >
            {text.submit}
          </button>
        </div>
      </section>
      <ConfirmDialog
        confirmLabel={text.submit}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          void onSubmit(direction);
        }}
        open={confirming}
        title={text.submit}
      >
        <p>{text.finalWarning}</p>
      </ConfirmDialog>
    </section>
  );
};
