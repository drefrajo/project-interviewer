import { useMutation, useQuery } from "convex/react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useEffect, useState } from "react";
import {
  interviewApi,
  type InterviewFeedbackEntry,
  type InterviewFeedbackRating,
  type InterviewFeedbackTarget,
} from "../../infrastructure/interview-api";
import { trackEvent } from "../../infrastructure/analytics";
import { secondaryButton } from "../shared/form-controls";
import { creatorCopy } from "./creator-copy";
import { type CreatorLanguage } from "./creator-language";

const ratingButtonClass = (active: boolean) =>
  `inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-bold transition ${
    active
      ? "border-primary bg-soft-hover text-primary"
      : "border-line text-muted hover:border-primary hover:text-primary"
  }`;

const useInterviewFeedback = (
  interviewId: string,
  target: InterviewFeedbackTarget,
): InterviewFeedbackEntry | undefined | null => {
  const entries = useQuery(interviewApi.feedback.getForInterview, {
    interviewId,
  });
  if (entries === undefined) return undefined;
  return entries.find((entry) => entry.target === target) ?? null;
};

const FeedbackButtons = ({
  busy,
  disabled,
  downLabel,
  onRecord,
  upLabel,
  value,
}: {
  busy: boolean;
  disabled?: boolean;
  downLabel: string;
  onRecord(rating: InterviewFeedbackRating): void;
  upLabel: string;
  value: InterviewFeedbackEntry | undefined | null;
}) => (
  <span className="inline-flex gap-2">
    <button
      aria-label={upLabel}
      aria-pressed={value?.rating === "up"}
      className={ratingButtonClass(value?.rating === "up")}
      disabled={disabled || busy}
      onClick={() => onRecord("up")}
      title={upLabel}
      type="button"
    >
      <ThumbsUp aria-hidden="true" size={15} />
    </button>
    <button
      aria-label={downLabel}
      aria-pressed={value?.rating === "down"}
      className={ratingButtonClass(value?.rating === "down")}
      disabled={disabled || busy}
      onClick={() => onRecord("down")}
      title={downLabel}
      type="button"
    >
      <ThumbsDown aria-hidden="true" size={15} />
    </button>
  </span>
);

export const DocumentFeedback = ({
  interviewId,
  language,
}: {
  interviewId: string;
  language: CreatorLanguage;
}) => {
  const text = creatorCopy[language];
  const value = useInterviewFeedback(interviewId, "project_document");
  const record = useMutation(interviewApi.feedback.record);
  const [busy, setBusy] = useState(false);
  const onRecord = async (rating: InterviewFeedbackRating) => {
    setBusy(true);
    try {
      await record({ interviewId, target: "project_document", rating });
      trackEvent("document_feedback_recorded");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="m-0 text-sm font-bold text-muted">
        {text.detail.documentFeedbackPrompt}
      </p>
      <FeedbackButtons
        busy={busy}
        disabled={value === undefined}
        downLabel={text.detail.feedbackNotHelpful}
        onRecord={(rating) => void onRecord(rating)}
        upLabel={text.detail.feedbackHelpful}
        value={value}
      />
      {value ? (
        <p className="m-0 text-sm font-bold text-muted" role="status">
          {text.detail.feedbackThanks}
        </p>
      ) : null}
    </div>
  );
};

export const SubmissionFeedback = ({
  interviewId,
  language,
}: {
  interviewId: string;
  language: CreatorLanguage;
}) => {
  const text = creatorCopy[language];
  const value = useInterviewFeedback(interviewId, "project_submission");
  const record = useMutation(interviewApi.feedback.record);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [noteInitialized, setNoteInitialized] = useState(false);
  useEffect(() => {
    if (!noteInitialized && value) {
      setNoteDraft(value.comment ?? "");
      setNoteInitialized(true);
    }
  }, [noteInitialized, value]);
  const onRecord = async (
    rating: InterviewFeedbackRating,
    comment?: string,
  ) => {
    setBusy(true);
    setError("");
    try {
      await record({
        interviewId,
        target: "project_submission",
        rating,
        ...(comment !== undefined ? { comment } : {}),
      });
      trackEvent("submission_feedback_recorded");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="rounded-box border border-line bg-panel p-5">
      <h3 className="m-0 font-display text-xl font-extrabold">
        {text.detail.feedbackTitle}
      </h3>
      <div className="mt-4">
        <DocumentFeedback interviewId={interviewId} language={language} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-line pt-4">
        <p className="m-0 text-sm font-bold text-muted">
          {text.detail.submissionFeedbackPrompt}
        </p>
        <span className="flex flex-wrap items-center gap-2">
          <button
            aria-pressed={value?.rating === "up"}
            className={ratingButtonClass(value?.rating === "up")}
            disabled={value === undefined || busy}
            onClick={() => void onRecord("up")}
            type="button"
          >
            <ThumbsUp aria-hidden="true" size={15} /> {text.detail.feedbackUp}
          </button>
          <button
            aria-pressed={value?.rating === "down"}
            className={ratingButtonClass(value?.rating === "down")}
            disabled={value === undefined || busy}
            onClick={() => void onRecord("down")}
            type="button"
          >
            <ThumbsDown aria-hidden="true" size={15} />{" "}
            {text.detail.feedbackDown}
          </button>
        </span>
        {value ? (
          <p className="m-0 text-sm font-bold text-muted" role="status">
            {text.detail.feedbackThanks}
          </p>
        ) : null}
      </div>
      {value && value.rating === "down" ? (
        <form
          className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center"
          onSubmit={(event) => {
            event.preventDefault();
            void onRecord(
              value.rating,
              noteDraft.trim() ? noteDraft.trim() : undefined,
            );
          }}
        >
          <input
            className="w-full max-w-xl rounded-lg border border-line bg-surface px-3 py-2 text-sm leading-6"
            maxLength={2000}
            onChange={(event) => setNoteDraft(event.target.value)}
            placeholder={text.detail.feedbackNotePlaceholder}
            type="text"
            value={noteDraft}
          />
          <button className={secondaryButton} disabled={busy} type="submit">
            {text.detail.saveFeedbackNote}
          </button>
        </form>
      ) : null}
      {error ? (
        <p className="mt-3 font-bold text-error-text" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
};
