import { useState, type FormEvent } from "react";
import type { ClientLanguage } from "../../infrastructure/interview-api";
import { ConfirmDialog } from "../shared/confirm-dialog";
import { primaryButton, secondaryButton, TextArea } from "../shared/form-controls";
import { SafeMarkdown } from "../shared/safe-markdown";
import { CLIENT_COPY } from "./client-copy";

const ReviewComposerWorking = ({ language }: { language: ClientLanguage }) => {
  const text = CLIENT_COPY[language];
  return (
    <div
      aria-label={text.reviewWorkingLabel}
      className="absolute inset-0 overflow-hidden rounded-lg border border-line bg-surface/80 backdrop-blur-sm"
      data-testid="document-review-working"
      role="status"
    >
      <p
        aria-hidden="true"
        className="absolute inset-x-4 top-3 font-mono text-sm leading-6 text-muted/60"
      >
        {text.reviewWorkingDetail}
        <span className="animate-pulse">▍</span>
      </p>
      <div className="relative flex h-full items-end justify-center px-4 pt-10 pb-2">
        <span className="inline-flex items-center gap-3 rounded-full border border-line bg-surface/85 px-4 py-3 shadow-lg backdrop-blur-md">
          <span
            aria-hidden="true"
            className="size-4 shrink-0 animate-spin rounded-full border-2 border-line border-t-forest"
          />
          <strong className="text-sm">{text.reviewWorkingLabel}</strong>
        </span>
      </div>
    </div>
  );
};

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
  const [confirmingContinue, setConfirmingContinue] = useState(false);
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
      <form
        aria-busy={pending}
        className="sticky bottom-4 z-10 mt-8 rounded-box border border-line bg-surface/95 p-5 shadow-xl backdrop-blur-md"
        data-testid="document-review-composer"
        onSubmit={submit}
      >
        <label className="grid gap-2 font-bold">
          {text.changes}
          <div className="relative">
            <TextArea
              disabled={pending}
              maxLength={10_000}
              onChange={(event) => setChanges(event.target.value)}
              rows={4}
              value={changes}
            />
            {pending ? <ReviewComposerWorking language={language} /> : null}
          </div>
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
            onClick={() => setConfirmingContinue(true)}
            type="button"
          >
            {text.continueConcepts}
          </button>
        </div>
      </form>
      <ConfirmDialog
        cancelLabel={text.cancel}
        confirmLabel={text.continueConceptsConfirm}
        onCancel={() => setConfirmingContinue(false)}
        onConfirm={() => {
          setConfirmingContinue(false);
          onContinue();
        }}
        open={confirmingContinue}
        title={text.continueConceptsTitle}
      >
        <p>{text.continueConceptsWarning}</p>
      </ConfirmDialog>
    </section>
  );
};
