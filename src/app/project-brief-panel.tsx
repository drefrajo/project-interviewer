import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type {
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
import { WorkingIndicator } from "./working-indicator";

const copy = {
  en: {
    title: "Project brief",
    unavailable:
      "The project brief will appear here once the interview is finished.",
    generate: "Create the project brief",
    generatingLabel: "The project brief is being created",
    generating: [
      "Writing the project brief…",
      "Gathering everything we learned…",
      "Putting it into words…",
      "Almost there…",
    ],
    retry: "Try again",
    draft: "Draft",
    draftHint:
      "Edit the brief as text, or switch to the preview to see it formatted. The text is what gets saved.",
    edit: "Edit",
    preview: "Preview",
    draftView: "Draft view",
    save: "Save changes",
    copy: "Copy text",
    send: "Send to the client for review",
    warnings: "Things to check",
    acknowledge: "Keep as is",
    resolve: "Mark as clarified",
    review: "Version for review",
    approve: "Approve this version",
    change: "Request a change",
    changePlaceholder: "Tell us what should be different…",
    saveChange: "Send change request",
    acknowledgeChange: "Acknowledge and begin revision",
    reopen: "Reopen as private draft",
    print: "Print / Save as PDF",
    history: "Earlier versions",
    approvalDisclaimer:
      "Approving confirms that this matches your shared understanding of the project. It is not a signature or contract.",
    readOnly: "This archived Project Room is read-only.",
    saved: "Saved.",
    copied: "Copied.",
    copyFailed: "The text could not be copied.",
  },
  de: {
    title: "Projektbrief",
    unavailable:
      "Der Projektbrief erscheint hier, sobald das Interview abgeschlossen ist.",
    generate: "Projektbrief erstellen",
    generatingLabel: "Der Projektbrief wird erstellt",
    generating: [
      "Der Projektbrief wird geschrieben…",
      "Ich sammle alles Gelernte…",
      "Ich bringe es zu Papier…",
      "Fast fertig…",
    ],
    retry: "Erneut versuchen",
    draft: "Entwurf",
    draftHint:
      "Bearbeiten Sie den Brief als Text oder wechseln Sie zur Vorschau, um ihn formatiert zu sehen. Gespeichert wird der Text.",
    edit: "Bearbeiten",
    preview: "Vorschau",
    draftView: "Ansicht des Entwurfs",
    save: "Änderungen speichern",
    copy: "Text kopieren",
    send: "An den Client zur Prüfung senden",
    warnings: "Zu prüfen",
    acknowledge: "So belassen",
    resolve: "Als geklärt markieren",
    review: "Version zur Prüfung",
    approve: "Diese Version freigeben",
    change: "Änderung wünschen",
    changePlaceholder: "Sagen Sie uns, was anders sein soll…",
    saveChange: "Änderungswunsch senden",
    acknowledgeChange: "Bestätigen und Überarbeitung beginnen",
    reopen: "Als privaten Entwurf öffnen",
    print: "Drucken / Als PDF speichern",
    history: "Frühere Versionen",
    approvalDisclaimer:
      "Die Freigabe bestätigt nur dieses gemeinsame Projektverständnis. Sie ist keine Unterschrift und kein Vertrag.",
    readOnly: "Dieser archivierte Projektraum ist schreibgeschützt.",
    saved: "Gespeichert.",
    copied: "Kopiert.",
    copyFailed: "Der Text konnte nicht kopiert werden.",
  },
} as const;

type BriefCopy = {
  [Key in keyof (typeof copy)["en"]]: (typeof copy)["en"][Key] extends
    readonly string[]
    ? readonly string[]
    : string;
};

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
  const [draftMode, setDraftMode] = useState<"edit" | "preview">("edit");
  const [changeRequest, setChangeRequest] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);
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
    const timer = window.setInterval(() => {
      void refresh().catch(() => {});
    }, 1_500);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const autoTriggered = useRef(false);
  useEffect(() => {
    if (autoTriggered.current) return;
    if (room.phase !== "freelancer_review") return;
    if (actor.kind !== "freelancer") return;
    if (!view) return;
    if (view.draft || view.visibleReviewVersion) return;
    if (view.operation?.status === "running") return;
    autoTriggered.current = true;
    application.briefs
      .generate(actor, room.id, { idempotencyKey: `brief:${room.id}` })
      .then((next) => {
        setView(next);
        if (next.draft) setMarkdown(next.draft.markdown);
      })
      .catch(() => {
        autoTriggered.current = false;
      });
  }, [room.phase, view, actor, application, room.id]);

  useEffect(() => {
    if (actor.kind === "client") {
      setChangeRequest(latestChangeRequestText);
    }
  }, [actor.kind, latestChangeRequestText]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || draftMode !== "edit") return;
    editor.style.height = "auto";
    editor.style.height = `${editor.scrollHeight}px`;
  }, [markdown, draftMode, view?.draft]);

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
      setNotice(text.copied);
    } catch {
      setError(text.copyFailed);
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
      {notice ? <p aria-live="polite" className="font-semibold text-forest" role="status">{notice}</p> : null}

      {view === undefined ? (
        <p>
          <WorkingIndicator label={text.generatingLabel} phrases={text.generating} />
        </p>
      ) : null}
      {view && !view.draft && !view.visibleReviewVersion && actor.kind === "freelancer" && !readOnly ? (
        <button className={primaryButton} disabled={busy} onClick={() => void perform(() => application.briefs.generate(actor, room.id, { idempotencyKey: `brief:${room.id}` }))} type="button">
          {text.generate}
        </button>
      ) : null}
      {view?.operation?.status === "running" ? (
        <p>
          <WorkingIndicator label={text.generatingLabel} phrases={text.generating} />
        </p>
      ) : null}
      {view?.operation?.status === "retryable" && actor.kind === "freelancer" && !readOnly ? (
        <button className={primaryButton} disabled={busy} onClick={() => void perform(() => application.briefs.retryGeneration(actor, room.id))} type="button">
          {text.retry}
        </button>
      ) : null}

      {view?.draft ? (
        <section className="space-y-4" aria-labelledby="brief-draft-heading">
          <div>
            <h3 id="brief-draft-heading">{text.draft}</h3>
            <p className="text-sm text-slate-600">{text.draftHint}</p>
          </div>
          {!readOnly ? (
            <div
              aria-label={text.draftView}
              className="inline-flex gap-1 rounded-lg border border-slate-300 bg-white p-1"
              role="tablist"
            >
              {(["edit", "preview"] as const).map((mode) => (
                <button
                  aria-selected={draftMode === mode}
                  className={`min-h-9 rounded-md px-4 text-sm font-bold transition-colors ${
                    draftMode === mode
                      ? "bg-forest text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                  key={mode}
                  onClick={() => setDraftMode(mode)}
                  role="tab"
                  type="button"
                >
                  {mode === "edit" ? text.edit : text.preview}
                </button>
              ))}
            </div>
          ) : null}
          {!readOnly && draftMode === "edit" ? (
            <>
              <label className="block">
                <span className="sr-only">Project Brief Markdown</span>
                <textarea
                  aria-label="Project Brief Markdown"
                  className="min-h-[60vh] w-full resize-none overflow-hidden rounded-xl border border-slate-300 bg-white p-4 font-mono text-sm leading-6 shadow-sm outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-950/20"
                  onChange={(event) => setMarkdown(event.target.value)}
                  ref={editorRef}
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
          ) : (
            <MarkdownDocument markdown={markdown} />
          )}
          {!readOnly && draftMode === "edit" ? (
            <div className="hidden print:block">
              <MarkdownDocument markdown={markdown} />
            </div>
          ) : null}
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
          setChangeRequest={setChangeRequest}
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

const ReviewDocument = ({
  actor,
  application,
  busy,
  changeRequest,
  perform,
  readOnly,
  review,
  roomId,
  setChangeRequest,
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
  setChangeRequest(value: string): void;
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
    {actor.kind === "freelancer" && !readOnly && review.status === "change_requested" && view.activeChangeRequest ? (
      <button className={primaryButton} disabled={busy} onClick={() => void perform(() => application.briefs.acknowledgeChangeRequest(actor, roomId))} type="button">{text.acknowledgeChange}</button>
    ) : null}
    {actor.kind === "freelancer" && !readOnly && review.status === "approved" ? (
      <button className={ghostButton} disabled={busy} onClick={() => void perform(() => application.briefs.reopen(actor, roomId))} type="button">{text.reopen}</button>
    ) : null}
  </section>
);
