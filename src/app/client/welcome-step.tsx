import { Clock3, Eye, ShieldAlert, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import type {
  ClientInterviewView,
  ClientLanguage,
} from "../../infrastructure/interview-api";
import { primaryButton } from "../shared/form-controls";

const copy = {
  en: {
    invitedBy: "You were invited by",
    inviterCheck:
      "Before you start, check that this name and email match the person you expect.",
    intro:
      "Answer a focused conversation, review the resulting Project Document, then choose a rough visual direction.",
    duration: "About 10 minutes",
    shared: "Your responses and final handoff are shared with the named Creator.",
    sensitive: "Do not submit sensitive personal data.",
    concepts: "Visual Concepts are rough directions, not final designs.",
    retention:
      "All Interviews are deleted after 24 months: completed Interviews after submission, and incomplete Interviews after last activity.",
    providers: "External providers are used for AI functionality.",
    aiInteraction:
      "You are interacting with an AI assistant, not a human interviewer.",
    model: "Interview model",
    privacyPolicy: "Creator privacy policy",
    start: "Start interview",
    identityUnavailableTitle: "Creator identity is not ready",
    identityUnavailable:
      "This Interview cannot be started until the Creator provides their public name and contact email.",
  },
  de: {
    invitedBy: "Sie wurden eingeladen von",
    inviterCheck:
      "Prüfen Sie vor dem Start, ob Name und E-Mail zu der Person passen, die Sie erwarten.",
    intro:
      "Beantworten Sie einige gezielte Fragen, prüfen Sie das Projektdokument und wählen Sie anschließend eine grobe visuelle Richtung.",
    duration: "Etwa 10 Minuten",
    shared:
      "Ihre Antworten und die endgültige Übergabe werden mit dem genannten Creator geteilt.",
    sensitive: "Übermitteln Sie keine sensiblen personenbezogenen Daten.",
    concepts: "Visuelle Konzepte sind grobe Richtungen, keine finalen Designs.",
    retention:
      "Alle Interviews werden nach 24 Monaten gelöscht: abgeschlossene Interviews nach der Übermittlung und unvollständige Interviews nach der letzten Aktivität.",
    providers: "Für KI-Funktionen werden externe Anbieter verwendet.",
    aiInteraction:
      "Sie interagieren mit einem KI-Assistenten, nicht mit einem menschlichen Interviewer.",
    model: "Interviewmodell",
    privacyPolicy: "Datenschutzerklärung des Creators",
    start: "Interview starten",
    identityUnavailableTitle: "Creator-Identität ist noch nicht vollständig",
    identityUnavailable:
      "Dieses Interview kann erst gestartet werden, wenn der Creator seinen öffentlichen Namen und seine Kontakt-E-Mail angegeben hat.",
  },
} as const satisfies Record<ClientLanguage, object>;

export const WelcomeStep = ({
  interview,
  pending,
  onStart,
}: {
  interview: ClientInterviewView;
  pending: boolean;
  onStart(): void;
}) => {
  const text = copy[interview.clientLanguage];
  const creator = interview.creator;
  const identityReady = interview.creatorIdentityReady && creator !== null;
  return (
    <section className="mx-auto w-full max-w-3xl rounded-box border border-line bg-panel p-6 shadow-[0_1.5rem_4rem_rgb(15_23_42_/_8%)] dark:shadow-[0_1.5rem_4rem_rgb(2_6_23_/_50%)] sm:p-10">
      <h1 className="font-display text-4xl leading-tight font-extrabold tracking-tight sm:text-5xl">
        {interview.projectName}
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-8 text-muted">{text.intro}</p>
      {identityReady && creator ? (
        <div className="mt-7 rounded-xl border-2 border-forest/30 bg-soft p-5 sm:p-6">
          <p className="text-xs font-extrabold tracking-[0.14em] text-forest uppercase">
            {text.invitedBy}
          </p>
          <address className="mt-2 not-italic">
            <p className="font-display text-2xl font-extrabold tracking-tight">
              {creator.displayName}
            </p>
            <a className="mt-1 block break-all text-base text-primary underline" href={`mailto:${creator.contactEmail}`}>
              {creator.contactEmail}
            </a>
          </address>
          {creator.privacyPolicyUrl ? (
            <a
              className="mt-3 inline-block text-sm font-bold text-primary underline"
              href={creator.privacyPolicyUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              {text.privacyPolicy}
            </a>
          ) : null}
          <p className="mt-4 text-sm leading-6 text-muted">{text.inviterCheck}</p>
        </div>
      ) : (
        <div className="mt-7 rounded-xl border-2 border-warning-border bg-warning-surface p-5 sm:p-6" role="alert">
          <h2 className="font-display text-xl font-extrabold">{text.identityUnavailableTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{text.identityUnavailable}</p>
        </div>
      )}
      <dl className="mt-8 grid gap-4 sm:grid-cols-2">
        <Disclosure icon={<Clock3 />} text={text.duration} />
        <Disclosure icon={<Eye />} text={text.shared} />
        <Disclosure icon={<ShieldAlert />} text={text.sensitive} />
        <Disclosure icon={<Sparkles />} text={text.concepts} />
        <Disclosure icon={<ShieldAlert />} text={text.retention} />
      </dl>
      <div className="mt-8 rounded-lg bg-soft p-4 text-sm leading-6 text-muted">
        <p>
          <strong className="text-ink">{text.model}:</strong>{" "}
          {interview.modelFamily}
        </p>
        <p className="mt-1">{text.providers}</p>
        <p className="mt-1 font-bold text-ink">{text.aiInteraction}</p>
      </div>
      <button
        className={`${primaryButton} mt-8 w-full sm:w-auto`}
        disabled={pending || !identityReady}
        onClick={onStart}
        type="button"
      >
        {text.start}
      </button>
    </section>
  );
};

const Disclosure = ({ icon, text }: { icon: ReactNode; text: string }) => (
  <div className="flex gap-3 rounded-box border border-line bg-panel p-4">
    <span aria-hidden="true" className="mt-0.5 text-forest">
      {icon}
    </span>
    <dd className="text-sm leading-6 text-muted">{text}</dd>
  </div>
);
