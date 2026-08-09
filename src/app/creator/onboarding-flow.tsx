import { useAction, useMutation } from "convex/react";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  FileCheck2,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  interviewApi,
  type CreatorProfile,
  type LegalAcceptanceStatus,
} from "../../infrastructure/interview-api";
import { Field, primaryButton, secondaryButton, TextInput } from "../shared/form-controls";
import { legalDocumentHrefs } from "../shared/legal-footer";
import { creatorCopy } from "./creator-copy";
import { useCreatorLanguage } from "./creator-language";
import { hasCompletePublicCreatorIdentity } from "./creator-profile-readiness";
import { PassPackages } from "./passes-section";

type OnboardingStep = "welcome" | "legal" | "profile" | "passes";

type OnboardingCopy = {
  eyebrow: string;
  steps: Record<OnboardingStep, string>;
  progress(current: number, total: number): string;
  back: string;
  welcome: {
    eyebrow: string;
    title: string;
    description: string;
    highlights: {
      legal: string;
      profile: string;
      firstPass: string;
    };
    start: string;
  };
  legal: {
    eyebrow: string;
    title: string;
    description: string;
    terms: string;
    termsDescription: string;
    dpa: string;
    dpaDescription: string;
    checkbox: string;
    continue: string;
    accepting: string;
  };
  profile: {
    eyebrow: string;
    title: string;
    description: string;
    username: string;
    usernameHint: string;
    contactEmail: string;
    contactEmailHint(email: string): string;
    privacyPolicyUrl: string;
    privacyPolicyUrlHint: string;
    save: string;
    saving: string;
  };
  passes: {
    eyebrow: string;
    title: string;
    description: string;
    packageIntro: string;
    getStarted: string;
  };
  error: string;
};

const buildOnboardingSteps = (
  profile: CreatorProfile,
  legalStatus: LegalAcceptanceStatus,
): OnboardingStep[] => [
  ...(legalStatus.accepted ? [] : (["welcome", "legal"] as const)),
  ...(hasCompletePublicCreatorIdentity(profile) ? [] : (["profile"] as const)),
  "passes",
];

export const CreatorOnboarding = ({
  profile,
  legalStatus,
  onLegalAccepted,
  onComplete,
}: {
  profile: CreatorProfile;
  legalStatus: LegalAcceptanceStatus;
  onLegalAccepted(status: LegalAcceptanceStatus): void;
  onComplete(): void;
}) => {
  const language = useCreatorLanguage();
  const text = creatorCopy[language];
  const acceptCurrentLegal = useAction(interviewApi.legal.acceptCurrent);
  const updateSettings = useMutation(interviewApi.creator_profiles.updateSettings);
  const [steps] = useState(() => buildOnboardingSteps(profile, legalStatus));
  const [step, setStep] = useState<OnboardingStep>(steps[0]!);
  const [legalChecked, setLegalChecked] = useState(false);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [contactEmail, setContactEmail] = useState(
    profile.contactEmail ?? profile.email,
  );
  const [privacyPolicyUrl, setPrivacyPolicyUrl] = useState(
    profile.privacyPolicyUrl ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const stepIndex = steps.indexOf(step);
  const nextStep = () => steps[stepIndex + 1];
  const previousStep = () => steps[stepIndex - 1];

  const goBack = () => {
    const previous = previousStep();
    if (previous) {
      setError("");
      setStep(previous);
    }
  };

  const submitLegal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!legalChecked || busy) return;
    setBusy(true);
    setError("");
    try {
      const status = await acceptCurrentLegal({});
      onLegalAccepted(status);
      const next = nextStep();
      if (next) setStep(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : text.onboarding.error);
    } finally {
      setBusy(false);
    }
  };

  const submitProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !displayName.trim() || !contactEmail.trim()) return;
    setBusy(true);
    setError("");
    try {
      await updateSettings({
        displayName: displayName.trim(),
        contactEmail: contactEmail.trim(),
        language,
        ...(privacyPolicyUrl.trim()
          ? { privacyPolicyUrl: privacyPolicyUrl.trim() }
          : {}),
      });
      const next = nextStep();
      if (next) setStep(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : text.onboarding.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex-1 px-4 py-8 sm:px-8 sm:py-12" id="main-content">
      <div className="mx-auto w-full max-w-4xl">
        <OnboardingProgress
          current={step}
          steps={steps}
          text={text.onboarding}
        />
        {error ? (
          <p
            className="mt-5 rounded-lg border border-error-border bg-error-surface p-4 font-bold text-error-text"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <div className="mt-5">
          {step === "welcome" ? (
            <WelcomeScreen onContinue={() => setStep(nextStep()!)} text={text.onboarding} />
          ) : step === "legal" ? (
            <LegalScreen
              busy={busy}
              checked={legalChecked}
              hrefs={legalDocumentHrefs[language]}
              onBack={goBack}
              onCheckedChange={setLegalChecked}
              onSubmit={submitLegal}
              text={text.onboarding}
            />
          ) : step === "profile" ? (
            <ProfileScreen
              busy={busy}
              contactEmail={contactEmail}
              displayName={displayName}
              onBack={goBack}
              onContactEmailChange={setContactEmail}
              onDisplayNameChange={setDisplayName}
              onPrivacyPolicyUrlChange={setPrivacyPolicyUrl}
              onSubmit={submitProfile}
              privacyPolicyUrl={privacyPolicyUrl}
              suggestedEmail={profile.email}
              text={text.onboarding}
            />
          ) : (
            <PassesScreen
              onBack={goBack}
              onComplete={onComplete}
              text={text.onboarding}
            />
          )}
        </div>
      </div>
    </main>
  );
};

const OnboardingProgress = ({
  current,
  steps,
  text,
}: {
  current: OnboardingStep;
  steps: OnboardingStep[];
  text: OnboardingCopy;
}) => {
  const currentIndex = steps.indexOf(current);
  return (
    <header>
      <p className="text-xs font-extrabold tracking-[0.14em] text-primary uppercase">
        {text.eyebrow}
      </p>
      <div
        aria-label={text.progress(currentIndex + 1, steps.length)}
        className="mt-5 grid gap-2 sm:grid-cols-4"
        role="list"
      >
        {steps.map((step, index) => (
          <div
            aria-current={step === current ? "step" : undefined}
            className={`border-t-2 pt-2 text-xs font-bold sm:text-sm ${
              index <= currentIndex
                ? "border-primary text-primary"
                : "border-line text-muted"
            }`}
            key={step}
            role="listitem"
          >
            <span className="mr-1.5 inline-grid size-5 place-items-center rounded-full bg-soft text-[0.7rem]">
              {index < currentIndex ? <Check aria-hidden="true" size={13} /> : index + 1}
            </span>
            {text.steps[step]}
          </div>
        ))}
      </div>
    </header>
  );
};

const WelcomeScreen = ({
  onContinue,
  text,
}: {
  onContinue(): void;
  text: OnboardingCopy;
}) => (
  <OnboardingCard icon={<Sparkles />}>
    <p className="text-xs font-extrabold tracking-[0.14em] text-primary uppercase">
      {text.welcome.eyebrow}
    </p>
    <h1 className="mt-2 max-w-2xl font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
      {text.welcome.title}
    </h1>
    <p className="mt-5 max-w-2xl text-lg leading-8 text-muted">
      {text.welcome.description}
    </p>
    <ul className="mt-8 grid gap-3 sm:grid-cols-3">
      {[
        { icon: <FileCheck2 aria-hidden="true" />, label: text.welcome.highlights.legal },
        { icon: <UserRound aria-hidden="true" />, label: text.welcome.highlights.profile },
        { icon: <ShieldCheck aria-hidden="true" />, label: text.welcome.highlights.firstPass },
      ].map(({ icon, label }) => (
        <li className="flex gap-3 rounded-box border border-line bg-panel p-4 text-sm leading-6" key={label}>
          <span className="mt-0.5 shrink-0 text-primary">{icon}</span>
          <span>{label}</span>
        </li>
      ))}
    </ul>
    <OnboardingActions>
      <button className={primaryButton} onClick={onContinue} type="button">
        {text.welcome.start}
        <ChevronRight aria-hidden="true" size={17} />
      </button>
    </OnboardingActions>
  </OnboardingCard>
);

const LegalScreen = ({
  busy,
  checked,
  hrefs,
  onBack,
  onCheckedChange,
  onSubmit,
  text,
}: {
  busy: boolean;
  checked: boolean;
  hrefs: { terms: string; dpa: string };
  onBack(): void;
  onCheckedChange(checked: boolean): void;
  onSubmit(event: FormEvent<HTMLFormElement>): void;
  text: OnboardingCopy;
}) => (
  <OnboardingCard icon={<FileCheck2 />}>
    <p className="text-xs font-extrabold tracking-[0.14em] text-primary uppercase">
      {text.legal.eyebrow}
    </p>
    <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
      {text.legal.title}
    </h1>
    <p className="mt-4 max-w-2xl leading-7 text-muted">{text.legal.description}</p>
    <div className="mt-7 grid gap-3 sm:grid-cols-2">
      <LegalDocumentCard
        description={text.legal.termsDescription}
        href={hrefs.terms}
        label={text.legal.terms}
      />
      <LegalDocumentCard
        description={text.legal.dpaDescription}
        href={hrefs.dpa}
        label={text.legal.dpa}
      />
    </div>
    <form className="mt-7" onSubmit={onSubmit}>
      <label className="flex cursor-pointer items-start gap-3 text-sm font-semibold leading-6 text-ink">
        <input
          checked={checked}
          className="mt-1 size-4 accent-primary"
          onChange={(event) => onCheckedChange(event.target.checked)}
          required
          type="checkbox"
        />
        <span>{text.legal.checkbox}</span>
      </label>
      <OnboardingActions>
        <button className={secondaryButton} onClick={onBack} type="button">
          <ArrowLeft aria-hidden="true" size={17} />
          {text.back}
        </button>
        <button className={primaryButton} disabled={!checked || busy} type="submit">
          {busy ? text.legal.accepting : text.legal.continue}
          {!busy ? <ChevronRight aria-hidden="true" size={17} /> : null}
        </button>
      </OnboardingActions>
    </form>
  </OnboardingCard>
);

const LegalDocumentCard = ({
  description,
  href,
  label,
}: {
  description: string;
  href: string;
  label: string;
}) => (
  <a
    className="rounded-box border border-line bg-panel p-4 no-underline transition hover:border-primary hover:bg-soft-hover"
    href={href}
    rel="noopener noreferrer"
    target="_blank"
  >
    <span className="font-extrabold text-primary">{label}</span>
    <span className="mt-1 block text-sm leading-6 text-muted">{description}</span>
  </a>
);

const ProfileScreen = ({
  busy,
  contactEmail,
  displayName,
  onBack,
  onContactEmailChange,
  onDisplayNameChange,
  onPrivacyPolicyUrlChange,
  onSubmit,
  privacyPolicyUrl,
  suggestedEmail,
  text,
}: {
  busy: boolean;
  contactEmail: string;
  displayName: string;
  onBack(): void;
  onContactEmailChange(value: string): void;
  onDisplayNameChange(value: string): void;
  onPrivacyPolicyUrlChange(value: string): void;
  onSubmit(event: FormEvent<HTMLFormElement>): void;
  privacyPolicyUrl: string;
  suggestedEmail: string;
  text: OnboardingCopy;
}) => (
  <OnboardingCard icon={<UserRound />}>
    <p className="text-xs font-extrabold tracking-[0.14em] text-primary uppercase">
      {text.profile.eyebrow}
    </p>
    <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
      {text.profile.title}
    </h1>
    <p className="mt-4 max-w-2xl leading-7 text-muted">{text.profile.description}</p>
    <form className="mt-7 grid max-w-2xl gap-5" onSubmit={onSubmit}>
      <Field hint={text.profile.usernameHint} label={text.profile.username}>
        <TextInput
          maxLength={120}
          onChange={(event) => onDisplayNameChange(event.target.value)}
          required
          value={displayName}
        />
      </Field>
      <Field
        hint={text.profile.contactEmailHint(suggestedEmail)}
        label={text.profile.contactEmail}
      >
        <TextInput
          onChange={(event) => onContactEmailChange(event.target.value)}
          required
          type="email"
          value={contactEmail}
        />
      </Field>
      <Field
        hint={text.profile.privacyPolicyUrlHint}
        label={text.profile.privacyPolicyUrl}
      >
        <TextInput
          onChange={(event) => onPrivacyPolicyUrlChange(event.target.value)}
          type="url"
          value={privacyPolicyUrl}
        />
      </Field>
      <OnboardingActions>
        <button className={secondaryButton} onClick={onBack} type="button">
          <ArrowLeft aria-hidden="true" size={17} />
          {text.back}
        </button>
        <button
          className={primaryButton}
          disabled={busy || !displayName.trim() || !contactEmail.trim()}
          type="submit"
        >
          {busy ? text.profile.saving : text.profile.save}
          {!busy ? <ChevronRight aria-hidden="true" size={17} /> : null}
        </button>
      </OnboardingActions>
    </form>
  </OnboardingCard>
);

const PassesScreen = ({
  onBack,
  onComplete,
  text,
}: {
  onBack(): void;
  onComplete(): void;
  text: OnboardingCopy;
}) => (
  <OnboardingCard icon={<ShieldCheck />}>
    <p className="text-xs font-extrabold tracking-[0.14em] text-primary uppercase">
      {text.passes.eyebrow}
    </p>
    <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
      {text.passes.title}
    </h1>
    <p className="mt-4 max-w-2xl leading-7 text-muted">{text.passes.description}</p>
    <p className="mt-5 text-sm font-bold text-muted">{text.passes.packageIntro}</p>
    <div className="mt-5">
      <PassPackages />
    </div>
    <OnboardingActions>
      <button className={secondaryButton} onClick={onBack} type="button">
        <ArrowLeft aria-hidden="true" size={17} />
        {text.back}
      </button>
      <button className={primaryButton} onClick={onComplete} type="button">
        {text.passes.getStarted}
        <ChevronRight aria-hidden="true" size={17} />
      </button>
    </OnboardingActions>
  </OnboardingCard>
);

const OnboardingCard = ({
  children,
  icon,
}: {
  children: ReactNode;
  icon: ReactNode;
}) => (
  <section className="rounded-box border border-line bg-surface p-6 shadow-[0_1.5rem_4rem_rgb(15_23_42_/_8%)] dark:shadow-[0_1.5rem_4rem_rgb(2_6_23_/_50%)] sm:p-9">
    <div className="grid size-12 place-items-center rounded-full bg-soft text-primary">
      {icon}
    </div>
    {children}
  </section>
);

const OnboardingActions = ({ children }: { children: ReactNode }) => (
  <div className="mt-8 flex flex-wrap gap-3">{children}</div>
);
