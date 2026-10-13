import { useEffect, useMemo, useState } from "react";
import type {
  ClientLanguage,
  VisualConcept,
  VisualDirection,
} from "../../infrastructure/interview-api";
import { ConfirmDialog } from "../shared/confirm-dialog";
import {
  primaryButton,
  TextArea,
  TextInput,
  textLink,
} from "../shared/form-controls";
import { ImageLightbox } from "../shared/image-lightbox";
import { CLIENT_COPY } from "./client-copy";
import { visualDirectionConfirmationSummary } from "../../domain/visual-direction";

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
    className="aspect-[3/2] animate-pulse bg-soft-strong"
  />
);

const ConceptCardSkeleton = () => (
  <article
    aria-hidden="true"
    className="overflow-hidden rounded-box border-2 border-line bg-panel"
    data-testid="concept-skeleton"
  >
    <ConceptImageSkeleton />
    <div className="space-y-3 p-4">
      <div className="h-5 w-2/3 animate-pulse rounded bg-soft-strong" />
      <div className="h-3 w-full animate-pulse rounded bg-soft" />
      <div className="h-3 w-4/5 animate-pulse rounded bg-soft" />
    </div>
  </article>
);

export const ConceptsStep = ({
  language,
  concepts,
  generationPhase,
  pending,
  onMoreOptions,
  onRetryMoreOptions,
  onRetryFirstOptions,
  onSubmit,
  temporaryConceptBatchRetriesEnabled = false,
}: {
  language: ClientLanguage;
  concepts: VisualConcept[];
  generationPhase?: "planning" | "creating" | undefined;
  pending: boolean;
  onMoreOptions(): Promise<boolean>;
  onRetryMoreOptions(): Promise<boolean>;
  onRetryFirstOptions(): Promise<boolean>;
  onSubmit(direction: VisualDirection): Promise<void>;
  temporaryConceptBatchRetriesEnabled?: boolean;
}) => {
  const text = CLIENT_COPY[language];
  const [mode, setMode] = useState<"concept" | "links">("concept");
  const [selected, setSelected] = useState("");
  const [links, setLinks] = useState([""]);
  const [keep, setKeep] = useState("");
  const [avoid, setAvoid] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [showLongWaitNotice, setShowLongWaitNotice] = useState(false);
  const creatingConcepts =
    pending &&
    (generationPhase !== undefined ||
      concepts.length < 3 ||
      concepts.some((concept) => concept.state !== "ready"));
  const generationMessage =
    generationPhase === "planning"
      ? text.conceptsPlanning
      : generationPhase === "creating"
        ? text.conceptsCreating
        : text.conceptsPending;
  useEffect(() => {
    if (!creatingConcepts) {
      setShowLongWaitNotice(false);
      return;
    }
    const timeout = window.setTimeout(() => {
      setShowLongWaitNotice(true);
    }, 20_000);
    return () => window.clearTimeout(timeout);
  }, [creatingConcepts]);
  const normalizedLinks = links.map((link) => link.trim()).filter(Boolean);
  const valid = useMemo(
    () =>
      concepts.length >= 3 && concepts.every((concept) => concept.state === "ready") &&
      Boolean(keep.trim()) && Boolean(avoid.trim()) &&
      (mode === "concept"
        ? concepts.some((concept) => concept.id === selected && concept.state === "ready")
        : normalizedLinks.length > 0 &&
          normalizedLinks.length <= 3 &&
          normalizedLinks.every(isHttpUrl)),
    [concepts, mode, normalizedLinks, keep, avoid, selected],
  );
  const direction: VisualDirection =
    mode === "concept"
      ? { kind: "concept", conceptId: selected, preferences: { keep: keep.trim(), avoid: avoid.trim() } }
      : {
          kind: "inspiration_links",
          inspirationLinks: normalizedLinks,
          preferences: { keep: keep.trim(), avoid: avoid.trim() },
        };
  const requestMoreOptions = async () => {
    if (await onMoreOptions()) {
      setMode("concept");
      setSelected("");
      setKeep("");
      setAvoid("");
    }
  };

  const selectedConcept = concepts.find((concept) => concept.id === selected);
  const reviewKey = JSON.stringify({ direction, basis: selectedConcept, mode });
  useEffect(() => { setConfirming(false); }, [reviewKey, pending]);

  return (
    <section className="mx-auto w-full max-w-6xl">
      <h1 className="font-display text-3xl font-extrabold">{text.conceptsTitle}</h1>
      <p className="mt-3 max-w-3xl leading-7 text-muted">{text.conceptsIntro}</p>
      {creatingConcepts ? (
        <p
          aria-atomic="true"
        className="mt-5 max-w-3xl rounded-lg border border-line bg-soft p-4 font-bold text-forest"
          role="status"
        >
          <span className="block">{generationMessage}</span>
          {showLongWaitNotice ? (
            <span className="mt-1 block font-normal text-muted">
              {text.conceptsLongWait}
            </span>
          ) : null}
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
              <article
                className={`overflow-hidden rounded-box border-2 bg-panel ${
                  selected === concept.id && mode === "concept"
                    ? "border-primary"
                    : "border-line"
                }`}
                key={concept.id}
              >
                {concept.imageUrl ? (
                  <ImageLightbox
                    alt={`${concept.name}, rough visual direction`}
                    closeLabel={text.closeImage}
                    openLabel={text.viewImage}
                    src={concept.imageUrl}
                  />
                ) : pending && concept.state !== "failed" ? (
                  <ConceptImageSkeleton />
                ) : (
                  <div className="grid aspect-[3/2] place-items-center bg-soft px-5 text-center font-bold text-muted">
                    {concept.state === "failed"
                      ? language === "de"
                        ? "Konzept konnte nicht erstellt werden"
                        : "Concept could not be generated"
                      : language === "de"
                        ? "Konzept wird erstellt…"
                        : "Concept is being generated…"}
                  </div>
                )}
                <label className="block p-4">
                  <span className="flex items-start gap-3">
                    <input
                      checked={selected === concept.id && mode === "concept"}
                      className="mt-1 size-5"
                      disabled={pending || concept.state !== "ready"}
                      name="visual-concept"
                      onChange={() => {
                        if (mode !== "concept" || selected !== concept.id) {
                          setKeep("");
                          setAvoid("");
                        }
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
                </label>
              </article>
            ))}
        {pending && concepts.length === 3
          ? Array.from({ length: 3 }, (_, index) => (
              <ConceptCardSkeleton key={`additional-concept-${index}`} />
            ))
          : null}
      </div>
      {!pending &&
      concepts.length === 3 &&
      concepts.every((concept) => concept.state === "ready") ? (
        <div className="mt-4 flex justify-center">
          <button
            className={`${textLink} text-sm`}
            data-testid="request-more-concepts"
            onClick={() => void requestMoreOptions()}
            type="button"
          >
            {text.moreOptions}
          </button>
        </div>
      ) : null}
      {temporaryConceptBatchRetriesEnabled && concepts.length === 6 && !pending ? (
        <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2">
          <button
            className={`${textLink} text-xs`}
            data-testid="retry-first-concept-batch"
            onClick={() => void onRetryFirstOptions()}
            type="button"
          >
            {text.retryFirstOptions}
          </button>
          <button
            className={`${textLink} text-xs`}
            data-testid="retry-second-concept-batch"
            onClick={() => void onRetryMoreOptions()}
            type="button"
          >
            {text.retryMoreOptions}
          </button>
        </div>
      ) : null}
      <section className="mt-7 rounded-box border border-line bg-panel p-5">
        <label className="flex items-center gap-3 font-bold">
          <input
            checked={mode === "links"}
            className="size-5"
            name="visual-concept"
            disabled={pending}
            onChange={() => {
              setMode("links");
              setKeep("");
              setAvoid("");
            }}
            type="radio"
          />
          {text.inspiration}
        </label>
        {mode === "links" ? (
          <div className="mt-4 grid gap-3">
            <p className="rounded-lg bg-soft p-3 font-normal leading-6 text-muted" role="status">{text.noStyleAgreed}</p>
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
                disabled={pending}
              />
            ))}
            {links.length < 3 ? (
              <button
                className={`${textLink} w-fit`}
                onClick={() => setLinks((current) => [...current, ""])}
                disabled={pending}
                type="button"
              >
                {language === "de" ? "+ Weiteren Link hinzufügen" : "+ Add another link"}
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
      {selected || mode === "links" ? <section className="mt-4 rounded-box border border-line bg-panel p-5">
        <label className="grid gap-2 font-bold">
          {text.keepStyle}
          <TextArea
            required
            maxLength={2_000}
            onChange={(event) => setKeep(event.target.value)}
            rows={3}
            value={keep}
            disabled={pending}
          />
        </label>
        <p className="mt-2 text-sm leading-6 text-muted">{text.keepStyleHint}</p>
        <label className="mt-5 grid gap-2 font-bold">
          {text.avoidStyle}
          <TextArea required maxLength={2_000} rows={3} value={avoid} disabled={pending} onChange={(event) => setAvoid(event.target.value)} />
        </label>
        <p className="mt-2 text-sm leading-6 text-muted">{text.avoidStyleHint}</p>
        <button className={`${textLink} mt-2 text-sm`} disabled={pending} type="button" onClick={() => setAvoid(text.nothingToAvoid)}>{text.nothingToAvoid}</button>
        {mode === "links" &&
        normalizedLinks.some((link) => !isHttpUrl(link)) ? (
          <p className="mt-2 text-sm font-bold text-error-text" role="alert">
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
            {text.reviewDirection}
          </button>
        </div>
      </section> : null}
      <ConfirmDialog
        confirmLabel={text.confirmStyleSubmit}
        cancelLabel={text.adjustDirection}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          void onSubmit(direction);
        }}
        open={confirming && valid && !pending}
        title={text.confirmStyleTitle}
      >
        {valid ? <>
          {mode === "concept" && selectedConcept?.imageUrl ? (
            <img className="mb-4 max-h-56 w-full object-contain" src={selectedConcept.imageUrl} alt={selectedConcept.name} />
          ) : null}
          <p className="font-bold text-ink">{text.styleAgreement}</p>
          <p className="mt-3 whitespace-pre-wrap">{visualDirectionConfirmationSummary(direction, concepts, language)}</p>
          <p className="mt-4 text-sm">{text.finalWarning}</p>
        </> : null}
      </ConfirmDialog>
    </section>
  );
};
