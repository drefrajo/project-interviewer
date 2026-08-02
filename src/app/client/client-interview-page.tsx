import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  interviewApi,
  type InterviewStep,
  type VisualDirection,
} from "../../infrastructure/interview-api";
import { OperationFeedback } from "../shared/operation-feedback";
import { LegalFooter } from "../shared/legal-footer";
import { ThemeToggle } from "../shared/theme-toggle";
import { ConceptsStep } from "./concepts-step";
import { CLIENT_COPY } from "./client-copy";
import { DocumentReviewStep } from "./document-review-step";
import { activeInterviewMainClassName } from "./interview-layout";
import { InterviewStepView } from "./interview-step";
import { SubmittedStep } from "./submitted-step";
import { WelcomeStep } from "./welcome-step";

const stepIndex = (step: InterviewStep) =>
  ({ interview: 0, review: 1, concepts: 2, submitted: 3 })[step];

export const ClientInterviewPage = () => {
  const { interviewToken = "" } = useParams();
  const interview = useQuery(interviewApi.client.getByLink, {
    token: interviewToken,
  });
  const transcript = useQuery(
    interviewApi.transcripts.listForClient,
    interview?.started ? { token: interviewToken } : "skip",
  );
  const start = useMutation(interviewApi.client.start);
  const sendMessage = useMutation(interviewApi.client.sendMessage);
  const requestChanges = useMutation(
    interviewApi.client.requestDocumentChanges,
  );
  const continueToConcepts = useMutation(
    interviewApi.client.continueToConcepts,
  );
  const requestMoreConcepts = useMutation(
    interviewApi.client.requestMoreConcepts,
  );
  const retryAdditionalConcepts = useMutation(
    interviewApi.client.retryAdditionalConcepts,
  );
  const retryFirstConcepts = useMutation(
    interviewApi.client.retryFirstConcepts,
  );
  const retry = useMutation(interviewApi.client.retry);
  const retryMalformedResponse = useMutation(
    interviewApi.client.retryMalformedResponse,
  );
  const submit = useMutation(interviewApi.client.submit);
  const [busy, setBusy] = useState(false);
  const [entered, setEntered] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!interview) return;
    document.documentElement.lang = interview.clientLanguage;
  }, [interview]);

  const perform = async (operation: () => Promise<unknown>) => {
    if (busy) return false;
    setBusy(true);
    setError("");
    try {
      await operation();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (interview === undefined) {
    return <ClientLoading label="Opening Interview…" />;
  }
  if (interview === null) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <main className="grid flex-1 place-items-center px-4" id="main-content">
          <section className="max-w-xl rounded-xl border border-line bg-surface p-6">
            <h1 className="font-display text-3xl font-extrabold">
              Interview unavailable
            </h1>
            <p className="mt-3 leading-7 text-muted">
              This Interview Link is invalid or has been replaced. Ask the Creator
              for the current link.
            </p>
          </section>
        </main>
        <LegalFooter />
      </div>
    );
  }

  const text = CLIENT_COPY[interview.clientLanguage];
  if (interview.reservationRequired) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas text-ink">
        <a className="skip-link" href="#main-content">
          {interview.clientLanguage === "de"
            ? "Zum Hauptinhalt springen"
            : "Skip to main content"}
        </a>
        <header className="border-b border-line bg-surface px-4 py-4 sm:px-8">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-5">
            <span className="font-display font-extrabold">
              {interview.projectName}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted">
                {interview.creator.displayName}
              </span>
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main className="grid flex-1 place-items-center px-4 py-10" id="main-content">
          <section className="w-full max-w-xl rounded-xl border border-line bg-surface p-6">
            <h1 className="font-display text-3xl font-extrabold">
              {text.reservationRequiredTitle}
            </h1>
            <p className="mt-3 leading-7 text-muted">
              {text.reservationRequiredDescription}
            </p>
          </section>
        </main>
        <LegalFooter language={interview.clientLanguage} />
      </div>
    );
  }
  const submitted = interview.step === "submitted";
  const pending =
    busy || (!submitted && interview.operation?.state === "pending");
  const showingInterview =
    (interview.started || entered) && interview.step === "interview";
  return (
    <div
      className={
        showingInterview
          ? "grid h-dvh grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden bg-canvas text-ink"
          : "flex min-h-screen flex-col bg-canvas text-ink"
      }
    >
      <a className="skip-link" href="#main-content">
        {interview.clientLanguage === "de"
          ? "Zum Hauptinhalt springen"
          : "Skip to main content"}
      </a>
      <header className="border-b border-line bg-surface px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-5">
          <span className="font-display font-extrabold">{interview.projectName}</span>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted">{interview.creator.displayName}</span>
            <ThemeToggle />
          </div>
        </div>
      </header>
      {interview.started || entered ? (
        <nav
          aria-label={interview.clientLanguage === "de" ? "Fortschritt" : "Progress"}
          className="border-b border-line bg-surface px-4 py-3"
        >
          <ol className="mx-auto grid max-w-3xl grid-cols-4 gap-2">
            {text.steps.map((label, index) => (
              <li
                aria-current={index === stepIndex(interview.step) ? "step" : undefined}
                className={`border-t-4 pt-2 text-center text-xs font-bold sm:text-sm ${
                  index <= stepIndex(interview.step)
                    ? "border-forest text-forest"
                    : "border-line text-muted"
                }`}
                key={label}
              >
                {label}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
      <main
        className={
          showingInterview
            ? activeInterviewMainClassName
            : "flex-1 px-4 py-8 sm:px-8 sm:py-12"
        }
        id="main-content"
      >
        {error ? (
          <p className="mx-auto mt-4 mb-5 w-full max-w-3xl rounded-lg border border-error-border bg-error-surface p-4 font-bold text-error-text" role="alert">
            {error}
          </p>
        ) : null}
        <OperationFeedback
          hidePending={
            interview.step === "concepts" || interview.step === "interview"
          }
          language={interview.clientLanguage}
          operation={submitted ? null : interview.operation}
          onRetry={() =>
            void perform(() => retry({ token: interviewToken }))
          }
        />
        {!interview.started && !entered ? (
          <WelcomeStep
            interview={interview}
            onStart={() =>
              void perform(async () => {
                await start({ token: interviewToken });
                setEntered(true);
              })
            }
            pending={pending}
          />
        ) : interview.step === "interview" ? (
          <InterviewStepView
            language={interview.clientLanguage}
            messages={transcript ?? []}
            onRetry={() =>
              perform(() =>
                retryMalformedResponse({ token: interviewToken }),
              )
            }
            onSend={(content) =>
              perform(() => sendMessage({ token: interviewToken, content }))
            }
            pending={pending}
            planning={interview.operation?.phase === "planning"}
          />
        ) : interview.step === "review" ? (
          <DocumentReviewStep
            language={interview.clientLanguage}
            markdown={interview.projectDocument ?? ""}
            onContinue={() =>
              void perform(() =>
                continueToConcepts({ token: interviewToken }),
              )
            }
            onRequestChanges={(changes) =>
              perform(() => requestChanges({ token: interviewToken, changes }))
            }
            pending={pending}
          />
        ) : interview.step === "concepts" ? (
          <ConceptsStep
            concepts={interview.concepts ?? []}
            generationPhase={
              interview.operation?.phase === "concept_creating"
                ? "creating"
                : interview.operation?.phase === "concept_planning"
                  ? "planning"
                  : undefined
            }
            language={interview.clientLanguage}
            onMoreOptions={() =>
              perform(() => requestMoreConcepts({ token: interviewToken }))
            }
            onRetryMoreOptions={() =>
              perform(() => retryAdditionalConcepts({ token: interviewToken }))
            }
            onRetryFirstOptions={() =>
              perform(() => retryFirstConcepts({ token: interviewToken }))
            }
            onSubmit={(direction: VisualDirection) =>
              perform(async () => {
                await submit({ token: interviewToken, direction });
              }).then(() => undefined)
            }
            pending={pending}
            temporaryConceptBatchRetriesEnabled={
              interview.temporaryConceptBatchRetriesEnabled
            }
          />
        ) : (
          <SubmittedStep interview={interview} />
        )}
      </main>
      {!showingInterview ? (
        <LegalFooter language={interview.clientLanguage} />
      ) : null}
    </div>
  );
};

const ClientLoading = ({ label }: { label: string }) => (
  <div className="flex min-h-screen flex-col bg-canvas">
    <main className="grid flex-1 place-items-center" id="main-content">
      <p className="font-bold text-muted" role="status">
        {label}
      </p>
    </main>
    <LegalFooter />
  </div>
);
