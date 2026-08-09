import { useQuery } from "convex/react";
import { ArrowRight, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { interviewApi } from "../../infrastructure/interview-api";
import { primaryButton, textLink } from "../shared/form-controls";
import { creatorCopy } from "./creator-copy";
import { useCreatorLanguage } from "./creator-language";
import { hasCompletePublicCreatorIdentity } from "./creator-profile-readiness";

export const InterviewsPage = () => {
  const language = useCreatorLanguage();
  const text = creatorCopy[language];
  const interviews = useQuery(interviewApi.interviews.list, {});
  const profile = useQuery(interviewApi.creator_profiles.getCurrent, {});
  const profileReady = hasCompletePublicCreatorIdentity(profile);
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8 lg:py-12" id="main-content">
      <header className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-extrabold tracking-[0.14em] text-forest uppercase">
            {text.interviews.workspace}
          </p>
          <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight">
            {text.interviews.title}
          </h1>
          <p className="mt-3 max-w-2xl leading-7 text-muted">
            {text.interviews.intro}
          </p>
        </div>
        {profile === undefined ? null : (
          <Link
            className={primaryButton}
            to={profileReady ? "/interviews/new" : "/settings#settings-profile"}
          >
            <Plus aria-hidden="true" size={18} />
            {profileReady
              ? text.interviews.newInterview
              : text.interviews.completeSettings}
          </Link>
        )}
      </header>
      {interviews === undefined ? (
        <p className="mt-10 font-bold text-muted" role="status">
          {text.interviews.loading}
        </p>
      ) : interviews.length ? (
        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {interviews.map((interview) => {
            const needsReservation =
              interview.status === "not_started" &&
              interview.passState === "unreserved";
            const statusLabel = needsReservation
              ? text.interviews.reservationRequired
              : interview.status === "not_started"
                ? text.interviews.ready
                : text.interviews.status[interview.status];
            const statusBadgeClass =
              needsReservation || interview.status === "needs_attention"
                ? "bg-error-surface text-error-text"
                : interview.status === "not_started"
                  ? "bg-soft text-muted"
                  : interview.status === "in_progress"
                    ? "bg-forest text-white dark:bg-forest-strong"
                    : "bg-lime text-forest dark:text-forest-strong";
            return (
              <Link
                className="group flex min-h-56 flex-col rounded-box border border-line bg-panel p-5 text-ink no-underline transition hover:-translate-y-0.5 hover:shadow-lg"
                key={interview._id}
                to={`/interviews/${interview._id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${statusBadgeClass}`}
                  >
                    {statusLabel}
                  </span>
                  {interview.updatedAt ? (
                    <time className="text-xs text-muted">
                      {new Intl.DateTimeFormat(language === "de" ? "de-DE" : "en", {
                        dateStyle: "medium",
                      }).format(interview.updatedAt)}
                    </time>
                  ) : null}
                </div>
                <h2 className="mt-8 font-display text-2xl font-extrabold">
                  {interview.projectName}
                </h2>
                <p className="mt-2 text-sm text-muted">
                  {interview.passState === "unreserved"
                    ? text.interviews.reservationRequired
                    : interview.status === "in_progress"
                      ? text.interviews.currentStep(text.interviews.step[interview.step])
                      : text.interviews.language[interview.clientLanguage]}
                </p>
                <span className={`${textLink} group-hover:underline group-focus-visible:underline mt-auto inline-flex items-center gap-1 pt-6`}>
                  {text.interviews.open} <ArrowRight aria-hidden="true" size={16} />
                </span>
              </Link>
            );
          })}
        </section>
      ) : (
        <section className="mt-10 rounded-box border border-dashed border-line bg-panel p-8 text-center">
          <h2 className="font-display text-2xl font-extrabold">
            {text.interviews.emptyTitle}
          </h2>
          <p className="mt-2 text-muted">
            {text.interviews.emptyIntro}
          </p>
        </section>
      )}
    </main>
  );
};
