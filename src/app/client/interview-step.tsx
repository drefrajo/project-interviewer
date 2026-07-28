import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type {
  ClientLanguage,
  TranscriptMessage,
} from "../../infrastructure/interview-api";
import { primaryButton, TextArea } from "../shared/form-controls";
import { SafeMarkdown } from "../shared/safe-markdown";
import { CLIENT_COPY } from "./client-copy";

const composerActivity = {
  en: {
    label: "Working on the next question",
    first: "Preparing the first question…",
    phrases: [
      "Reviewing the conversation so far…",
      "Identifying the most useful next detail…",
      "Drafting a concise follow-up question…",
      "Connecting the important pieces…",
      "Checking that the question is clear…",
      "Finding a helpful way forward…",
    ],
  },
  de: {
    label: "Die nächste Frage wird vorbereitet",
    first: "Die erste Frage wird vorbereitet…",
    phrases: [
      "Der bisherige Gesprächsverlauf wird geprüft…",
      "Das hilfreichste nächste Detail wird ermittelt…",
      "Eine kurze Anschlussfrage wird formuliert…",
      "Die wichtigen Zusammenhänge werden verbunden…",
      "Die Frage wird auf Klarheit geprüft…",
      "Ein hilfreicher nächster Schritt wird gesucht…",
    ],
  },
} as const satisfies Record<ClientLanguage, object>;

const ComposerWorking = ({
  firstQuestion,
  language,
}: {
  firstQuestion: boolean;
  language: ClientLanguage;
}) => {
  const text = composerActivity[language];
  const phrases = firstQuestion ? [text.first] : text.phrases;
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [characterCount, setCharacterCount] = useState(1);
  const phrase = phrases[phraseIndex % phrases.length] ?? "";
  const activeLabel = firstQuestion ? text.first : text.label;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCharacterCount((current) => {
        if (current < phrase.length + 18) return current + 1;
        setPhraseIndex((index) => (index + 1) % phrases.length);
        return 1;
      });
    }, 55);
    return () => window.clearInterval(timer);
  }, [phrase, phrases.length]);

  return (
    <div
      aria-label={activeLabel}
      aria-live="polite"
      className="absolute inset-0 overflow-hidden rounded-lg border border-line bg-white/80 backdrop-blur-sm"
      data-testid="composer-working"
      role="status"
    >
      <p
        aria-hidden="true"
        className="absolute inset-x-4 top-3 font-mono text-sm leading-6 text-muted/60"
      >
        {phrase.slice(0, Math.min(characterCount, phrase.length))}
        <span className="animate-pulse">▍</span>
      </p>
      <div className="relative flex h-full items-end justify-center px-4 pt-10 pb-2">
        <span
          className="inline-flex items-center gap-3 rounded-full border border-line bg-surface/85 px-4 py-3 shadow-lg backdrop-blur-md"
          data-testid="composer-working-badge"
        >
          <span
            aria-hidden="true"
            className="size-4 shrink-0 animate-spin rounded-full border-2 border-line border-t-forest"
          />
          <strong aria-hidden="true" className="text-sm">
            {activeLabel}
          </strong>
        </span>
      </div>
    </div>
  );
};

export const InterviewStepView = ({
  language,
  messages,
  pending,
  onSend,
}: {
  language: ClientLanguage;
  messages: TranscriptMessage[];
  pending: boolean;
  onSend(content: string): Promise<boolean>;
}) => {
  const text = CLIENT_COPY[language];
  const [draft, setDraft] = useState("");
  const transcript = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const history = transcript.current;
    if (!history) return;
    history.scrollTop = history.scrollHeight;
  }, [messages]);
  useLayoutEffect(() => {
    const textarea = composer.current;
    if (!textarea) return;
    const minimumHeight = 112;
    const maximumHeight = 354;
    textarea.style.height = "auto";
    const contentHeight = textarea.scrollHeight;
    textarea.style.height = `${Math.min(
      Math.max(contentHeight, minimumHeight),
      maximumHeight,
    )}px`;
    textarea.style.overflowY =
      contentHeight > maximumHeight ? "auto" : "hidden";
  }, [draft]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || pending) return;
    if (await onSend(content)) setDraft("");
  };

  const suggestedReplies =
    messages.at(-1)?.role === "assistant"
      ? messages.at(-1)?.suggestedReplies?.slice(0, 4) ?? []
      : [];

  return (
    <section
      className="mx-auto grid min-h-0 w-full max-w-3xl flex-1 grid-rows-[minmax(0,1fr)_auto] gap-0 overflow-hidden"
      data-testid="interview-shell"
    >
      <div
        aria-label={language === "de" ? "Interviewverlauf" : "Interview transcript"}
        className="min-h-0 space-y-4 overflow-y-auto overscroll-contain py-4 pr-1 sm:py-5"
        data-testid="interview-history"
        ref={transcript}
        role="log"
      >
        {messages.map((message) => (
          <article
            className={
              message.role === "client"
                ? "ml-auto max-w-[90%] rounded-2xl rounded-br-sm bg-forest px-4 py-3 text-white sm:max-w-[80%]"
                : "mr-auto max-w-[95%] rounded-2xl rounded-bl-sm border border-line bg-white px-4 py-3 sm:max-w-[85%]"
            }
            key={message.id}
          >
            {message.role === "assistant" ? (
              <SafeMarkdown markdown={message.content} variant="plain" />
            ) : (
              <p className="whitespace-pre-wrap leading-7">{message.content}</p>
            )}
          </article>
        ))}
      </div>
      <form
        aria-busy={pending}
        className="shrink-0 rounded-xl border border-line bg-surface p-4"
        data-testid="interview-composer"
        onSubmit={submit}
      >
        {!pending && suggestedReplies.length ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {suggestedReplies.map((reply) => (
              <button
                className="rounded-full border border-line bg-white px-3 py-2 text-left text-sm font-bold text-forest"
                key={reply}
                onClick={() => setDraft(reply)}
                type="button"
              >
                {reply}
              </button>
            ))}
          </div>
        ) : null}
        <label className="sr-only" htmlFor="client-reply">
          {text.reply}
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="relative min-h-28 flex-1">
            <TextArea
              className="min-h-28 w-full resize-none leading-6"
              data-max-lines="14"
              disabled={pending}
              id="client-reply"
              maxLength={10_000}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={text.reply}
              ref={composer}
              value={draft}
            />
            {pending ? (
              <ComposerWorking
                firstQuestion={messages.length === 0}
                language={language}
              />
            ) : null}
          </div>
          <button className={primaryButton} disabled={pending || !draft.trim()}>
            {text.send}
          </button>
        </div>
      </form>
    </section>
  );
};
