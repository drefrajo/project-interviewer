import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  interviewApi,
  type InterviewStep,
  type VisualDirection,
} from "../../infrastructure/interview-api";
import { OperationFeedback } from "../shared/operation-feedback";
import { ConceptsStep } from "./concepts-step";
import { CLIENT_COPY } from "./client-copy";
import { DocumentReviewStep } from "./document-review-step";
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
  const retry = useMutation(interviewApi.client.retry);
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
      <main className="grid min-h-screen place-items-center px-4" id="main-content">
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
    );
  }

  const text = CLIENT_COPY[interview.clientLanguage];
  const pending = busy || interview.operation?.state === "pending";
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <a className="skip-link" href="#main-content">
        {interview.clientLanguage === "de"
          ? "Zum Hauptinhalt springen"
          : "Skip to main content"}
      </a>
      <header className="border-b border-line bg-surface px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-5">
          <span className="font-display font-extrabold">{interview.projectName}</span>
          <span className="text-sm text-muted">{interview.creator.displayName}</span>
        </div>
      </header>
      {interview.started || entered ? (
        <nav
          aria-label={interview.clientLanguage === "de" ? "Fortschritt" : "Progress"}
          className="border-b border-line bg-white px-4 py-3"
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
      <main className="px-4 py-8 sm:px-8 sm:py-12" id="main-content">
        {error ? (
          <p className="mx-auto mb-5 max-w-3xl rounded-lg border border-[#e9b29e] bg-[#fff1e7] p-4 font-bold text-[#852f21]" role="alert">
            {error}
          </p>
        ) : null}
        <OperationFeedback
          language={interview.clientLanguage}
          operation={interview.operation}
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
            onSend={(content) =>
              perform(() => sendMessage({ token: interviewToken, content }))
            }
            pending={pending}
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
            language={interview.clientLanguage}
            onSubmit={(direction: VisualDirection) =>
              perform(async () => {
                await submit({ token: interviewToken, direction });
              }).then(() => undefined)
            }
            pending={pending}
          />
        ) : (
          <SubmittedStep interview={interview} />
        )}
      </main>
    </div>
  );
};

const ClientLoading = ({ label }: { label: string }) => (
  <main className="grid min-h-screen place-items-center" id="main-content">
    <p className="font-bold text-muted" role="status">
      {label}
    </p>
  </main>
);
