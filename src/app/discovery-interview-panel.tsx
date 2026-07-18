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
} from "../domain/discovery-interview";
import { useI18n } from "./i18n";

const copy = {
  en: {
    intro:
      "Have a conversation about the project. You can answer naturally, skip anything you do not know, and correct an earlier answer at any time.",
    available: "Available",
    notAvailable: "Not yet available",
    title: "Discovery Interview",
    start: "Start conversation",
    notStarted: "The Client has not started the conversation yet.",
    answer: "Your reply",
    answerPlaceholder: "Write your reply…",
    submit: "Send reply",
    skip: "I’m not sure",
    pause: "Pause conversation",
    resume: "Resume conversation",
    finish: "Finish early",
    finishConfirm:
      "Finish discovery now and mark the Project Brief as potentially incomplete?",
    takeover: "Take over response permission",
    observer:
      "Another device can reply right now. You can follow the conversation here or take over.",
    freelancer:
      "You are viewing the Client’s conversation. Only the Client’s Responding Device can reply or make corrections.",
    processing: "I’m considering that and preparing the next question…",
    starting: "I’m getting the conversation ready…",
    takingLonger:
      "This is taking a little longer. Your reply is saved, so it is safe to leave and come back.",
    checkingMaterial:
      "I’m checking the new Project Material before we continue. You can come back when it is ready.",
    retry: "Try again",
    confirmReady:
      "I think we have enough to prepare the Project Brief. Would you like to finish, or is there more we should discuss?",
    confirm: "Finish conversation",
    continue: "There’s more to discuss",
    completed:
      "Thanks — the conversation is complete. The Freelancer can now review the result and prepare the Project Brief.",
    completedEarly:
      "This conversation was deliberately finished early. The Project Brief may still have open questions.",
    correction: "Correction",
    coverage: "Coverage",
    systemEvents: "Project Material events",
    findings: "Discovery findings",
    details: "Discovery details",
    detailsHint:
      "Structured discovery state for Freelancer review. This is not shown in the Client’s conversation.",
    conversationActions: "Conversation options",
    correct: "Correct this reply",
    cancelCorrection: "Cancel",
    correctionReason: "What changed?",
    correctedAnswer: "Corrected reply",
    client: "You",
    assistant: "Interviewer",
    skipped: "I’m not sure.",
    saved: "Reply saved",
    originalAnswer: "Original reply",
    operation: "Current operation",
  },
  de: {
    intro:
      "Sprechen Sie ganz natürlich über das Projekt. Sie können etwas überspringen, wenn Sie es nicht wissen, und frühere Antworten jederzeit korrigieren.",
    available: "Verfügbar",
    notAvailable: "Noch nicht verfügbar",
    title: "Discovery-Interview",
    start: "Gespräch beginnen",
    notStarted: "Der Client hat das Gespräch noch nicht begonnen.",
    answer: "Ihre Antwort",
    answerPlaceholder: "Schreiben Sie Ihre Antwort…",
    submit: "Antwort senden",
    skip: "Ich bin nicht sicher",
    pause: "Gespräch pausieren",
    resume: "Gespräch fortsetzen",
    finish: "Vorzeitig beenden",
    finishConfirm:
      "Discovery jetzt beenden und den Projektbrief als möglicherweise unvollständig markieren?",
    takeover: "Antwortberechtigung übernehmen",
    observer:
      "Ein anderes Gerät kann derzeit antworten. Sie können dem Gespräch hier folgen oder die Berechtigung übernehmen.",
    freelancer:
      "Sie sehen das Gespräch des Clients. Nur das Antwortgerät des Clients kann antworten oder Korrekturen vornehmen.",
    processing:
      "Ich denke darüber nach und bereite die nächste Frage vor…",
    starting: "Ich bereite das Gespräch vor…",
    takingLonger:
      "Das dauert etwas länger. Ihre Antwort ist gespeichert; Sie können die Seite sicher verlassen und später zurückkehren.",
    checkingMaterial:
      "Ich prüfe das neue Projektmaterial, bevor wir fortfahren. Sie können zurückkommen, sobald es bereit ist.",
    retry: "Erneut versuchen",
    confirmReady:
      "Ich denke, wir haben genug für den Projektbrief. Möchten Sie das Gespräch beenden oder sollten wir noch etwas besprechen?",
    confirm: "Gespräch beenden",
    continue: "Es gibt noch etwas zu besprechen",
    completed:
      "Vielen Dank — das Gespräch ist abgeschlossen. Der Freelancer kann das Ergebnis jetzt prüfen und den Projektbrief vorbereiten.",
    completedEarly:
      "Dieses Gespräch wurde bewusst vorzeitig beendet. Im Projektbrief können noch offene Fragen verbleiben.",
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
    saved: "Antwort gespeichert",
    originalAnswer: "Ursprüngliche Antwort",
    operation: "Aktueller Vorgang",
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

  const beginCorrection = (turnId: string, turnAnswer: string) => {
    setCorrectingTurnId(turnId);
    setCorrectedAnswer(turnAnswer);
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
    : text.processing;

  const canCorrect =
    canRespond &&
    interview?.respondingDevice &&
    interview.operationStatus !== "running" &&
    !["completed", "completed_early"].includes(interview.status);

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
        <p className="text-[var(--muted)]" role="status">
          {text.starting}
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
                      if (succeeded) setAnswer("");
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
                      <h3 className="m-0 text-lg leading-7">
                        {turn.question.text}
                      </h3>
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
                      <p className="m-0 whitespace-pre-wrap">
                        {turn.answerKind === "skip"
                          ? text.skipped
                          : turn.answer}
                      </p>
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
                          {turn.answerKind === "skip"
                            ? text.skipped
                            : turn.answer}
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
                        onClick={() => beginCorrection(turn.id, turn.answer)}
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
                  role="status"
                >
                  <span className="mb-1 block text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">
                    {text.assistant}
                  </span>
                  <div className="rounded-2xl rounded-tl-sm border border-[var(--line)] bg-white px-5 py-4 shadow-sm">
                    <p className="m-0">
                      {interview.turns.length
                        ? text.processing
                        : text.starting}
                    </p>
                    <span className="mt-3 flex gap-1" aria-hidden="true">
                      <span className="size-2 animate-pulse rounded-full bg-[var(--muted)]" />
                      <span className="size-2 animate-pulse rounded-full bg-[var(--muted)] [animation-delay:150ms]" />
                      <span className="size-2 animate-pulse rounded-full bg-[var(--muted)] [animation-delay:300ms]" />
                    </span>
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
                  <p>
                    {locale === "de"
                      ? "Die letzte Verarbeitung wurde unterbrochen."
                      : "The last step was interrupted."}
                  </p>
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
                  <p>
                    {locale === "de"
                      ? "Das Gespräch ist pausiert."
                      : "The conversation is paused."}
                  </p>
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
            interview.currentQuestion &&
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
                    <h3 className="m-0 text-lg leading-7">
                      {interview.currentQuestion.text}
                    </h3>
                  </div>
                </article>
              </li>
            ) : null}
          </ol>

          {interview.status === "active" &&
          interview.currentQuestion &&
          available &&
          canRespond &&
          interview.respondingDevice &&
          interview.operationStatus !== "running" ? (
            <form
              className="sticky bottom-4 z-10 mt-6 rounded-2xl border border-[var(--line)] bg-[var(--surface)]/95 p-4 shadow-xl backdrop-blur"
              onSubmit={submit}
            >
              <label className="block">
                <span className="mb-2 block text-sm font-extrabold">
                  {text.answer}
                </span>
                <textarea
                  className="min-h-28 w-full resize-y border border-[var(--line)] bg-white p-3 shadow-inner"
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  placeholder={text.answerPlaceholder}
                  required
                  rows={4}
                />
              </label>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  className={primaryButton}
                  disabled={busy}
                  type="submit"
                >
                  {text.submit}
                </button>
                <button
                  className={textButton}
                  disabled={busy}
                  onClick={() => void skip()}
                  type="button"
                >
                  {text.skip}
                </button>
              </div>
            </form>
          ) : null}

          {canRespond &&
          interview.respondingDevice &&
          interview.status === "active" ? (
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
