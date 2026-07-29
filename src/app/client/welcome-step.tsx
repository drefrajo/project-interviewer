import { Clock3, Eye, ShieldAlert, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import type {
  ClientInterviewView,
  ClientLanguage,
} from "../../infrastructure/interview-api";
import { primaryButton } from "../shared/form-controls";

const copy = {
  en: {
    invitedBy: "Interview from",
    intro:
      "Answer a focused conversation, review the resulting Project Document, then choose a rough visual direction.",
    duration: "About 10 minutes",
    shared: "Your responses and final handoff are shared with the named Creator.",
    sensitive: "Do not submit sensitive personal data.",
    concepts: "Visual Concepts are rough directions, not final designs.",
    providers: "External providers are used for AI functionality.",
    model: "Interview model",
    start: "Start interview",
  },
  de: {
    invitedBy: "Interview von",
    intro:
      "Beantworten Sie einige gezielte Fragen, prüfen Sie das Projektdokument und wählen Sie anschließend eine grobe visuelle Richtung.",
    duration: "Etwa 10 Minuten",
    shared:
      "Ihre Antworten und die endgültige Übergabe werden mit dem genannten Creator geteilt.",
    sensitive: "Übermitteln Sie keine sensiblen personenbezogenen Daten.",
    concepts: "Visuelle Konzepte sind grobe Richtungen, keine finalen Designs.",
    providers: "Für KI-Funktionen werden externe Anbieter verwendet.",
    model: "Interviewmodell",
    start: "Interview starten",
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
  return (
    <section className="mx-auto w-full max-w-3xl rounded-2xl border border-line bg-surface p-6 shadow-[0_1.5rem_4rem_rgb(19_34_29_/_7%)] sm:p-10">
      <p className="text-xs font-extrabold tracking-[0.14em] text-forest uppercase">
        {text.invitedBy} {interview.creator.displayName}
      </p>
      <h1 className="mt-3 font-display text-4xl leading-tight font-extrabold tracking-tight sm:text-5xl">
        {interview.projectName}
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-8 text-muted">{text.intro}</p>
      <dl className="mt-8 grid gap-4 sm:grid-cols-2">
        <Disclosure icon={<Clock3 />} text={text.duration} />
        <Disclosure icon={<Eye />} text={text.shared} />
        <Disclosure icon={<ShieldAlert />} text={text.sensitive} />
        <Disclosure icon={<Sparkles />} text={text.concepts} />
      </dl>
      <div className="mt-8 rounded-lg bg-soft p-4 text-sm leading-6 text-muted">
        <p>
          <strong className="text-ink">{text.model}:</strong>{" "}
          {interview.modelFamily}
        </p>
        <p className="mt-1">{text.providers}</p>
        <p className="mt-2">
          {interview.creator.displayName} · {interview.creator.email}
        </p>
      </div>
      <button
        className={`${primaryButton} mt-8 w-full sm:w-auto`}
        disabled={pending}
        onClick={onStart}
        type="button"
      >
        {text.start}
      </button>
    </section>
  );
};

const Disclosure = ({ icon, text }: { icon: ReactNode; text: string }) => (
  <div className="flex gap-3 rounded-lg border border-line bg-surface p-4">
    <span aria-hidden="true" className="mt-0.5 text-forest">
      {icon}
    </span>
    <dd className="text-sm leading-6 text-muted">{text}</dd>
  </div>
);
