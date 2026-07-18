import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type {
  ProjectInterviewer,
  ProjectRoomView,
  RoomActor,
} from "../domain/project-interviewer";
import type { DiscoveryInterviewView } from "../domain/discovery-interview";
import { useI18n } from "./i18n";

const copy = {
  en: {
    intro:
      "Answer one focused question at a time. Accepted answers are saved before the next question is prepared.",
    available: "Available",
    notAvailable: "Not yet available",
    title: "Discovery Interview",
    start: "Start Discovery Interview",
    notStarted: "The Client has not started the interview yet.",
    answer: "Your answer",
    answerPlaceholder: "Share the concrete facts, constraints, or uncertainty…",
    submit: "Save answer and continue",
    skip: "Skip this question",
    pause: "Pause",
    resume: "Resume",
    finish: "Finish early",
    finishConfirm:
      "Finish discovery now and mark the Project Brief as potentially incomplete?",
    takeover: "Take over response permission",
    observer:
      "Another device currently has response permission. This view stays read-only.",
    freelancer:
      "Read-only Client transcript. The Freelancer cannot answer or alter Client turns.",
    processing: "Preparing the next question…",
    takingLonger:
      "Taking longer than expected. Your accepted answer is safe; you can leave this page and return.",
    checkingMaterial:
      "Checking Project Material… Answering will resume when every new file reaches a terminal state.",
    retry: "Retry interrupted step",
    confirmReady: "The interview is ready to complete.",
    confirm: "Confirm completion",
    continue: "Keep interviewing",
    completed: "Discovery is complete.",
    completedEarly: "Discovery was deliberately finished early.",
    transcript: "Accepted answers",
    corrections: "Corrections",
    coverage: "Coverage",
    systemEvents: "System events",
    findings: "Discovery findings",
    correct: "Add correction",
    correctionReason: "Why is this correction needed?",
    correctedAnswer: "Corrected answer",
  },
  de: {
    intro:
      "Beantworten Sie jeweils eine gezielte Frage. Angenommene Antworten werden gespeichert, bevor die nächste Frage vorbereitet wird.",
    available: "Verfügbar",
    notAvailable: "Noch nicht verfügbar",
    title: "Discovery-Interview",
    start: "Discovery-Interview starten",
    notStarted: "Der Client hat das Interview noch nicht gestartet.",
    answer: "Ihre Antwort",
    answerPlaceholder: "Teilen Sie konkrete Fakten, Grenzen oder Unsicherheiten mit…",
    submit: "Antwort speichern und fortfahren",
    skip: "Diese Frage überspringen",
    pause: "Pausieren",
    resume: "Fortsetzen",
    finish: "Vorzeitig beenden",
    finishConfirm:
      "Discovery jetzt beenden und den Project Brief als möglicherweise unvollständig markieren?",
    takeover: "Antwortberechtigung übernehmen",
    observer:
      "Ein anderes Gerät hat derzeit die Antwortberechtigung. Diese Ansicht bleibt schreibgeschützt.",
    freelancer:
      "Schreibgeschütztes Client-Protokoll. Der Freelancer kann Client-Antworten weder beantworten noch verändern.",
    processing: "Nächste Frage wird vorbereitet…",
    takingLonger:
      "Das dauert länger als erwartet. Ihre angenommene Antwort ist sicher gespeichert; Sie können später zurückkehren.",
    checkingMaterial:
      "Projektmaterial wird geprüft… Antworten sind wieder möglich, sobald jede neue Datei einen Endzustand erreicht.",
    retry: "Unterbrochenen Schritt wiederholen",
    confirmReady: "Das Interview kann abgeschlossen werden.",
    confirm: "Abschluss bestätigen",
    continue: "Interview fortsetzen",
    completed: "Discovery ist abgeschlossen.",
    completedEarly: "Discovery wurde bewusst vorzeitig beendet.",
    transcript: "Angenommene Antworten",
    corrections: "Korrekturen",
    coverage: "Abdeckung",
    systemEvents: "Systemereignisse",
    findings: "Discovery-Erkenntnisse",
    correct: "Korrektur hinzufügen",
    correctionReason: "Warum ist diese Korrektur nötig?",
    correctedAnswer: "Korrigierte Antwort",
  },
} as const;

const operationId = (): string =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

export const DiscoveryInterviewPanel = ({
  application,
  actor,
  room,
  available,
  onRoomChange,
}: {
  application: ProjectInterviewer;
  actor: RoomActor;
  room: ProjectRoomView;
  available: boolean;
  onRoomChange?(): void;
}) => {
  const { locale } = useI18n();
  const text = copy[locale];
  const [interview, setInterview] =
    useState<DiscoveryInterviewView | null>();
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [takingLonger, setTakingLonger] = useState(false);
  const [correctingTurnId, setCorrectingTurnId] = useState("");
  const [correctedAnswer, setCorrectedAnswer] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const wasResponding = useRef(false);

  const refresh = useCallback(async () => {
    setInterview(await application.interviews.get(actor, room.id));
  }, [actor, application, room.id]);

  useEffect(() => {
    void refresh().catch((caught) =>
      setError(caught instanceof Error ? caught.message : String(caught)),
    );
  }, [refresh]);

  useEffect(() => {
    if (
      !interview ||
      ["completed", "completed_early"].includes(interview.status)
    ) {
      return;
    }
    const poll = async () => {
      try {
        if (
          actor.kind === "client" &&
          interview.respondingDevice
        ) {
          await application.interviews.heartbeat(actor, room.id);
        }
        await refresh();
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : String(caught),
        );
      }
    };
    const timer = window.setInterval(() => void poll(), 1_500);
    return () => window.clearInterval(timer);
  }, [actor, application, interview, refresh, room.id]);

  useEffect(() => {
    if (wasResponding.current && interview?.respondingDevice === false) {
      setAnswer("");
      setCorrectingTurnId("");
      setCorrectedAnswer("");
      setCorrectionReason("");
    }
    wasResponding.current = interview?.respondingDevice ?? false;
  }, [interview?.respondingDevice]);

  useEffect(() => {
    if (!busy && interview?.operationStatus !== "running") {
      setTakingLonger(false);
      return;
    }
    const timer = window.setTimeout(
      () => setTakingLonger(true),
      15_000,
    );
    return () => window.clearTimeout(timer);
  }, [busy, interview?.operationStatus]);

  const perform = async (
    action: () => Promise<DiscoveryInterviewView>,
  ): Promise<boolean> => {
    setBusy(true);
    setError("");
    try {
      const pending = action();
      await Promise.resolve();
      await refresh().catch(() => undefined);
      const next = await pending;
      setInterview(next);
      onRoomChange?.();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      await refresh().catch(() => undefined);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!interview?.currentQuestion) return;
    const succeeded = await perform(async () => {
      const contextPack = await application.contextPacks.latest(
        actor,
        room.id,
      );
      return application.interviews.submitAnswer(actor, room.id, {
        questionId: interview.currentQuestion!.id,
        answer,
        idempotencyKey: `answer:${operationId()}`,
        contextPackRevisionId: contextPack?.id ?? null,
      });
    });
    if (succeeded) setAnswer("");
  };

  const skip = async () => {
    if (!interview?.currentQuestion) return;
    await perform(async () => {
      const contextPack = await application.contextPacks.latest(
        actor,
        room.id,
      );
      return application.interviews.skip(actor, room.id, {
        questionId: interview.currentQuestion!.id,
        idempotencyKey: `skip:${operationId()}`,
        contextPackRevisionId: contextPack?.id ?? null,
      });
    });
  };

  const addCorrection = async (event: FormEvent) => {
    event.preventDefault();
    const succeeded = await perform(() =>
      application.interviews.correct(actor, room.id, {
        turnId: correctingTurnId,
        correctedAnswer,
        reason: correctionReason,
      }),
    );
    if (succeeded) {
      setCorrectingTurnId("");
      setCorrectedAnswer("");
      setCorrectionReason("");
    }
  };

  const operationLabel = interview?.operation
    ? {
        accepted:
          locale === "de" ? "Antwort gespeichert" : "Answer saved",
        planning:
          locale === "de"
            ? "Interviewplan wird erstellt…"
            : "Creating the Interview Plan…",
        reasoning:
          locale === "de"
            ? "Antwort wird ausgewertet…"
            : "Evaluating the accepted answer…",
        reviewing:
          locale === "de"
            ? "Abdeckung wird geprüft…"
            : "Reviewing discovery coverage…",
        complete:
          interview.operation.status === "retryable"
            ? locale === "de"
              ? "Schritt kann wiederholt werden"
              : "Step can be retried"
            : locale === "de"
              ? "Schritt abgeschlossen"
              : "Step completed",
      }[interview.operation.stage] ??
      (locale === "de" ? "Interview wird verarbeitet…" : "Processing interview…")
    : text.processing;

  if (!available && !interview) {
    return (
      <article className="availability-card" id="interview">
        <div>
          <span className="status-soon">{text.notAvailable}</span>
          <h2>{text.title}</h2>
          <p>{text.intro}</p>
        </div>
      </article>
    );
  }

  return (
    <section
      className="interview-panel"
      id="interview"
      aria-labelledby="interview-heading"
    >
      <header>
        <span className="status-ready">{text.available}</span>
        <h2 id="interview-heading">{text.title}</h2>
        <p>{text.intro}</p>
      </header>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {interview === undefined ? (
        <p role="status">{text.processing}</p>
      ) : null}
      {interview === null ? (
        actor.kind === "client" ? (
          <button
            className="button primary"
            disabled={busy}
            onClick={() =>
              void perform(() =>
                application.interviews.start(actor, room.id),
              )
            }
            type="button"
          >
            {text.start}
          </button>
        ) : (
          <p>{text.notStarted}</p>
        )
      ) : null}
      {interview ? (
        <>
          {actor.kind === "freelancer" ? (
            <p className="interview-notice">{text.freelancer}</p>
          ) : !interview.respondingDevice ? (
            <div className="interview-notice" role="status">
              <p>{text.observer}</p>
              <button
                className="button ghost"
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      locale === "de"
                        ? "Nicht gespeicherte Entwürfe auf dem anderen Gerät können verloren gehen. Übernehmen?"
                        : "Unsaved drafts on the other device may be lost. Take over?",
                    )
                  ) {
                    void perform(() =>
                      application.interviews.takeover(actor, room.id, {
                        acknowledgedDraftLoss: true,
                      }),
                    ).then((succeeded) => {
                      if (succeeded) setAnswer("");
                    });
                  }
                }}
              >
                {text.takeover}
              </button>
            </div>
          ) : null}

          <div aria-live="polite">
            {busy || interview.operationStatus === "running"
              ? operationLabel
              : ""}
          </div>
          {takingLonger ? (
            <p className="interview-notice" role="status">
              {text.takingLonger}
            </p>
          ) : null}

          {!available &&
          interview.status === "active" &&
          actor.kind === "client" &&
          interview.respondingDevice ? (
            <p className="interview-notice" role="status">
              {text.checkingMaterial}
            </p>
          ) : null}

          {interview.coverage.length ? (
            <div className="interview-coverage">
              <h3>{text.coverage}</h3>
              <ul>
                {interview.coverage.map((area) => (
                  <li key={area.id}>
                    <span>{area.label}</span>{" "}
                    <strong>
                      {
                        {
                          uncovered:
                            locale === "de"
                              ? "nicht geklärt"
                              : "uncovered",
                          partial:
                            locale === "de"
                              ? "teilweise geklärt"
                              : "partial",
                          sufficient:
                            locale === "de"
                              ? "ausreichend"
                              : "sufficient",
                          not_applicable:
                            locale === "de"
                              ? "nicht zutreffend"
                              : "not applicable",
                        }[area.status]
                      }
                    </strong>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {interview.events.length ? (
            <div className="interview-events">
              <h3>{text.systemEvents}</h3>
              <ol>
                {interview.events.map((event) => (
                  <li key={event.id}>
                    {locale === "de"
                      ? `Projektmaterial wurde hinzugefügt. Zukünftige Antworten verwenden Kontextrevision ${event.contextPackRevision}.`
                      : `Project Material was added. Future answers use Context Pack revision ${event.contextPackRevision}.`}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {interview.status === "retryable" &&
          actor.kind === "client" &&
          interview.respondingDevice ? (
            <button
              className="button primary"
              type="button"
              onClick={() =>
                void perform(() =>
                  application.interviews.retryPending(actor, room.id),
                )
              }
            >
              {text.retry}
            </button>
          ) : null}

          {interview.status === "paused" &&
          actor.kind === "client" &&
          interview.respondingDevice ? (
            <button
              className="button primary"
              type="button"
              onClick={() =>
                void perform(() =>
                  application.interviews.resume(actor, room.id),
                )
              }
            >
              {text.resume}
            </button>
          ) : null}

          {interview.status === "awaiting_confirmation" ? (
            <div className="interview-confirmation">
              <p>{text.confirmReady}</p>
              {actor.kind === "client" && interview.respondingDevice ? (
                <div className="interview-actions">
                  <button
                    className="button primary"
                    type="button"
                    onClick={() =>
                      void perform(() =>
                        application.interviews.confirmCompletion(
                          actor,
                          room.id,
                          { confirmed: true },
                        ),
                      )
                    }
                  >
                    {text.confirm}
                  </button>
                  <button
                    className="button ghost"
                    type="button"
                    onClick={() =>
                      void perform(() =>
                        application.interviews.confirmCompletion(
                          actor,
                          room.id,
                          { confirmed: false },
                        ),
                      )
                    }
                  >
                    {text.continue}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {interview.status === "completed" ? <p>{text.completed}</p> : null}
          {interview.status === "completed_early" ? (
            <p>
              {text.completedEarly} {interview.incompleteReason}
            </p>
          ) : null}

          {interview.status === "active" &&
          interview.currentQuestion &&
          available &&
          actor.kind === "client" &&
          interview.respondingDevice ? (
            <form className="interview-question" onSubmit={submit}>
              <p className="eyebrow">
                {locale === "de" ? "Nächste Frage" : "Next question"}
              </p>
              <h3>{interview.currentQuestion.text}</h3>
              <label className="field">
                <span>{text.answer}</span>
                <textarea
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  placeholder={text.answerPlaceholder}
                  required
                  rows={5}
                />
              </label>
              <div className="interview-actions">
                <button
                  className="button primary"
                  disabled={busy}
                  type="submit"
                >
                  {text.submit}
                </button>
                <button
                  className="button ghost"
                  disabled={busy}
                  onClick={() => void skip()}
                  type="button"
                >
                  {text.skip}
                </button>
              </div>
            </form>
          ) : interview.status === "active" &&
            interview.currentQuestion ? (
            <div className="interview-question">
              <h3>{interview.currentQuestion.text}</h3>
            </div>
          ) : null}

          {actor.kind === "client" &&
          interview.respondingDevice &&
          interview.status === "active" ? (
            <div className="interview-actions secondary-actions">
              <button
                className="button ghost"
                type="button"
                onClick={() =>
                  void perform(() =>
                    application.interviews.pause(actor, room.id),
                  )
                }
              >
                {text.pause}
              </button>
              <button
                className="button ghost"
                type="button"
                onClick={() => {
                  if (window.confirm(text.finishConfirm)) {
                    void perform(() =>
                      application.interviews.finishEarly(actor, room.id, {
                        confirmed: true,
                      }),
                    );
                  }
                }}
              >
                {text.finish}
              </button>
            </div>
          ) : null}

          {interview.turns.length ? (
            <div className="interview-transcript">
              <h3>{text.transcript}</h3>
              <ol>
                {interview.turns.map((turn) => (
                  <li key={turn.id}>
                    <strong>{turn.question.text}</strong>
                    <p>{turn.answer}</p>
                    {interview.corrections.some(
                      ({ turnId }) => turnId === turn.id,
                    ) ? (
                      <small>
                        {locale === "de"
                          ? "Durch eine unveränderliche Client-Korrektur ersetzt; die ursprüngliche Antwort bleibt sichtbar."
                          : "Superseded by an immutable Client correction; the original answer remains visible."}
                      </small>
                    ) : null}
                    {actor.kind === "client" &&
                    interview.respondingDevice &&
                    interview.operationStatus !== "running" &&
                    !["completed", "completed_early"].includes(
                      interview.status,
                    ) ? (
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => {
                          setCorrectingTurnId(turn.id);
                          setCorrectedAnswer(turn.answer);
                        }}
                      >
                        {text.correct}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {interview.findings.length ? (
            <div className="interview-findings">
              <h3>{text.findings}</h3>
              <ul>
                {interview.findings.map((finding) => (
                  <li key={finding.id}>
                    <strong>
                      {
                        {
                          candidate_requirement:
                            locale === "de"
                              ? "Mögliche Anforderung"
                              : "Candidate requirement",
                          assumption:
                            locale === "de"
                              ? "Annahme"
                              : "Assumption",
                          risk:
                            locale === "de" ? "Risiko" : "Risk",
                          gap:
                            locale === "de" ? "Lücke" : "Gap",
                          contradiction:
                            locale === "de"
                              ? "Widerspruch"
                              : "Contradiction",
                        }[finding.type]
                      }
                    </strong>
                    <p>{finding.statement}</p>
                    <small>
                      {locale === "de" ? "Quellen: " : "Sources: "}
                      {finding.sources
                        .map((source) => {
                          switch (source.type) {
                            case "material":
                              return source.locator.label;
                            case "turn":
                              return (
                                interview.turns.find(
                                  ({ id }) => id === source.turnId,
                                )?.question.text ?? "Interview turn"
                              );
                            case "correction":
                              return locale === "de"
                                ? "Client-Korrektur"
                                : "Client correction";
                            case "analysis_feedback":
                              return locale === "de"
                                ? "Analysefeedback"
                                : "Analysis feedback";
                            case "model_inference":
                              return locale === "de"
                                ? "Modellschlussfolgerung"
                                : "Model inference";
                          }
                        })
                        .join(" · ")}
                    </small>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {correctingTurnId &&
          actor.kind === "client" &&
          interview.respondingDevice ? (
            <form className="correction-form" onSubmit={addCorrection}>
              <h3>{text.correct}</h3>
              <label className="field">
                <span>{text.correctedAnswer}</span>
                <textarea
                  required
                  value={correctedAnswer}
                  onChange={(event) =>
                    setCorrectedAnswer(event.target.value)
                  }
                />
              </label>
              <label className="field">
                <span>{text.correctionReason}</span>
                <input
                  required
                  value={correctionReason}
                  onChange={(event) =>
                    setCorrectionReason(event.target.value)
                  }
                />
              </label>
              <button className="button primary" type="submit">
                {text.correct}
              </button>
            </form>
          ) : null}

          {interview.corrections.length ? (
            <div className="interview-corrections">
              <h3>{text.corrections}</h3>
              <ul>
                {interview.corrections.map((correction) => (
                  <li key={correction.id}>
                    {correction.correctedAnswer}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
};
