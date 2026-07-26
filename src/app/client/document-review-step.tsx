import { useState, type FormEvent } from "react";
import type { ClientLanguage } from "../../infrastructure/interview-api";
import { primaryButton, secondaryButton, TextArea } from "../shared/form-controls";
import { SafeMarkdown } from "../shared/safe-markdown";
import { CLIENT_COPY } from "./client-copy";

export const DocumentReviewStep = ({
  language,
  markdown,
  pending,
  onRequestChanges,
  onContinue,
}: {
  language: ClientLanguage;
  markdown: string;
  pending: boolean;
  onRequestChanges(changes: string): Promise<boolean>;
  onContinue(): void;
}) => {
  const text = CLIENT_COPY[language];
  const [changes, setChanges] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!changes.trim()) return;
    if (await onRequestChanges(changes.trim())) setChanges("");
  };
  return (
    <section className="mx-auto w-full max-w-4xl">
      <h1 className="font-display text-3xl font-extrabold">{text.reviewTitle}</h1>
      <p className="mt-3 max-w-3xl leading-7 text-muted">{text.reviewIntro}</p>
      <div className="mt-6">
        <SafeMarkdown markdown={markdown} />
      </div>
      <form className="mt-6 rounded-xl border border-line bg-surface p-5" onSubmit={submit}>
        <label className="grid gap-2 font-bold">
          {text.changes}
          <TextArea
            disabled={pending}
            maxLength={10_000}
            onChange={(event) => setChanges(event.target.value)}
            rows={4}
            value={changes}
          />
        </label>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            className={secondaryButton}
            disabled={pending || !changes.trim()}
            type="submit"
          >
            {text.requestChanges}
          </button>
          <button
            className={primaryButton}
            disabled={pending}
            onClick={onContinue}
            type="button"
          >
            {text.continueConcepts}
          </button>
        </div>
      </form>
    </section>
  );
};
