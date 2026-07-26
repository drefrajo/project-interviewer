import type {
  ClientInterviewView,
  ClientLanguage,
  VisualDirection,
} from "../../infrastructure/interview-api";
import { SafeMarkdown } from "../shared/safe-markdown";
import { CLIENT_COPY } from "./client-copy";

const directionText = (
  direction: VisualDirection | undefined,
  language: ClientLanguage,
) => {
  if (!direction) return language === "de" ? "Nicht verfügbar" : "Unavailable";
  if (direction.kind === "concept") {
    return `${language === "de" ? "Ausgewähltes Konzept" : "Selected concept"}: ${direction.conceptId ?? "—"}`;
  }
  return direction.inspirationLinks?.join("\n") ?? "—";
};

export const SubmittedStep = ({
  interview,
}: {
  interview: ClientInterviewView;
}) => {
  const text = CLIENT_COPY[interview.clientLanguage];
  return (
    <section className="mx-auto w-full max-w-5xl">
      <header className="rounded-xl bg-forest p-6 text-white sm:p-8">
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
            <figure className="overflow-hidden rounded-xl border border-line bg-white" key={concept.id}>
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
        <p className="mt-3 whitespace-pre-wrap leading-7 text-muted">
          {directionText(interview.visualDirection, interview.clientLanguage)}
        </p>
        {interview.visualDirection?.note ? (
          <p className="mt-3 border-l-4 border-lime pl-4 leading-7">
            {interview.visualDirection.note}
          </p>
        ) : null}
      </section>
      <footer className="mt-7 text-sm text-muted">
        {interview.creator.displayName} · {interview.creator.email}
      </footer>
    </section>
  );
};

