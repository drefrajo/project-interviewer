import { useQuery } from "convex/react";
import { ArrowRight, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import {
  interviewApi,
  type InterviewStatus,
  type InterviewStep,
} from "../../infrastructure/interview-api";
import { primaryButton } from "../shared/form-controls";

const statusCopy: Record<InterviewStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  submitted: "Submitted",
  needs_attention: "Needs attention",
};

const stepCopy: Record<InterviewStep, string> = {
  interview: "Interview",
  review: "Document Review",
  concepts: "Visual Concepts",
  submitted: "Submitted",
};

export const InterviewsPage = () => {
  const interviews = useQuery(interviewApi.interviews.list, {});
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8 lg:py-12" id="main-content">
      <header className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-extrabold tracking-[0.14em] text-forest uppercase">
            Creator workspace
          </p>
          <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight">
            Interviews
          </h1>
          <p className="mt-3 max-w-2xl leading-7 text-muted">
            Create one focused Interview, send one link, and receive an
            implementation-ready Project Submission.
          </p>
        </div>
        <Link className={primaryButton} to="/interviews/new">
          <Plus aria-hidden="true" size={18} />
          New Interview
        </Link>
      </header>
      {interviews === undefined ? (
        <p className="mt-10 font-bold text-muted" role="status">
          Loading Interviews…
        </p>
      ) : interviews.length ? (
        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {interviews.map((interview) => (
            <Link
              className="group flex min-h-56 flex-col rounded-xl border border-line bg-surface p-5 text-ink no-underline transition hover:-translate-y-0.5 hover:shadow-lg"
              key={interview._id}
              to={`/interviews/${interview._id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${
                    interview.status === "needs_attention"
                      ? "bg-error-surface text-error-text"
                      : interview.status === "submitted"
                        ? "bg-lime text-forest dark:text-forest-strong"
                        : "bg-soft text-forest"
                  }`}
                >
                  {statusCopy[interview.status]}
                </span>
                {interview.updatedAt ? (
                  <time className="text-xs text-muted">
                    {new Intl.DateTimeFormat("en", {
                      dateStyle: "medium",
                    }).format(interview.updatedAt)}
                  </time>
                ) : null}
              </div>
              <h2 className="mt-8 font-display text-2xl font-extrabold">
                {interview.projectName}
              </h2>
              <p className="mt-2 text-sm text-muted">
                {interview.status === "in_progress"
                  ? `Current step: ${stepCopy[interview.step]}`
                  : `${interview.clientLanguage === "de" ? "German" : "English"} · ${interview.interviewModel === "gpt-5.6-terra" ? "GPT-5.6 Terra" : "DeepSeek V4 Flash"}`}
              </p>
              <span className="mt-auto inline-flex items-center gap-1 pt-6 font-bold text-forest">
                Open <ArrowRight aria-hidden="true" size={16} />
              </span>
            </Link>
          ))}
        </section>
      ) : (
        <section className="mt-10 rounded-xl border border-dashed border-line bg-surface p-8 text-center">
          <h2 className="font-display text-2xl font-extrabold">No Interviews yet</h2>
          <p className="mt-2 text-muted">
            Start with concise instructions for the website work you sell.
          </p>
        </section>
      )}
    </main>
  );
};
