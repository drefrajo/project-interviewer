import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type {
  BriefEvidenceDetail,
  BriefSource,
  BriefWarning,
  ProjectBriefView,
  ReviewVersion,
} from "../domain/project-brief";
import type {
  ProjectInterviewer,
  ProjectRoomView,
  RoomActor,
} from "../domain/project-interviewer";
import { useI18n } from "./i18n";

const copy = {
  en: {
    title: "Project Brief",
    unavailable: "The Project Brief becomes available after discovery is complete.",
    generate: "Generate Project Brief",
    generating: "Generating the source-linked Project Brief…",
    retry: "Retry generation",
    draft: "Brief Draft",
    save: "Save Markdown",
    copy: "Copy Markdown",
    preview: "Preview",
    send: "Send for Client review",
    warnings: "Review warnings",
    acknowledge: "Acknowledge",
    resolve: "Resolve",
    review: "Review Version",
    approve: "Approve this Review Version",
    change: "Change Request",
    changePlaceholder: "Describe the revision you need…",
    saveChange: "Save Change Request",
    acknowledgeChange: "Acknowledge and begin revision",
    reopen: "Reopen as private Brief Draft",
    print: "Print / Save as PDF",
    history: "Previous Review Versions",
    evidence: "Evidence",
    approvalDisclaimer:
      "Approval confirms this discovery understanding only. It is not a signature or contract.",
    readOnly: "This archived Project Room is read-only.",
    saved: "Markdown saved.",
  },
  de: {
    title: "Projektbrief",
    unavailable:
      "Der Projektbrief wird nach Abschluss der Klärung verfügbar.",
    generate: "Projektbrief erstellen",
    generating: "Quellengestützter Projektbrief wird erstellt…",
    retry: "Erstellung wiederholen",
    draft: "Briefentwurf",
    save: "Markdown speichern",
    copy: "Markdown kopieren",
    preview: "Vorschau",
    send: "Zur Client-Prüfung senden",
    warnings: "Prüfhinweise",
    acknowledge: "Bestätigen",
    resolve: "Als geklärt markieren",
    review: "Prüfversion",
    approve: "Diese Prüfversion freigeben",
    change: "Änderungswunsch",
    changePlaceholder: "Beschreiben Sie die benötigte Änderung…",
    saveChange: "Änderungswunsch speichern",
    acknowledgeChange: "Bestätigen und Überarbeitung beginnen",
    reopen: "Als privaten Briefentwurf öffnen",
    print: "Drucken / Als PDF speichern",
    history: "Frühere Prüfversionen",
    evidence: "Quellen",
    approvalDisclaimer:
      "Die Freigabe bestätigt nur dieses gemeinsame Projektverständnis. Sie ist keine Unterschrift und kein Vertrag.",
    readOnly: "Dieser archivierte Projektraum ist schreibgeschützt.",
    saved: "Markdown gespeichert.",
  },
} as const;

type BriefCopy = { [Key in keyof (typeof copy)["en"]]: string };

const primaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-md bg-forest px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#0f3d2f] disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-forest bg-transparent px-4 py-2 text-sm font-bold text-forest transition-colors hover:bg-[#e3ede8] disabled:cursor-not-allowed disabled:opacity-60";
const ghostButton =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-line bg-transparent px-4 py-2 text-sm font-bold text-ink transition-colors hover:bg-[#f5f6f0] disabled:cursor-not-allowed disabled:opacity-60";

const warningLabel = (warning: BriefWarning, locale: "en" | "de") => {
  const labels = {
    en: {
      feasibility: "Feasibility",
      scope: "Open scope",
      budget: "Budget",
      timeline: "Timeline",
      responsibility: "Responsibility",
      critical_gap: "Critical gap",
      contradiction: "Contradiction",
    },
    de: {
      feasibility: "Machbarkeit",
      scope: "Offener Umfang",
      budget: "Budget",
      timeline: "Zeitplan",
      responsibility: "Verantwortung",
      critical_gap: "Kritische Lücke",
      contradiction: "Widerspruch",
    },
  } as const;
  return labels[locale][warning.category];
};

const sourceLabel = (source: BriefSource) => {
  switch (source.type) {
    case "material":
      return source.locator.label;
    case "turn":
      return "Interview answer";
    case "correction":
      return "Interview correction";
    case "analysis_feedback":
      return "Analysis feedback";
    case "model_inference":
      return "Model inference";
    case "project_description":
      return "Project Description";
    case "freelancer_edit":
      return "Freelancer edit";
  }
};

const MarkdownDocument = ({ markdown }: { markdown: string }) => (
  <article className="prose prose-slate min-w-0 max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-white p-5 shadow-sm [overflow-wrap:anywhere] prose-headings:scroll-mt-24 prose-code:break-words">
    <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>
      {markdown}
    </ReactMarkdown>
  </article>
);

export const ProjectBriefPanel = ({
  application,
  actor,
  room,
  onRoomChange,
}: {
  application: ProjectInterviewer;
  actor: RoomActor;
  room: ProjectRoomView;
  onRoomChange?(): void;
}) => {
  const { locale } = useI18n();
  const text = copy[locale];
  const [view, setView] = useState<ProjectBriefView>();
  const [markdown, setMarkdown] = useState("");
  const [changeRequest, setChangeRequest] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedSource, setSelectedSource] = useState<BriefSource | null>(
    null,
  );
  const [sourceDetail, setSourceDetail] = useState<BriefEvidenceDetail | null>(
    null,
  );
  const busyRef = useRef(false);
  const latestChangeRequestText =
    view?.activeChangeRequest?.revisions.at(-1)?.text ?? "";

  const refresh = useCallback(async () => {
    const next = await application.briefs.get(actor, room.id);
    setView(next);
    if (next.draft) setMarkdown(next.draft.markdown);
  }, [actor, application, room.id]);

  useEffect(() => {
    void refresh().catch((caught) =>
      setError(caught instanceof Error ? caught.message : String(caught)),
    );
  }, [refresh]);

  useEffect(() => {
    if (actor.kind === "client") {
      setChangeRequest(latestChangeRequestText);
    }
  }, [actor.kind, latestChangeRequestText]);

  useEffect(() => {
    if (!selectedSource) {
      setSourceDetail(null);
      return;
    }
    void application.briefs
      .inspectSource(actor, room.id, selectedSource)
      .then(setSourceDetail)
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : String(caught)),
      );
  }, [actor, application, room.id, selectedSource]);

  const perform = async (action: () => Promise<ProjectBriefView>) => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const next = await action();
      setView(next);
      if (next.draft) setMarkdown(next.draft.markdown);
      onRoomChange?.();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const copyMarkdown = async () => {
    if (!view?.draft) return;
    try {
      const saved = await perform(() =>
        application.briefs.updateMarkdown(actor, room.id, { markdown }),
      );
      if (!saved) return;
      const exported = await application.briefs.exportMarkdown(
        actor,
        room.id,
        { artifactId: view.draft.id },
      );
      await navigator.clipboard.writeText(exported);
      setNotice(locale === "de" ? "Markdown kopiert." : "Markdown copied.");
    } catch {
      setError(
        locale === "de"
          ? "Markdown konnte nicht kopiert werden."
          : "Markdown could not be copied.",
      );
    }
  };

  const available = [
    "freelancer_review",
    "client_review",
    "approved",
    "archived",
  ].includes(room.phase);
  const readOnly = room.phase === "archived";

  if (!available && !view?.visibleReviewVersion) {
    return (
      <article className="border border-line bg-surface p-6 shadow-[0_1.5rem_4rem_rgb(19_34_29_/_7%)] sm:p-8" id="brief">
        <p className="mb-2 text-xs font-extrabold tracking-[0.14em] text-forest uppercase">
          {text.title}
        </p>
        <h2 className="mb-3 font-display text-2xl font-extrabold tracking-tight text-ink">
          {text.title}
        </h2>
        <p className="mb-0 leading-7 text-muted">{text.unavailable}</p>
      </article>
    );
  }

  return (
    <section aria-labelledby="brief-heading" className="space-y-5" id="brief">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="inline-flex bg-[#e3ede8] px-2 py-1 text-xs font-extrabold tracking-[0.08em] text-forest uppercase">
            {text.title}
          </span>
          <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink" id="brief-heading">
            {text.title}
          </h2>
        </div>
        {view?.visibleReviewVersion ? (
          <button className={ghostButton} onClick={() => window.print()} type="button">
            {text.print}
          </button>
        ) : null}
      </header>
      {readOnly ? <p className="text-muted">{text.readOnly}</p> : null}
      {error ? <p className="border-l-4 border-coral bg-[#fff1e7] p-3 font-bold text-[#852f21]" role="alert">{error}</p> : null}
      {notice ? <p className="font-semibold text-forest" role="status">{notice}</p> : null}

      {view === undefined ? <p role="status">{text.generating}</p> : null}
      {view && !view.draft && !view.visibleReviewVersion && actor.kind === "freelancer" && !readOnly ? (
        <button className={primaryButton} disabled={busy} onClick={() => void perform(() => application.briefs.generate(actor, room.id, { idempotencyKey: `brief:${room.id}` }))} type="button">
          {text.generate}
        </button>
      ) : null}
      {view?.operation?.status === "running" ? <p role="status">{text.generating}</p> : null}
      {view?.operation?.status === "retryable" && actor.kind === "freelancer" && !readOnly ? (
        <button className={primaryButton} disabled={busy} onClick={() => void perform(() => application.briefs.retryGeneration(actor, room.id))} type="button">
          {text.retry}
        </button>
      ) : null}

      {view?.draft ? (
        <section className="space-y-4" aria-labelledby="brief-draft-heading">
          <div>
            <h3 id="brief-draft-heading">{text.draft}</h3>
            <p className="text-sm text-slate-600">
              {locale === "de"
                ? "Dies ist ein Markdown-Dokument. Unsichtbare Markierungen bewahren Quellen und Status beim Speichern."
                : "This is one Markdown document. Invisible markers preserve sources and states when it is saved."}
            </p>
          </div>
          {!readOnly ? (
            <>
              <label className="block">
                <span className="sr-only">Project Brief Markdown</span>
                <textarea
                  aria-label="Project Brief Markdown"
                  className="min-h-[32rem] w-full rounded-xl border border-slate-300 bg-white p-4 font-mono text-sm leading-6 shadow-sm outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-950/20"
                  onChange={(event) => setMarkdown(event.target.value)}
                  spellCheck={false}
                  value={markdown}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button className={primaryButton} disabled={busy} onClick={() => void perform(() => application.briefs.updateMarkdown(actor, room.id, { markdown })).then((saved) => saved && setNotice(text.saved))} type="button">
                  {text.save}
                </button>
                <button className={ghostButton} disabled={busy} onClick={() => void copyMarkdown()} type="button">
                  {text.copy}
                </button>
              </div>
            </>
          ) : null}
          <div className="space-y-2">
            <h4>{text.preview}</h4>
            <MarkdownDocument markdown={markdown} />
          </div>
          <EvidenceList sections={view.draft.sections} selectedSource={selectedSource} setSelectedSource={setSelectedSource} title={text.evidence} />
          <Warnings actor={actor} application={application} busy={busy} locale={locale} perform={perform} roomId={room.id} warnings={view.draft.warnings} text={text} />
          {!readOnly ? (
            <button className={primaryButton} disabled={busy} onClick={() => void perform(() => application.briefs.sendForReview(actor, room.id))} type="button">
              {text.send}
            </button>
          ) : null}
        </section>
      ) : null}

      {view?.visibleReviewVersion ? (
        <ReviewDocument
          actor={actor}
          application={application}
          busy={busy}
          changeRequest={changeRequest}
          perform={perform}
          readOnly={readOnly}
          review={view.visibleReviewVersion}
          roomId={room.id}
          selectedSource={selectedSource}
          setChangeRequest={setChangeRequest}
          setSelectedSource={setSelectedSource}
          text={text}
          view={view}
        />
      ) : null}

      {view && view.reviewVersions.length > 1 ? (
        <section className="space-y-3">
          <h3>{text.history}</h3>
          {view.reviewVersions.slice(1).map((review) => (
            <details key={review.id}>
              <summary>{text.review} {review.version}</summary>
              <MarkdownDocument markdown={review.markdown} />
            </details>
          ))}
        </section>
      ) : null}

      {selectedSource ? (
        <aside aria-live="polite" className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <strong>{sourceLabel(selectedSource)}</strong>
            <button aria-label="Close source detail" className={ghostButton} onClick={() => setSelectedSource(null)} type="button">×</button>
          </div>
          <p>{sourceDetail?.text ?? (locale === "de" ? "Quelle wird geladen…" : "Loading source…")}</p>
        </aside>
      ) : null}
    </section>
  );
};

const Warnings = ({
  actor,
  application,
  busy,
  locale,
  perform,
  roomId,
  warnings,
  text,
}: {
  actor: RoomActor;
  application: ProjectInterviewer;
  busy: boolean;
  locale: "en" | "de";
  perform(action: () => Promise<ProjectBriefView>): Promise<boolean>;
  roomId: string;
  warnings: BriefWarning[];
  text: BriefCopy;
}) => warnings.length ? (
  <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
    <h4>{text.warnings}</h4>
    <ul className="space-y-3">
      {warnings.map((warning) => (
        <li key={warning.id}>
          <strong>{warningLabel(warning, locale)}</strong>
          <p>{warning.message}</p>
          {warning.status === "unresolved" ? (
            <div className="flex flex-wrap gap-2">
              <button className={ghostButton} disabled={busy} onClick={() => void perform(() => application.briefs.resolveWarning(actor, roomId, { warningId: warning.id, resolution: "acknowledged", note: "Explicitly retained for Client review." }))} type="button">{text.acknowledge}</button>
              <button className={ghostButton} disabled={busy} onClick={() => void perform(() => application.briefs.resolveWarning(actor, roomId, { warningId: warning.id, resolution: "resolved", note: "Resolved during Freelancer review." }))} type="button">{text.resolve}</button>
            </div>
          ) : <small>{warning.status}</small>}
        </li>
      ))}
    </ul>
  </section>
) : null;

const EvidenceList = ({
  sections,
  selectedSource,
  setSelectedSource,
  title,
}: {
  sections: Array<{ sources: BriefSource[]; items: Array<{ sources: BriefSource[] }> }>;
  selectedSource: BriefSource | null;
  setSelectedSource(source: BriefSource): void;
  title: string;
}) => {
  const sources = sections.flatMap((section) => [
    ...section.sources,
    ...section.items.flatMap((item) => item.sources),
  ]);
  const unique = sources.filter(
    (source, index) =>
      sources.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(source)) === index,
  );
  return unique.length ? (
    <details className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <summary>{title}</summary>
      <div className="mt-3 flex flex-wrap gap-2">
        {unique.map((source) => (
          <button
            className={ghostButton}
            key={JSON.stringify(source)}
            onClick={() => setSelectedSource(source)}
            type="button"
            aria-pressed={selectedSource !== null && JSON.stringify(selectedSource) === JSON.stringify(source)}
          >
            {sourceLabel(source)}
          </button>
        ))}
      </div>
    </details>
  ) : null;
};

const ReviewDocument = ({
  actor,
  application,
  busy,
  changeRequest,
  perform,
  readOnly,
  review,
  roomId,
  selectedSource,
  setChangeRequest,
  setSelectedSource,
  text,
  view,
}: {
  actor: RoomActor;
  application: ProjectInterviewer;
  busy: boolean;
  changeRequest: string;
  perform(action: () => Promise<ProjectBriefView>): Promise<boolean>;
  readOnly: boolean;
  review: ReviewVersion;
  roomId: string;
  selectedSource: BriefSource | null;
  setChangeRequest(value: string): void;
  setSelectedSource(source: BriefSource): void;
  text: BriefCopy;
  view: ProjectBriefView;
}) => (
  <section className="space-y-4" aria-labelledby="review-version-heading">
    <div>
      <h3 id="review-version-heading">{text.review} {review.version}</h3>
      <p>{review.status.replaceAll("_", " ")}</p>
    </div>
    <MarkdownDocument markdown={review.markdown} />
    <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
      {text.approvalDisclaimer}
    </p>
    {actor.kind === "freelancer" ? (
      <EvidenceList sections={review.sections} selectedSource={selectedSource} setSelectedSource={setSelectedSource} title={text.evidence} />
    ) : null}
    {actor.kind === "client" && !readOnly && review.status === "awaiting_client" ? (
      <div className="flex flex-wrap gap-2">
        <button className={primaryButton} disabled={busy} onClick={() => void perform(() => application.briefs.approve(actor, roomId))} type="button">
          {text.approve}
        </button>
      </div>
    ) : null}
    {actor.kind === "client" && !readOnly && ["awaiting_client", "change_requested"].includes(review.status) ? (
      <form className="space-y-2" onSubmit={(event) => {
        event.preventDefault();
        if (!changeRequest.trim()) return;
        void perform(() => application.briefs.submitChangeRequest(actor, roomId, { text: changeRequest }));
      }}>
        <label className="block">
          <span>{text.change}</span>
          <textarea className="mt-1 min-h-28 w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-950/20" onChange={(event) => setChangeRequest(event.target.value)} placeholder={text.changePlaceholder} value={changeRequest} />
        </label>
        <button className={secondaryButton} disabled={busy || !changeRequest.trim()} type="submit">{text.saveChange}</button>
      </form>
    ) : null}
    {actor.kind === "client" ? (
      <EvidenceList sections={review.sections} selectedSource={selectedSource} setSelectedSource={setSelectedSource} title={text.evidence} />
    ) : null}
    {actor.kind === "freelancer" && !readOnly && review.status === "change_requested" && view.activeChangeRequest ? (
      <button className={primaryButton} disabled={busy} onClick={() => void perform(() => application.briefs.acknowledgeChangeRequest(actor, roomId))} type="button">{text.acknowledgeChange}</button>
    ) : null}
    {actor.kind === "freelancer" && !readOnly && review.status === "approved" ? (
      <button className={ghostButton} disabled={busy} onClick={() => void perform(() => application.briefs.reopen(actor, roomId))} type="button">{text.reopen}</button>
    ) : null}
  </section>
);
