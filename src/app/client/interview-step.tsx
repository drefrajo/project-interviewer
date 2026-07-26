import { useEffect, useRef, useState, type FormEvent } from "react";
import type {
  ClientLanguage,
  TranscriptMessage,
} from "../../infrastructure/interview-api";
import { primaryButton, TextArea } from "../shared/form-controls";
import { SafeMarkdown } from "../shared/safe-markdown";
import { CLIENT_COPY } from "./client-copy";

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
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: "nearest" }), [messages]);

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
    <section className="mx-auto grid min-h-[70vh] w-full max-w-3xl grid-rows-[1fr_auto] gap-5">
      <div
        aria-label={language === "de" ? "Interviewverlauf" : "Interview transcript"}
        className="space-y-4"
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
              <SafeMarkdown markdown={message.content} />
            ) : (
              <p className="whitespace-pre-wrap leading-7">{message.content}</p>
            )}
          </article>
        ))}
        <div ref={end} />
      </div>
      <form className="sticky bottom-0 rounded-xl border border-line bg-surface p-4 shadow-xl" onSubmit={submit}>
        {suggestedReplies.length ? (
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
          <TextArea
            className="min-h-24 flex-1 resize-y"
            disabled={pending}
            id="client-reply"
            maxLength={10_000}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={text.reply}
            value={draft}
          />
          <button className={primaryButton} disabled={pending || !draft.trim()}>
            {text.send}
          </button>
        </div>
      </form>
    </section>
  );
};
