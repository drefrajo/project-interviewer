import type { ClientInterviewView } from "../../infrastructure/interview-api";
import { SafeMarkdown } from "../shared/safe-markdown";
import { VisualDirectionSummary } from "../shared/visual-direction-summary";
import { CLIENT_COPY } from "./client-copy";

export const SubmittedStep = ({
  interview,
}: {
  interview: ClientInterviewView;
}) => {
  const text = CLIENT_COPY[interview.clientLanguage];
  return (
    <section className="mx-auto w-full max-w-5xl">
      <header className="rounded-xl bg-forest p-6 text-white dark:bg-forest-strong sm:p-8">
        <p className="text-xs font-extrabold tracking-[0.14em] text-lime uppercase">
          {interview.projectName}
        </p>
        <h1 className="mt-2 font-display text-4xl font-extrabold">
          {text.submittedTitle}
        </h1>
        <p className="mt-3 leading-7 text-white/80">{text.submittedIntro}</p>
      </header>
      <section className="mt-7">
        <h2 className="mb-3 font-display text-2xl font-extrabold">
          Project Document
        </h2>
        <SafeMarkdown markdown={interview.projectDocument ?? ""} />
      </section>
      <section className="mt-7">
        <h2 className="font-display text-2xl font-extrabold">Visual Concepts</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          {(interview.concepts ?? []).map((concept) => (
            <figure className="overflow-hidden rounded-xl border border-line bg-surface" key={concept.id}>
              {concept.imageUrl ? (
                <img
                  alt={`${concept.name}, rough visual direction`}
                  className="aspect-[3/2] w-full object-cover"
                  src={concept.imageUrl}
                />
              ) : null}
              <figcaption className="p-3 font-bold">{concept.name}</figcaption>
            </figure>
          ))}
        </div>
      </section>
      <section className="mt-7 rounded-xl border border-line bg-surface p-5">
        <h2 className="font-display text-2xl font-extrabold">Visual Direction</h2>
        {interview.visualDirection ? (
          <VisualDirectionSummary
            concepts={interview.concepts ?? []}
            direction={interview.visualDirection}
            language={interview.clientLanguage}
          />
        ) : (
          <p className="mt-3 leading-7 text-muted">
            {interview.clientLanguage === "de"
              ? "Nicht verfügbar"
              : "Unavailable"}
          </p>
        )}
      </section>
      <footer className="mt-7 text-sm text-muted">
        {interview.creator.displayName} · {interview.creator.email}
      </footer>
    </section>
  );
};
