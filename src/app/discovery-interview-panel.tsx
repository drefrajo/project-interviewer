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
import type {
  DiscoveryInterviewView,
  DiscoveryFinding,
  InterviewQuestion,
  InterviewTurn,
  InterviewTurnEntry,
} from "../domain/discovery-interview";
import { useI18n } from "./i18n";
import { WorkingIndicator } from "./working-indicator";

const copy = {
  en: {
    intro:
      "Let’s talk about your project. I’ll ask a few questions at a time — just answer in your own words. If you don’t know something, mark it as “I’m not sure” and move on.",
    available: "Available",
    notAvailable: "Not yet available",
    title: "Interview",
    start: "Start the conversation",
    notStarted: "The client has not started the conversation yet.",
    answerPlaceholder: "Your answer…",
    notSure: "I’m not sure",
    notSureMarked: "Marked as “I’m not sure”",
    answeredProgress: "{answered} of {total} answered",
    submit: "Send answers",
    pause: "Pause conversation",
    resume: "Resume conversation",
    finish: "Finish early",
    finishConfirm:
      "Finish the interview now? The project brief may be less complete.",
    takeover: "Take over answering",
    observer:
      "Another device can answer right now. You can follow the conversation here or take over.",
    freelancer:
      "You are viewing the client’s conversation. Only the client’s answering device can reply or make corrections.",
    workingLabel: "Working on the next questions",
    startingLabel: "Getting the conversation ready",
    thinking: [
      "Thinking…",
      "Finding the next questions…",
      "Connecting the dots…",
      "Imagining something great…",
      "Putting it all together…",
    ],
    starting: [
      "Getting the conversation ready…",
      "Reading what we know so far…",
      "Preparing your questions…",
    ],
    takingLonger:
      "This is taking a little longer. Your answers are saved, so it’s safe to leave and come back.",
    checkingMaterial:
      "I’m reading the new files before we continue. You can come back once they’re ready.",
    retry: "Try again",
    interrupted: "The last step was interrupted.",
    paused: "The conversation is paused.",
    confirmReady:
      "I think I have everything I need to prepare the project brief. Shall we finish here, or is there more you’d like to add?",
    confirm: "Yes, we’re done",
    continue: "I’d like to add more",
    completed:
      "Thank you — that’s everything! The freelancer will now review what we discussed and prepare the project brief.",
    completedEarly:
      "This conversation was finished early, so the project brief may still have open questions.",
    correction: "Correction",
    coverage: "Coverage",
    systemEvents: "Project Material events",
    findings: "Discovery findings",
    details: "Discovery details",
    detailsHint:
      "Structured discovery state for Freelancer review. This is not shown in the Client’s conversation.",
    conversationActions: "Conversation options",
    correct: "Correct this answer",
    cancelCorrection: "Cancel",
    correctionReason: "What changed?",
    correctedAnswer: "Corrected answer",
    client: "You",
    assistant: "Interviewer",
    skipped: "I’m not sure.",
    saved: "Saved",
    originalAnswer: "Original answer",
    operation: "Current operation",
    otherQuestions:
      "Questions waiting for the client’s answers:",
  },
  de: {
    intro:
      "Lassen Sie uns über Ihr Projekt sprechen. Ich stelle Ihnen ein paar Fragen auf einmal — antworten Sie einfach in Ihren eigenen Worten. Wenn Sie etwas nicht wissen, wählen Sie „Ich bin nicht sicher“.",
    available: "Verfügbar",
    notAvailable: "Noch nicht verfügbar",
    title: "Interview",
    start: "Gespräch beginnen",
    notStarted: "Der Client hat das Gespräch noch nicht begonnen.",
    answerPlaceholder: "Ihre Antwort…",
    notSure: "Ich bin nicht sicher",
    notSureMarked: "Als „Ich bin nicht sicher“ markiert",
    answeredProgress: "{answered} von {total} beantwortet",
    submit: "Antworten senden",
    pause: "Gespräch pausieren",
    resume: "Gespräch fortsetzen",
    finish: "Vorzeitig beenden",
    finishConfirm:
      "Das Interview jetzt beenden? Der Projektbrief kann dann weniger vollständig sein.",
    takeover: "Antworten übernehmen",
    observer:
      "Ein anderes Gerät kann derzeit antworten. Sie können dem Gespräch hier folgen oder es übernehmen.",
    freelancer:
      "Sie sehen das Gespräch des Clients. Nur das Antwortgerät des Clients kann antworten oder Korrekturen vornehmen.",
    workingLabel: "Die nächsten Fragen werden vorbereitet",
    startingLabel: "Das Gespräch wird vorbereitet",
    thinking: [
      "Ich denke nach…",
      "Ich suche die nächsten Fragen…",
      "Ich verbinde die Punkte…",
      "Ich stelle mir etwas Großartiges vor…",
      "Ich füge alles zusammen…",
    ],
    starting: [
      "Ich bereite das Gespräch vor…",
      "Ich lese, was wir bisher wissen…",
      "Ich bereite Ihre Fragen vor…",
    ],
    takingLonger:
      "Das dauert etwas länger. Ihre Antworten sind gespeichert; Sie können die Seite sicher verlassen und später zurückkehren.",
    checkingMaterial:
      "Ich lese die neuen Dateien, bevor wir weitermachen. Sie können zurückkommen, sobald sie bereit sind.",
    retry: "Erneut versuchen",
    interrupted: "Der letzte Schritt wurde unterbrochen.",
    paused: "Das Gespräch ist pausiert.",
    confirmReady:
      "Ich denke, ich habe alles, was ich für den Projektbrief brauche. Sollen wir hier aufhören, oder möchten Sie noch etwas hinzufügen?",
    confirm: "Ja, wir sind fertig",
    continue: "Ich möchte noch etwas hinzufügen",
    completed:
      "Vielen Dank — das war alles! Der Freelancer prüft jetzt unser Gespräch und erstellt den Projektbrief.",
    completedEarly:
      "Dieses Gespräch wurde vorzeitig beendet. Im Projektbrief können noch offene Fragen verbleiben.",
    correction: "Korrektur",
    coverage: "Abdeckung",
    systemEvents: "Projektmaterial-Ereignisse",
    findings: "Discovery-Erkenntnisse",
    details: "Discovery-Details",
    detailsHint:
      "Strukturierter Discovery-Stand für die Prüfung durch den Freelancer. Clients sehen diese Daten nicht im Gespräch.",
    conversationActions: "Gesprächsoptionen",
    correct: "Diese Antwort korrigieren",
    cancelCorrection: "Abbrechen",
    correctionReason: "Was hat sich geändert?",
    correctedAnswer: "Korrigierte Antwort",
    client: "Sie",
    assistant: "Interviewer",
    skipped: "Ich bin nicht sicher.",
    saved: "Gespeichert",
    originalAnswer: "Ursprüngliche Antwort",
    operation: "Aktueller Vorgang",
    otherQuestions:
      "Diese Fragen warten auf die Antworten des Clients:",
  },
} as const;

const primaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-lg border border-transparent bg-[var(--green)] px-4 py-2.5 font-bold text-white transition hover:bg-[#0f3d2f] disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--line)] bg-white px-4 py-2.5 font-bold text-[var(--ink)] transition hover:bg-[#f4f3ed] disabled:cursor-not-allowed disabled:opacity-50";
const textButton =
  "inline-flex min-h-9 items-center rounded-md px-2 py-1 text-sm font-bold text-[var(--green)] underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-50";

const operationId = (): string =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

const findingLabel = (
  finding: DiscoveryFinding,
  locale: "en" | "de",
): string =>
  ({
    candidate_requirement:
      locale === "de" ? "Mögliche Anforderung" : "Candidate requirement",
    assumption: locale === "de" ? "Annahme" : "Assumption",
    risk: locale === "de" ? "Risiko" : "Risk",
    gap: locale === "de" ? "Lücke" : "Gap",
    contradiction: locale === "de" ? "Widerspruch" : "Contradiction",
  })[finding.type];

const questionBatchOf = (
  interview: DiscoveryInterviewView,
): InterviewQuestion[] =>
  interview.currentQuestions?.length
    ? interview.currentQuestions
    : interview.currentQuestion
      ? [interview.currentQuestion]
      : [];

const entriesOf = (turn: InterviewTurn): InterviewTurnEntry[] =>
  turn.entries?.length
    ? turn.entries
    : [
        {
          questionId: turn.question.id,
          questionText: turn.question.text,
          answer: turn.answer,
          answerKind: turn.answerKind,
        },
      ];

export const DiscoveryInterviewPanel = ({
  application,
  actor,
  room,
  available,
  readOnly,
  onRoomChange,
}: {
  application: ProjectInterviewer;
  actor: RoomActor;
  room: ProjectRoomView;
  available: boolean;
  readOnly: boolean;
  onRoomChange?(): void;
}) => {
  const { locale } = useI18n();
  const text = copy[locale];
  const canRespond = actor.kind === "client" && !readOnly;
  const [interview, setInterview] =
    useState<DiscoveryInterviewView | null>();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [unsure, setUnsure] = useState<Record<string, boolean>>({});
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
        if (canRespond && interview.respondingDevice) {
          await application.interviews.heartbeat(actor, room.id);
        }
        await refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    };
    const timer = window.setInterval(() => void poll(), 1_500);
    return () => window.clearInterval(timer);
  }, [actor, application, canRespond, interview, refresh, room.id]);

  const batch = interview ? questionBatchOf(interview) : [];
  const batchKey = batch.map(({ id }) => id).join("|");

  useEffect(() => {
    setDrafts({});
    setUnsure({});
  }, [batchKey]);

  useEffect(() => {
    if (wasResponding.current && interview?.respondingDevice === false) {
      setDrafts({});
      setUnsure({});
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
    const timer = window.setTimeout(() => setTakingLonger(true), 15_000);
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

  const answeredCount = batch.filter(
    ({ id }) => unsure[id] || (drafts[id] ?? "").trim(),
  ).length;
  const canSubmit =
    batch.length > 0 && answeredCount === batch.length && !busy;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!interview || !canSubmit) return;
    const succeeded = await perform(async () => {
      const contextPack = await application.contextPacks.latest(
        actor,
        room.id,
      );
      return application.interviews.submitAnswers(actor, room.id, {
        entries: batch.map(({ id }) => ({
          questionId: id,
          answer: unsure[id] ? "" : (drafts[id] ?? "").trim(),
          answerKind: (unsure[id] ? "skip" : "answer") as
            | "skip"
            | "answer",
        })),
        idempotencyKey: `answers:${operationId()}`,
        contextPackRevisionId: contextPack?.id ?? null,
      });
    });
    if (succeeded) {
      setDrafts({});
      setUnsure({});
    }
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

  const beginCorrection = (turn: InterviewTurn) => {
    setCorrectingTurnId(turn.id);
    setCorrectedAnswer(
      entriesOf(turn)
        .filter((entry) => entry.answerKind === "answer")
        .map((entry) => entry.answer)
        .join("\n"),
    );
    setCorrectionReason("");
  };

  const operationLabel = interview?.operation
    ? {
        accepted: locale === "de" ? "Antwort gespeichert" : "Answer saved",
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
      (locale === "de"
        ? "Interview wird verarbeitet…"
        : "Processing interview…")
    : text.workingLabel;

  const canCorrect =
    canRespond &&
    interview?.respondingDevice &&
    interview.operationStatus !== "running" &&
    !["completed", "completed_early"].includes(interview.status);

  const showAnswerForm = Boolean(
    interview &&
      interview.status === "active" &&
      batch.length &&
      available &&
      canRespond &&
      interview.respondingDevice &&
      interview.operationStatus !== "running",
  );

  if (!available && !interview) {
    return (
      <article
        className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6"
        id="interview"
      >
        <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--muted)]">
          {text.notAvailable}
        </span>
        <h2 className="mt-2 text-2xl">{text.title}</h2>
        <p className="mb-0 max-w-2xl text-[var(--muted)]">{text.intro}</p>
      </article>
    );
  }

  return (
    <section
      className="mx-auto max-w-4xl"
      id="interview"
      aria-labelledby="interview-heading"
    >
      <header className="mb-6 border-b border-[var(--line)] pb-5">
        <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--green)]">
          {text.available}
        </span>
        <h2 className="mb-2 mt-2 text-3xl" id="interview-heading">
          {text.title}
        </h2>
        <p className="mb-0 max-w-2xl text-[var(--muted)]">{text.intro}</p>
      </header>

      {error ? (
        <p
          className="mb-5 rounded-lg border border-red-300 bg-red-50 p-4 text-red-900"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {interview === undefined ? (
        <p className="text-[var(--muted)]">
          <WorkingIndicator
            label={text.startingLabel}
            phrases={text.starting}
          />
        </p>
      ) : null}

      {interview === null ? (
        canRespond ? (
          <button
            className={primaryButton}
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
          <p className="rounded-lg bg-[#f4f3ed] p-4">{text.notStarted}</p>
        )
      ) : null}

      {interview ? (
        <>
          {actor.kind === "freelancer" ? (
            <p className="mb-5 rounded-lg border border-[var(--line)] bg-[#f4f3ed] p-4 text-sm text-[var(--muted)]">
              {text.freelancer}
            </p>
          ) : canRespond && !interview.respondingDevice ? (
            <div
              className="mb-5 rounded-lg border border-amber-300 bg-amber-50 p-4"
              role="status"
            >
              <p>{text.observer}</p>
              <button
                className={secondaryButton}
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
                      if (succeeded) {
                        setDrafts({});
                        setUnsure({});
                      }
                    });
                  }
                }}
              >
                {text.takeover}
              </button>
            </div>
          ) : null}

          <ol
            aria-label={text.title}
            aria-live="polite"
            className="m-0 flex list-none flex-col gap-5 p-0"
          >
            {interview.turns.map((turn) => {
              const corrections = interview.corrections.filter(
                ({ turnId }) => turnId === turn.id,
              );
              const entries = entriesOf(turn);
              return (
                <li className="contents" key={turn.id}>
                  <article
                    aria-label={text.assistant}
                    className="mr-auto max-w-[min(42rem,92%)]"
                  >
                    <span className="mb-1 block text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">
                      {text.assistant}
                    </span>
                    <div className="rounded-2xl rounded-tl-sm border border-[var(--line)] bg-white px-5 py-4 shadow-sm">
                      {entries.length > 1 ? (
                        <ol className="m-0 list-decimal space-y-2 pl-5">
                          {entries.map((entry) => (
                            <li
                              className="text-lg leading-7"
                              key={entry.questionId}
                            >
                              {entry.questionText}
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <h3 className="m-0 text-lg leading-7">
                          {entries[0]!.questionText}
                        </h3>
                      )}
                    </div>
                  </article>

                  <article
                    aria-label={text.client}
                    className="ml-auto max-w-[min(42rem,92%)]"
                  >
                    <span className="mb-1 block text-right text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--green)]">
                      {text.client}
                    </span>
                    <div className="rounded-2xl rounded-tr-sm bg-[var(--green)] px-5 py-4 text-white shadow-sm">
                      {entries.length > 1 ? (
                        <ol className="m-0 list-none space-y-3 p-0">
                          {entries.map((entry) => (
                            <li key={entry.questionId}>
                              <span className="mb-1 block text-xs font-bold text-white/70">
                                {entry.questionText}
                              </span>
                              <p className="m-0 whitespace-pre-wrap">
                                {entry.answerKind === "skip"
                                  ? text.skipped
                                  : entry.answer}
                              </p>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="m-0 whitespace-pre-wrap">
                          {entries[0]!.answerKind === "skip"
                            ? text.skipped
                            : entries[0]!.answer}
                        </p>
                      )}
                      <span className="mt-3 block text-xs font-bold text-white/70">
                        {text.saved}
                      </span>
                    </div>

                    {corrections.map((correction) => (
                      <div
                        className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[var(--ink)]"
                        key={correction.id}
                      >
                        <strong className="text-sm text-[var(--green)]">
                          {text.correction}
                        </strong>
                        <p className="mb-1 mt-2 whitespace-pre-wrap">
                          {correction.correctedAnswer}
                        </p>
                        <small className="text-[var(--muted)]">
                          {correction.reason}
                        </small>
                      </div>
                    ))}

                    {correctingTurnId === turn.id ? (
                      <form
                        className="mt-3 rounded-xl border border-[var(--line)] bg-white p-4 shadow-sm"
                        onSubmit={addCorrection}
                      >
                        <h4 className="mb-3 mt-0">{text.correct}</h4>
                        <p className="mb-3 text-xs text-[var(--muted)]">
                          {text.originalAnswer}:{" "}
                          {entries
                            .map((entry) =>
                              entry.answerKind === "skip"
                                ? text.skipped
                                : entry.answer,
                            )
                            .join(" · ")}
                        </p>
                        <label className="mb-3 block">
                          <span className="mb-1 block text-sm font-bold">
                            {text.correctedAnswer}
                          </span>
                          <textarea
                            className="min-h-28 w-full resize-y border border-[var(--line)] bg-white p-3"
                            required
                            value={correctedAnswer}
                            onChange={(event) =>
                              setCorrectedAnswer(event.target.value)
                            }
                          />
                        </label>
                        <label className="mb-3 block">
                          <span className="mb-1 block text-sm font-bold">
                            {text.correctionReason}
                          </span>
                          <input
                            className="w-full border border-[var(--line)] bg-white p-3"
                            required
                            value={correctionReason}
                            onChange={(event) =>
                              setCorrectionReason(event.target.value)
                            }
                          />
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <button
                            className={primaryButton}
                            disabled={busy}
                            type="submit"
                          >
                            {text.correct}
                          </button>
                          <button
                            className={secondaryButton}
                            onClick={() => setCorrectingTurnId("")}
                            type="button"
                          >
                            {text.cancelCorrection}
                          </button>
                        </div>
                      </form>
                    ) : canCorrect ? (
                      <button
                        className={textButton}
                        disabled={busy}
                        type="button"
                        onClick={() => beginCorrection(turn)}
                      >
                        {text.correct}
                      </button>
                    ) : null}
                  </article>
                </li>
              );
            })}

            {busy || interview.operationStatus === "running" ? (
              <li>
                <article
                  aria-label={text.assistant}
                  className="mr-auto max-w-[min(42rem,92%)]"
                >
                  <span className="mb-1 block text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">
                    {text.assistant}
                  </span>
                  <div className="rounded-2xl rounded-tl-sm border border-[var(--line)] bg-white px-5 py-4 shadow-sm">
                    <WorkingIndicator
                      label={
                        interview.turns.length
                          ? text.workingLabel
                          : text.startingLabel
                      }
                      phrases={
                        interview.turns.length
                          ? text.thinking
                          : text.starting
                      }
                    />
                    {takingLonger ? (
                      <p className="mb-0 mt-3 text-sm text-[var(--muted)]">
                        {text.takingLonger}
                      </p>
                    ) : null}
                  </div>
                </article>
              </li>
            ) : null}

            {!available &&
            interview.status === "active" &&
            canRespond &&
            interview.respondingDevice ? (
              <li>
                <article
                  aria-label={text.assistant}
                  className="mr-auto max-w-[min(42rem,92%)]"
                  role="status"
                >
                  <div className="rounded-2xl rounded-tl-sm border border-[var(--line)] bg-white px-5 py-4 shadow-sm">
                    {text.checkingMaterial}
                  </div>
                </article>
              </li>
            ) : null}

            {interview.status === "retryable" &&
            canRespond &&
            interview.respondingDevice ? (
              <li>
                <article className="mr-auto rounded-2xl border border-red-200 bg-red-50 p-4">
                  <p>{text.interrupted}</p>
                  <button
                    className={primaryButton}
                    type="button"
                    onClick={() =>
                      void perform(() =>
                        application.interviews.retryPending(actor, room.id),
                      )
                    }
                  >
                    {text.retry}
                  </button>
                </article>
              </li>
            ) : null}

            {interview.status === "paused" ? (
              <li>
                <article className="mr-auto rounded-2xl border border-[var(--line)] bg-white p-4">
                  <p>{text.paused}</p>
                  {canRespond && interview.respondingDevice ? (
                    <button
                      className={primaryButton}
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
                </article>
              </li>
            ) : null}

            {interview.status === "awaiting_confirmation" ? (
              <li>
                <article
                  aria-label={text.assistant}
                  className="mr-auto max-w-[min(42rem,92%)]"
                >
                  <span className="mb-1 block text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">
                    {text.assistant}
                  </span>
                  <div className="rounded-2xl rounded-tl-sm border border-[var(--line)] bg-white px-5 py-4 shadow-sm">
                    <p>{text.confirmReady}</p>
                    {canRespond && interview.respondingDevice ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          className={primaryButton}
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
                          className={secondaryButton}
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
                </article>
              </li>
            ) : null}

            {interview.status === "completed" ? (
              <li>
                <article
                  aria-label={text.assistant}
                  className="mr-auto max-w-[min(42rem,92%)] rounded-2xl rounded-tl-sm border border-emerald-200 bg-emerald-50 px-5 py-4"
                >
                  {text.completed}
                </article>
              </li>
            ) : null}

            {interview.status === "completed_early" ? (
              <li>
                <article
                  aria-label={text.assistant}
                  className="mr-auto max-w-[min(42rem,92%)] rounded-2xl rounded-tl-sm border border-amber-200 bg-amber-50 px-5 py-4"
                >
                  <p>{text.completedEarly}</p>
                  {interview.incompleteReason ? (
                    <p className="mb-0 text-sm text-[var(--muted)]">
                      {interview.incompleteReason}
                    </p>
                  ) : null}
                </article>
              </li>
            ) : null}

            {interview.status === "active" &&
            batch.length &&
            !showAnswerForm &&
            !busy &&
            interview.operationStatus !== "running" ? (
              <li>
                <article
                  aria-label={text.assistant}
                  className="mr-auto max-w-[min(42rem,92%)]"
                >
                  <span className="mb-1 block text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">
                    {text.assistant}
                  </span>
                  <div className="rounded-2xl rounded-tl-sm border border-[var(--line)] bg-white px-5 py-4 shadow-sm">
                    {actor.kind === "freelancer" ||
                    interview.respondingDevice ? null : (
                      <p className="mb-2 mt-0 text-sm text-[var(--muted)]">
                        {text.otherQuestions}
                      </p>
                    )}
                    {batch.length > 1 ? (
                      <ol className="m-0 list-decimal space-y-2 pl-5">
                        {batch.map((question) => (
                          <li
                            className="text-lg leading-7"
                            key={question.id}
                          >
                            {question.text}
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <h3 className="m-0 text-lg leading-7">
                        {batch[0]!.text}
                      </h3>
                    )}
                  </div>
                </article>
              </li>
            ) : null}
          </ol>

          {showAnswerForm ? (
            <form
              className="sticky bottom-4 z-10 mt-6 space-y-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)]/95 p-4 shadow-xl backdrop-blur"
              onSubmit={submit}
            >
              {batch.map((question, index) => (
                <fieldset
                  className="rounded-xl border border-[var(--line)] bg-white p-4 shadow-sm"
                  disabled={busy}
                  key={question.id}
                >
                  <h3 className="m-0 text-lg leading-7">
                    {batch.length > 1 ? (
                      <span className="mr-2 font-extrabold text-[var(--green)]">
                        {index + 1}.
                      </span>
                    ) : null}
                    {question.text}
                  </h3>
                  {unsure[question.id] ? (
                    <p className="mb-0 mt-3 rounded-lg bg-[#f4f3ed] p-3 text-sm text-[var(--muted)]">
                      {text.notSureMarked}
                    </p>
                  ) : (
                    <label className="mt-3 block">
                      <span className="sr-only">{question.text}</span>
                      <textarea
                        aria-label={question.text}
                        className="min-h-20 w-full resize-y border border-[var(--line)] bg-white p-3 shadow-inner"
                        value={drafts[question.id] ?? ""}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [question.id]: event.target.value,
                          }))
                        }
                        placeholder={text.answerPlaceholder}
                        rows={2}
                      />
                    </label>
                  )}
                  <button
                    aria-pressed={Boolean(unsure[question.id])}
                    className={`${textButton} mt-1`}
                    disabled={busy}
                    onClick={() => {
                      setUnsure((current) => ({
                        ...current,
                        [question.id]: !current[question.id],
                      }));
                      setDrafts((current) => ({
                        ...current,
                        [question.id]: "",
                      }));
                    }}
                    type="button"
                  >
                    {text.notSure}
                  </button>
                </fieldset>
              ))}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  className={primaryButton}
                  disabled={!canSubmit}
                  type="submit"
                >
                  {text.submit}
                </button>
                <span
                  aria-live="polite"
                  className="text-sm font-bold text-[var(--muted)]"
                >
                  {text.answeredProgress
                    .replace("{answered}", String(answeredCount))
                    .replace("{total}", String(batch.length))}
                </span>
              </div>
            </form>
          ) : null}

          {canRespond &&
          interview.respondingDevice &&
          interview.status === "active" &&
          interview.operationStatus === "idle" ? (
            <details className="mt-6 border-t border-[var(--line)] pt-4">
              <summary className="cursor-pointer font-bold text-[var(--muted)]">
                {text.conversationActions}
              </summary>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className={secondaryButton}
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
                  className={secondaryButton}
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
            </details>
          ) : null}

          {actor.kind === "freelancer" ? (
            <details className="mt-8 rounded-xl border border-[var(--line)] bg-[#f4f3ed] p-4">
              <summary className="cursor-pointer font-bold">
                {text.details}
              </summary>
              <p className="mb-6 mt-3 text-sm text-[var(--muted)]">
                {text.detailsHint}
              </p>

              {interview.operation ? (
                <section className="mb-6">
                  <h3 className="text-lg">{text.operation}</h3>
                  <p className="mb-0 text-sm">{operationLabel}</p>
                </section>
              ) : null}

              {interview.coverage.length ? (
                <section className="mb-6">
                  <h3 className="text-lg">{text.coverage}</h3>
                  <ul className="space-y-2 pl-5">
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
                </section>
              ) : null}

              {interview.findings.length ? (
                <section className="mb-6">
                  <h3 className="text-lg">{text.findings}</h3>
                  <ul className="space-y-4 pl-5">
                    {interview.findings.map((finding) => (
                      <li key={finding.id}>
                        <strong>{findingLabel(finding, locale)}</strong>
                        <p className="mb-1 mt-1">{finding.statement}</p>
                        <small className="text-[var(--muted)]">
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
                                case "project_description":
                                  return locale === "de"
                                    ? "Projektbeschreibung"
                                    : "Project Description";
                              }
                            })
                            .join(" · ")}
                        </small>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {interview.events.length ? (
                <section>
                  <h3 className="text-lg">{text.systemEvents}</h3>
                  <ol className="space-y-2 pl-5">
                    {interview.events.map((event) => (
                      <li key={event.id}>
                        {locale === "de"
                          ? `Projektmaterial wurde hinzugefügt. Zukünftige Antworten verwenden Kontextrevision ${event.contextPackRevision}.`
                          : `Project Material was added. Future answers use Context Pack revision ${event.contextPackRevision}.`}
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null}
            </details>
          ) : null}
        </>
      ) : null}
    </section>
  );
};
