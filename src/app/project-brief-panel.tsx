import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  BRIEF_SECTION_IDS,
  briefSourceKey,
  type BriefEvidenceDetail,
  type BriefItem,
  type BriefItemKind,
  type BriefSection,
  type BriefSource,
  type BriefSectionId,
  type BriefWarning,
  type ProjectBriefView,
  type ReviewVersion,
  type ScopeStatus,
} from "../domain/project-brief";
import type {
  ProjectInterviewer,
  ProjectRoomView,
  RoomActor,
} from "../domain/project-interviewer";
import { useI18n } from "./i18n";

const sourceLabel = (
  source: BriefSource,
  language: "en" | "de",
): string => {
  switch (source.type) {
    case "project_description":
      return language === "de"
        ? "Projektbeschreibung"
        : "Project Description";
    case "turn":
      return language === "de" ? "Interview-Antwort" : "Interview Turn";
    case "correction":
      return language === "de"
        ? "Interview-Korrektur"
        : "Interview Correction";
    case "material":
      return source.locator.label;
    case "analysis_feedback":
      return language === "de" ? "Analysefeedback" : "Analysis Feedback";
    case "model_inference":
      return language === "de" ? "Schlussfolgerung" : "Inference";
    case "freelancer_edit":
      return language === "de" ? "Freelancer-Bearbeitung" : "Freelancer edit";
  }
};

const copy = {
  en: {
    title: "Project Brief",
    available: "Available",
    unavailable: "Not yet available",
    generate: "Generate Project Brief",
    generating: "Generating the source-linked Brief…",
    takingLonger: "Taking longer than usual. Your progress is saved.",
    retry: "Retry Brief generation",
    draft: "Brief Draft",
    save: "Save",
    warnings: "Review warnings",
    acknowledge: "Acknowledge open warning",
    resolve: "Mark warning resolved",
    send: "Send for Client review",
    proposed: "Proposed",
    agreed: "Agreed",
    candidate: "Candidate",
    review: "Review Version",
    approve: "Approve this Review Version",
    approved: "Approved discovery understanding — not a signature or contract.",
    change: "Change Request",
    changePlaceholder: "Describe the revision you need…",
    saveChange: "Save Change Request",
    acknowledgeChange: "Acknowledge and begin revision",
    reopen: "Reopen as private Brief Draft",
    print: "Print / Save as PDF",
    markdown: "Export Markdown",
    addItem: "Add Freelancer-authored requirement",
    add: "Add item",
    inScope: "In scope",
    outScope: "Out of scope",
    open: "Open",
    remove: "Remove",
    moveUp: "Move up",
    moveDown: "Move down",
    history: "Previous Review Versions",
    close: "Close source",
    itemKind: "Item type",
    section: "Section",
    priority: "Priority (not established when blank)",
    retain: "Retain source",
    readOnly: "This archived Project Room is read-only.",
    changeHistory: "Change Request history",
    evidence: "Evidence appendix",
    contentFor: "Content for",
    editItem: "Edit item",
    scopeFor: "Scope for",
    loadingSource: "Loading source…",
    reason: "Reason",
    sourceUnavailable: "The cited source excerpt is unavailable.",
  },
  de: {
    title: "Projektbrief",
    available: "Verfügbar",
    unavailable: "Noch nicht verfügbar",
    generate: "Projektbrief erstellen",
    generating: "Quellengestützter Projektbrief wird erstellt…",
    takingLonger:
      "Dies dauert länger als üblich. Der Fortschritt ist gespeichert.",
    retry: "Brieferstellung wiederholen",
    draft: "Briefentwurf",
    save: "Speichern",
    warnings: "Prüfhinweise",
    acknowledge: "Offenen Hinweis bestätigen",
    resolve: "Hinweis als geklärt markieren",
    send: "Zur Client-Prüfung senden",
    proposed: "Vorgeschlagen",
    agreed: "Abgestimmt",
    candidate: "Kandidat",
    review: "Prüfversion",
    approve: "Diese Prüfversion freigeben",
    approved: "Freigegebenes Discovery-Verständnis — keine Unterschrift und kein Vertrag.",
    change: "Änderungswunsch",
    changePlaceholder: "Beschreiben Sie die benötigte Änderung…",
    saveChange: "Änderungswunsch speichern",
    acknowledgeChange: "Bestätigen und Überarbeitung beginnen",
    reopen: "Als privaten Briefentwurf öffnen",
    print: "Drucken / Als PDF speichern",
    markdown: "Markdown exportieren",
    addItem: "Vom Freelancer verfasste Anforderung hinzufügen",
    add: "Punkt hinzufügen",
    inScope: "Im Umfang",
    outScope: "Außerhalb",
    open: "Offen",
    remove: "Entfernen",
    moveUp: "Nach oben",
    moveDown: "Nach unten",
    history: "Frühere Prüfversionen",
    close: "Quelle schließen",
    itemKind: "Punkttyp",
    section: "Abschnitt",
    priority: "Priorität (leer = nicht festgestellt)",
    retain: "Quelle beibehalten",
    readOnly: "Dieser archivierte Projektraum ist schreibgeschützt.",
    changeHistory: "Verlauf der Änderungswünsche",
    evidence: "Quellenanhang",
    contentFor: "Inhalt für",
    editItem: "Punkt bearbeiten",
    scopeFor: "Umfang für",
    loadingSource: "Quelle wird geladen…",
    reason: "Begründung",
    sourceUnavailable:
      "Der zitierte Quellenauszug ist nicht verfügbar.",
  },
} as const;

type BriefCopy = {
  [Key in keyof (typeof copy)["en"]]: string;
};

type BriefPerformer = (
  action: () => Promise<ProjectBriefView>,
) => Promise<boolean>;

const kindNames = {
  en: {
    requirement: "Requirement",
    target: "Target",
    parameter: "Parameter",
    assumption: "Assumption",
    risk: "Risk",
    gap: "Gap",
    contradiction: "Contradiction",
    decision: "Decision",
  },
  de: {
    requirement: "Anforderung",
    target: "Zielwert",
    parameter: "Parameter",
    assumption: "Annahme",
    risk: "Risiko",
    gap: "Lücke",
    contradiction: "Widerspruch",
    decision: "Entscheidung",
  },
} as const;

const sectionNames: Record<
  "en" | "de",
  Record<BriefSectionId, string>
> = {
  en: {
    "executive-summary": "Executive summary",
    "goals-and-success": "Goals and success",
    "users-and-stakeholders": "Users and stakeholders",
    "in-scope": "In scope",
    "out-of-scope": "Out of scope",
    "functional-requirements": "Functional requirements",
    "quality-and-constraints": "Quality and constraints",
    "ux-content-design": "UX, content, and design",
    "data-and-integrations": "Data and integrations",
    "targets-and-external-constraints":
      "Targets and external constraints",
    "delivery-and-commercial": "Delivery and commercial",
    "open-trade-offs": "Open trade-offs",
    assumptions: "Assumptions",
    risks: "Risks",
    "gaps-and-contradictions": "Gaps and contradictions",
    "key-decisions": "Key decisions",
    "evidence-appendix": "Evidence appendix",
  },
  de: {
    "executive-summary": "Kurzfassung",
    "goals-and-success": "Ziele und Erfolg",
    "users-and-stakeholders": "Nutzer und Stakeholder",
    "in-scope": "Im Umfang",
    "out-of-scope": "Außerhalb des Umfangs",
    "functional-requirements": "Funktionale Anforderungen",
    "quality-and-constraints": "Qualität und Einschränkungen",
    "ux-content-design": "UX, Inhalt und Design",
    "data-and-integrations": "Daten und Integrationen",
    "targets-and-external-constraints":
      "Zielwerte und externe Einschränkungen",
    "delivery-and-commercial": "Lieferung und Kommerzielles",
    "open-trade-offs": "Offene Abwägungen",
    assumptions: "Annahmen",
    risks: "Risiken",
    "gaps-and-contradictions": "Lücken und Widersprüche",
    "key-decisions": "Wichtige Entscheidungen",
    "evidence-appendix": "Quellenanhang",
  },
};

const reviewStatusNames = {
  en: {
    awaiting_client: "Awaiting Client review",
    change_requested: "Change requested",
    approved: "Approved",
    invalidated: "Invalidated by reopened discovery",
  },
  de: {
    awaiting_client: "Client-Prüfung ausstehend",
    change_requested: "Änderung angefordert",
    approved: "Freigegeben",
    invalidated: "Durch erneute Klärung ungültig",
  },
} as const;

const evidenceDisplay = (
  source: BriefSource,
  detail: BriefEvidenceDetail | undefined | null,
  locale: "en" | "de",
): { label: string; text: string } => {
  const label =
    source.type === "material"
      ? detail?.label ?? source.locator.label
      : `${sourceLabel(source, locale)}${
          source.type === "turn" && detail?.sequence
            ? ` ${detail.sequence}`
            : ""
        }`;
  const text =
    detail?.unavailable
      ? copy[locale].sourceUnavailable
      : source.type === "freelancer_edit"
      ? locale === "de"
        ? "Vom Freelancer bearbeiteter Inhalt."
        : "Content edited by the Freelancer."
      : detail?.text ?? "";
  return { label, text };
};

const warningCopy = (
  warning: BriefWarning,
  locale: "en" | "de",
): { category: string; message: string; status: string } => {
  const categories = {
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
  const statuses = {
    en: {
      unresolved: "Unresolved",
      resolved: "Resolved",
      acknowledged: "Acknowledged",
    },
    de: {
      unresolved: "Ungeklärt",
      resolved: "Geklärt",
      acknowledged: "Bestätigt",
    },
  } as const;
  const subject = warning.message.replace(
    /^(?:Scope remains open|Explicit review required):\s*/i,
    "",
  );
  const message =
    locale === "de"
      ? `${categories.de[warning.category]} muss ausdrücklich geprüft werden: ${subject}`
      : `${categories.en[warning.category]} requires explicit review: ${subject}`;
  return {
    category: categories[locale][warning.category],
    message,
    status: statuses[locale][warning.status],
  };
};

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
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [takingLonger, setTakingLonger] = useState(false);
  const [selectedSource, setSelectedSource] =
    useState<BriefSource | null>(null);
  const [sourceDetail, setSourceDetail] =
    useState<BriefEvidenceDetail | null>(null);
  const [markdown, setMarkdown] = useState("");

  const refresh = useCallback(async () => {
    setView(await application.briefs.get(actor, room.id));
  }, [actor, application, room.id]);

  useEffect(() => {
    void refresh().catch((caught) =>
      setError(caught instanceof Error ? caught.message : String(caught)),
    );
  }, [refresh]);

  useEffect(() => {
    if (!selectedSource) {
      setSourceDetail(null);
      return;
    }
    void application.briefs
      .inspectSource(actor, room.id, selectedSource)
      .then(setSourceDetail)
      .catch((caught) =>
        setError(
          caught instanceof Error ? caught.message : String(caught),
        ),
      );
  }, [actor, application, room.id, selectedSource]);

  const generationRunning =
    busy || view?.operation?.status === "running";
  useEffect(() => {
    if (!generationRunning) {
      setTakingLonger(false);
      return;
    }
    const timeout = window.setTimeout(
      () => setTakingLonger(true),
      15_000,
    );
    return () => window.clearTimeout(timeout);
  }, [generationRunning]);

  const perform = async (
    action: () => Promise<ProjectBriefView>,
  ): Promise<boolean> => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const pending = action();
      await Promise.resolve();
      await refresh().catch(() => undefined);
      setView(await pending);
      onRoomChange?.();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      await refresh().catch(() => undefined);
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const reportError = (caught: unknown) => {
    setError(caught instanceof Error ? caught.message : String(caught));
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
      <article className="availability-card" id="brief">
        <div>
          <span className="status-soon">{text.unavailable}</span>
          <h2>{text.title}</h2>
        </div>
      </article>
    );
  }

  return (
    <section
      aria-labelledby="brief-heading"
      className="brief-panel"
      id="brief"
    >
      <header>
        <span className="status-ready">{text.available}</span>
        <h2 id="brief-heading">{text.title}</h2>
      </header>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {readOnly ? <p>{text.readOnly}</p> : null}
      {view === undefined ? <p role="status">{text.generating}</p> : null}
      {view &&
      !view.draft &&
      !view.visibleReviewVersion &&
      actor.kind === "freelancer" &&
      !readOnly ? (
        <button
          className="button primary"
          disabled={busy}
          onClick={() =>
            void perform(() =>
              application.briefs.generate(actor, room.id, {
                idempotencyKey: `brief:${room.id}`,
              }),
            )
          }
          type="button"
        >
          {text.generate}
        </button>
      ) : null}
      {view?.operation?.status === "running" ? (
        <p aria-live="polite" role="status">
          {text.generating}
        </p>
      ) : null}
      {takingLonger ? (
        <p aria-live="polite" role="status">
          {text.takingLonger}
        </p>
      ) : null}
      {view?.operation?.status === "retryable" &&
      actor.kind === "freelancer" &&
      !readOnly ? (
        <button
          className="button primary"
          disabled={busy}
          onClick={() =>
            void perform(() =>
              application.briefs.retryGeneration(actor, room.id),
            )
          }
          type="button"
        >
          {text.retry}
        </button>
      ) : null}

      {view?.draft && !readOnly ? (
        <div className="brief-draft">
          <h3>{text.draft}</h3>
          {view.draft.sections.map((section) => (
            <DraftSection
              actor={actor}
              application={application}
              key={section.id}
              locale={locale}
              busy={busy}
              perform={perform}
              roomId={room.id}
              section={section}
              setSelectedSource={setSelectedSource}
            />
          ))}
          <AddRequirementForm
            actor={actor}
            application={application}
            busy={busy}
            perform={perform}
            roomId={room.id}
            text={text}
          />
          {view.draft.warnings.length ? (
            <section className="brief-warnings">
              <h4>{text.warnings}</h4>
              <ul>
                {view.draft.warnings.map((warning) => (
                  <li key={warning.id}>
                    <strong>
                      {warningCopy(warning, locale).category}
                    </strong>
                    <p>{warningCopy(warning, locale).message}</p>
                    {warning.status === "unresolved" ? (
                      <div className="interview-actions">
                        <button
                          className="button ghost"
                          disabled={busy}
                          onClick={() =>
                            void perform(() =>
                              application.briefs.resolveWarning(
                                actor,
                                room.id,
                                {
                                  warningId: warning.id,
                                  resolution: "acknowledged",
                                  note: "Explicitly retained as open for Client review.",
                                },
                              ),
                            )
                          }
                          type="button"
                        >
                          {text.acknowledge}
                        </button>
                        <button
                          className="button ghost"
                          disabled={busy}
                          onClick={() =>
                            void perform(() =>
                              application.briefs.resolveWarning(
                                actor,
                                room.id,
                                {
                                  warningId: warning.id,
                                  resolution: "resolved",
                                  note: "Resolved during Freelancer review.",
                                },
                              ),
                            )
                          }
                          type="button"
                        >
                          {text.resolve}
                        </button>
                      </div>
                    ) : (
                      <span>
                        {warningCopy(warning, locale).status}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <button
            className="button primary"
            disabled={busy}
            onClick={() =>
              void perform(() =>
                application.briefs.sendForReview(actor, room.id),
              )
            }
            type="button"
          >
            {text.send}
          </button>
        </div>
      ) : null}
      {view?.draft && readOnly ? (
        <article className="brief-draft">
          <h3>{text.draft}</h3>
          {view.draft.sections.map((section) => (
            <ArtifactSection
              key={section.id}
              locale={locale}
              section={section}
              setSelectedSource={setSelectedSource}
              text={text}
            />
          ))}
        </article>
      ) : null}

      {view?.visibleReviewVersion ? (
        <ReviewArtifact
          actor={actor}
          application={application}
          locale={locale}
          busy={busy}
          perform={perform}
          onError={reportError}
          review={view.visibleReviewVersion}
          roomId={room.id}
          setMarkdown={setMarkdown}
          setSelectedSource={setSelectedSource}
          text={text}
          view={view}
          readOnly={readOnly}
        />
      ) : null}
      {view && view.reviewVersions.length > 1 ? (
        <section className="review-history">
          <h3>{text.history}</h3>
          {view.reviewVersions.slice(1).map((review) => (
            <details key={review.id}>
              <summary>
                {text.review} {review.version} ·{" "}
                {reviewStatusNames[locale][review.status]}
              </summary>
              {review.sections.map((section) => (
                <ArtifactSection
                  key={section.id}
                  locale={locale}
                  review={review}
                  section={section}
                  setSelectedSource={setSelectedSource}
                  text={text}
                />
              ))}
            </details>
          ))}
        </section>
      ) : null}
      {view?.changeRequests.length ? (
        <section className="change-request-history">
          <h3>{text.changeHistory}</h3>
          {view.changeRequests.map((request) => (
            <details key={request.id}>
              <summary>
                {text.change} ·{" "}
                {request.status === "acknowledged"
                  ? locale === "de"
                    ? "Bestätigt"
                    : "Acknowledged"
                  : locale === "de"
                    ? "In Bearbeitung"
                    : "Editing"}
              </summary>
              <ol>
                {request.revisions.map((revision) => (
                  <li key={revision.version}>
                    <strong>v{revision.version}</strong>{" "}
                    {revision.text}
                  </li>
                ))}
              </ol>
            </details>
          ))}
        </section>
      ) : null}

      {selectedSource ? (
        <aside className="source-inspector" aria-live="polite">
          <strong>
            {
              evidenceDisplay(
                selectedSource,
                sourceDetail,
                locale,
              ).label
            }
          </strong>
          <p>
            {sourceDetail
              ? evidenceDisplay(
                  selectedSource,
                  sourceDetail,
                  locale,
                ).text
              : text.loadingSource}
          </p>
          {sourceDetail?.reason ? (
            <p>
              <strong>{text.reason}:</strong> {sourceDetail.reason}
            </p>
          ) : null}
          {sourceDetail?.locator ? (
            <small>{sourceDetail.locator}</small>
          ) : null}
          <button
            className="text-button"
            onClick={() => setSelectedSource(null)}
            type="button"
          >
            {text.close}
          </button>
        </aside>
      ) : null}
      {markdown ? (
        <pre className="markdown-export" tabIndex={0}>
          {markdown}
        </pre>
      ) : null}
    </section>
  );
};

const DraftSection = ({
  actor,
  application,
  section,
  roomId,
  locale,
  busy,
  perform,
  setSelectedSource,
}: {
  actor: RoomActor;
  application: ProjectInterviewer;
  section: BriefSection;
  roomId: string;
  locale: "en" | "de";
  busy: boolean;
  perform: BriefPerformer;
  setSelectedSource(source: BriefSource): void;
}) => {
  const text = copy[locale];
  const [content, setContent] = useState(section.content);
  const sectionRef = useRef(section);
  sectionRef.current = section;
  const sourceVersion = section.sources
    .map(briefSourceKey)
    .join("\u0000");
  const [retainedSources, setRetainedSources] = useState(
    () => new Set(section.sources.map(briefSourceKey)),
  );
  useEffect(() => setContent(section.content), [section.content]);
  useEffect(() => {
    setRetainedSources(
      new Set(sectionRef.current.sources.map(briefSourceKey)),
    );
  }, [sourceVersion]);
  return (
    <section className="brief-section">
      <h4>{section.title}</h4>
      <label className="field">
        <span>
          {text.contentFor} {section.title}
        </span>
        <textarea
          onChange={(event) => setContent(event.target.value)}
          value={content}
        />
      </label>
      <div className="source-chips">
        {section.sources.map((source) => {
          const key = briefSourceKey(source);
          return (
            <span key={key}>
              <button
                className="source-chip"
                onClick={() => setSelectedSource(source)}
                type="button"
              >
                {sourceLabel(source, locale)}
              </button>
              <label>
                <input
                  checked={retainedSources.has(key)}
                  onChange={(event) =>
                    setRetainedSources((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(key);
                      else next.delete(key);
                      return next;
                    })
                  }
                  type="checkbox"
                />
                {text.retain}
              </label>
            </span>
          );
        })}
      </div>
      <button
        className="button ghost"
        disabled={busy}
        onClick={() =>
          void perform(() =>
            application.briefs.updateSection(actor, roomId, {
              sectionId: section.id,
              content,
              retainSourceKeys: [...retainedSources],
            }),
          )
        }
        type="button"
      >
        {text.save}
      </button>
      {section.items.length ? (
        <ol className="brief-items">
          {section.items.map((item) => (
            <DraftItem
              actor={actor}
              application={application}
              item={item}
              key={item.id}
              locale={locale}
              busy={busy}
              perform={perform}
              roomId={roomId}
              setSelectedSource={setSelectedSource}
            />
          ))}
        </ol>
      ) : null}
    </section>
  );
};

const DraftItem = ({
  actor,
  application,
  item,
  roomId,
  locale,
  busy,
  perform,
  setSelectedSource,
}: {
  actor: RoomActor;
  application: ProjectInterviewer;
  item: BriefItem;
  roomId: string;
  locale: "en" | "de";
  busy: boolean;
  perform: BriefPerformer;
  setSelectedSource(source: BriefSource): void;
}) => {
  const text = copy[locale];
  const [value, setValue] = useState(item.text);
  const [scope, setScope] = useState<ScopeStatus>(
    item.scopeStatus ?? "open",
  );
  const [kind, setKind] = useState<BriefItemKind>(item.kind);
  const [sectionId, setSectionId] = useState<BriefSectionId>(
    item.sectionId,
  );
  const [priority, setPriority] = useState(item.priority ?? "");
  const [retainedSources, setRetainedSources] = useState(
    () => new Set(item.sources.map(briefSourceKey)),
  );
  const itemRef = useRef(item);
  itemRef.current = item;
  useEffect(() => {
    const persisted = itemRef.current;
    setValue(persisted.text);
    setScope(persisted.scopeStatus ?? "open");
    setKind(persisted.kind);
    setSectionId(persisted.sectionId);
    setPriority(persisted.priority ?? "");
    setRetainedSources(
      new Set(persisted.sources.map(briefSourceKey)),
    );
  }, [item.id, item.updatedAt]);
  return (
    <li>
      <textarea
        aria-label={`${text.editItem}: ${item.text}`}
        onChange={(event) => setValue(event.target.value)}
        value={value}
      />
      <label className="field">
        <span>{text.itemKind}</span>
        <select
          onChange={(event) =>
            setKind(event.target.value as BriefItemKind)
          }
          value={kind}
        >
          {(
            [
              "requirement",
              "target",
              "parameter",
              "assumption",
              "risk",
              "gap",
              "contradiction",
              "decision",
            ] as const
          ).map((option) => (
            <option key={option} value={option}>
              {kindNames[locale][option]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>{text.section}</span>
        <select
          onChange={(event) =>
            setSectionId(event.target.value as BriefSectionId)
          }
          value={sectionId}
        >
          {BRIEF_SECTION_IDS.map((option) => (
            <option key={option} value={option}>
              {sectionNames[locale][option]}
            </option>
          ))}
        </select>
      </label>
      {kind === "requirement" ? (
        <select
          aria-label={`${text.scopeFor}: ${item.text}`}
          onChange={(event) =>
            setScope(event.target.value as ScopeStatus)
          }
          value={scope}
        >
          <option value="in_scope">{text.inScope}</option>
          <option value="out_of_scope">{text.outScope}</option>
          <option value="open">{text.open}</option>
        </select>
      ) : null}
      <label className="field">
        <span>{text.priority}</span>
        <input
          onChange={(event) => setPriority(event.target.value)}
          value={priority}
        />
      </label>
      <div className="source-chips">
        {item.sources.map((source) => {
          const key = briefSourceKey(source);
          return (
          <span key={key}>
            <button
              className="source-chip"
              onClick={() => setSelectedSource(source)}
              type="button"
            >
              {sourceLabel(source, locale)}
            </button>
            <label>
              <input
                checked={retainedSources.has(key)}
                onChange={(event) => {
                  setRetainedSources((current) => {
                    const next = new Set(current);
                    if (event.target.checked) next.add(key);
                    else next.delete(key);
                    return next;
                  });
                }}
                type="checkbox"
              />
              {text.retain}
            </label>
          </span>
          );
        })}
      </div>
      <div className="interview-actions">
        <button
          className="button ghost"
          disabled={busy}
          onClick={() =>
            void perform(() =>
              application.briefs.updateItem(actor, roomId, {
                itemId: item.id,
                sectionId,
                kind,
                text: value,
                ...(kind === "requirement"
                  ? { scopeStatus: scope }
                  : {}),
                priority: priority || null,
                retainSourceKeys: [...retainedSources],
              }),
            )
          }
          type="button"
        >
          {text.save}
        </button>
        {(["up", "down"] as const).map((direction) => (
          <button
            className="button ghost"
            disabled={busy}
            key={direction}
            onClick={() =>
              void perform(() =>
                application.briefs.moveItem(actor, roomId, {
                  itemId: item.id,
                  direction,
                }),
              )
            }
            type="button"
          >
            {direction === "up" ? text.moveUp : text.moveDown}
          </button>
        ))}
        <button
          className="button ghost"
          disabled={busy}
          onClick={() =>
            void perform(() =>
              application.briefs.removeItem(actor, roomId, {
                itemId: item.id,
              }),
            )
          }
          type="button"
        >
          {text.remove}
        </button>
      </div>
    </li>
  );
};

const AddRequirementForm = ({
  actor,
  application,
  roomId,
  busy,
  perform,
  text,
}: {
  actor: RoomActor;
  application: ProjectInterviewer;
  roomId: string;
  busy: boolean;
  perform: BriefPerformer;
  text: BriefCopy;
}) => {
  const [value, setValue] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const succeeded = await perform(() =>
      application.briefs.addItem(actor, roomId, {
        sectionId: "functional-requirements",
        kind: "requirement",
        text: value,
        scopeStatus: "open",
      }),
    );
    if (succeeded) setValue("");
  };
  return (
    <form className="brief-add-item" onSubmit={submit}>
      <label className="field">
        <span>{text.addItem}</span>
        <input
          onChange={(event) => setValue(event.target.value)}
          required
          value={value}
        />
      </label>
      <button className="button ghost" disabled={busy} type="submit">
        {text.add}
      </button>
    </form>
  );
};

const ArtifactSection = ({
  section,
  review,
  locale,
  text,
  setSelectedSource,
}: {
  section: BriefSection;
  review?: ReviewVersion;
  locale: "en" | "de";
  text: BriefCopy;
  setSelectedSource(source: BriefSource): void;
}) => (
  <section className="brief-section">
    <h4>{section.title}</h4>
    <p>{section.content}</p>
    {section.sources.length ? (
      <div className="source-chips">
        {section.sources.map((source) => (
          <button
            className="source-chip"
            key={briefSourceKey(source)}
            onClick={() => setSelectedSource(source)}
            type="button"
          >
            {sourceLabel(source, locale)}
          </button>
        ))}
      </div>
    ) : null}
    {section.items.length ? (
      <ul>
        {section.items.map((item) => {
          const requirementState =
            review?.approval?.agreedRequirementIds.includes(item.id)
              ? "agreed"
              : item.requirementState;
          return (
            <li key={item.id}>
              <p>{item.text}</p>
              {requirementState ? (
                <strong>
                  {
                    {
                      candidate: text.candidate,
                      proposed: text.proposed,
                      agreed: text.agreed,
                      excluded: text.outScope,
                    }[requirementState]
                  }
                </strong>
              ) : null}
              <div className="source-chips">
                {item.sources.map((source) => (
                  <button
                    className="source-chip"
                    key={briefSourceKey(source)}
                    onClick={() => setSelectedSource(source)}
                    type="button"
                  >
                    {sourceLabel(source, locale)}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    ) : null}
  </section>
);

const EvidenceAppendix = ({
  actor,
  application,
  locale,
  roomId,
  sections,
  text,
}: {
  actor: RoomActor;
  application: ProjectInterviewer;
  locale: "en" | "de";
  roomId: string;
  sections: BriefSection[];
  text: BriefCopy;
}) => {
  const sources = useMemo(
    () => [
      ...new Map(
        sections
          .flatMap((section) => [
            ...section.sources,
            ...section.items.flatMap((item) => item.sources),
          ])
          .map((source) => [briefSourceKey(source), source]),
      ).values(),
    ],
    [sections],
  );
  const [details, setDetails] = useState<
    Record<string, BriefEvidenceDetail>
  >({});
  useEffect(() => {
    let active = true;
    void Promise.all(
      sources.map(async (source) => [
        briefSourceKey(source),
        await application.briefs.inspectSource(
          actor,
          roomId,
          source,
        ),
      ] as const),
    ).then((entries) => {
      if (active) setDetails(Object.fromEntries(entries));
    }).catch(() => {
      if (active) setDetails({});
    });
    return () => {
      active = false;
    };
  }, [actor, application, roomId, sources]);
  return (
    <section className="evidence-appendix">
      <h4>{text.evidence}</h4>
      <ol>
        {sources.map((source) => {
          const detail = details[briefSourceKey(source)];
          const display = evidenceDisplay(source, detail, locale);
          return (
            <li key={briefSourceKey(source)}>
              <strong>{display.label}</strong>
              {detail?.locator ? <small>{detail.locator}</small> : null}
              <p>{detail ? display.text : "…"}</p>
              {detail?.reason ? (
                <p>
                  <strong>{text.reason}:</strong> {detail.reason}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
};

const ReviewArtifact = ({
  actor,
  application,
  review,
  roomId,
  locale,
  view,
  text,
  busy,
  perform,
  onError,
  setSelectedSource,
  setMarkdown,
  readOnly,
}: {
  actor: RoomActor;
  application: ProjectInterviewer;
  review: NonNullable<ProjectBriefView["visibleReviewVersion"]>;
  roomId: string;
  locale: "en" | "de";
  view: ProjectBriefView;
  text: BriefCopy;
  busy: boolean;
  perform: BriefPerformer;
  onError(caught: unknown): void;
  setSelectedSource(source: BriefSource): void;
  setMarkdown(value: string): void;
  readOnly: boolean;
}) => {
  const [changeText, setChangeText] = useState(
    view.activeChangeRequest?.revisions.at(-1)?.text ?? "",
  );
  return (
    <article className="review-version">
      <h3>
        {text.review} {review.version}
      </h3>
      {review.status === "approved" ? <p>{text.approved}</p> : null}
      {review.approval ? (
        <p>
          {review.approval.displayName} ·{" "}
          {new Date(review.approval.approvedAt).toLocaleString(locale)}
        </p>
      ) : null}
      {review.sections.map((section) => (
        <ArtifactSection
          key={section.id}
          locale={locale}
          review={review}
          section={section}
          setSelectedSource={setSelectedSource}
          text={text}
        />
      ))}
      <EvidenceAppendix
        actor={actor}
        application={application}
        locale={locale}
        roomId={roomId}
        sections={review.sections}
        text={text}
      />
      <div className="interview-actions">
        <button
          className="button ghost"
          onClick={() => window.print()}
          type="button"
        >
          {text.print}
        </button>
        <button
          className="button ghost"
          onClick={() =>
            void application.briefs
              .exportMarkdown(actor, roomId, {
                artifactId: review.id,
              })
              .then(setMarkdown)
              .catch(onError)
          }
          type="button"
        >
          {text.markdown}
        </button>
      </div>
      {actor.kind === "client" &&
      review.status === "awaiting_client" &&
      !readOnly ? (
        <>
          <button
            className="button primary"
            disabled={busy}
            onClick={() =>
              void perform(() =>
                application.briefs.approve(actor, roomId),
              )
            }
            type="button"
          >
            {text.approve}
          </button>
          <form
            className="change-request"
            onSubmit={(event) => {
              event.preventDefault();
              void perform(() =>
                application.briefs.submitChangeRequest(
                  actor,
                  roomId,
                  { text: changeText },
                ),
              );
            }}
          >
            <label className="field">
              <span>{text.change}</span>
              <textarea
                onChange={(event) =>
                  setChangeText(event.target.value)
                }
                placeholder={text.changePlaceholder}
                required
                value={changeText}
              />
            </label>
            <button
              className="button ghost"
              disabled={busy}
              type="submit"
            >
              {text.saveChange}
            </button>
          </form>
        </>
      ) : null}
      {actor.kind === "client" &&
      view.activeChangeRequest &&
      !readOnly ? (
        <form
          className="change-request"
          onSubmit={(event) => {
            event.preventDefault();
            void perform(() =>
              application.briefs.submitChangeRequest(actor, roomId, {
                text: changeText,
              }),
            );
          }}
        >
          <label className="field">
            <span>{text.change}</span>
            <textarea
              onChange={(event) => setChangeText(event.target.value)}
              value={changeText}
            />
          </label>
          <button
            className="button ghost"
            disabled={busy}
            type="submit"
          >
            {text.saveChange}
          </button>
        </form>
      ) : null}
      {actor.kind === "freelancer" &&
      view.activeChangeRequest &&
      !readOnly ? (
        <button
          className="button primary"
          disabled={busy}
          onClick={() =>
            void perform(() =>
              application.briefs.acknowledgeChangeRequest(
                actor,
                roomId,
              ),
            )
          }
          type="button"
        >
          {text.acknowledgeChange}
        </button>
      ) : null}
      {actor.kind === "freelancer" &&
      review.status === "approved" &&
      !view.draft &&
      !readOnly ? (
        <button
          className="button primary"
          disabled={busy}
          onClick={() =>
            void perform(() =>
              application.briefs.reopen(actor, roomId),
            )
          }
          type="button"
        >
          {text.reopen}
        </button>
      ) : null}
    </article>
  );
};
