import { useAction, useQuery } from "convex/react";
import { FileText, LogOut, Settings, Shapes, ShieldAlert } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useEffect, useState, type FormEvent } from "react";
import type { ProductionAuthClient } from "../../infrastructure/auth-client";
import type { BrowserRuntimeMode } from "../../infrastructure/environment";
import {
  interviewApi,
  type LegalAcceptanceStatus,
} from "../../infrastructure/interview-api";
import { BrandMark } from "../shared/brand-mark";
import {
  legalDocumentHrefs,
  LegalFooter,
} from "../shared/legal-footer";
import { primaryButton, softButton } from "../shared/form-controls";
import { ThemeToggle } from "../shared/theme-toggle";
import { creatorCopy } from "./creator-copy";
import { useCreatorLanguage } from "./creator-language";
import { hasCompletePublicCreatorIdentity } from "./creator-profile-readiness";

export const CreatorShell = ({
  authClient,
  deploymentMode = "production",
  localDevelopment = false,
}: {
  authClient: ProductionAuthClient;
  deploymentMode?: BrowserRuntimeMode;
  localDevelopment?: boolean;
}) => {
  const language = useCreatorLanguage();
  const text = creatorCopy[language];
  const tabs = [
    { to: "/interviews", label: text.shell.tabs.interviews, icon: FileText },
    { to: "/templates", label: text.shell.tabs.templates, icon: Shapes },
    { to: "/settings", label: text.shell.tabs.settings, icon: Settings },
  ] as const;
  const profile = useQuery(interviewApi.creator_profiles.getCurrent, {});
  const profileEmail = profile?.email;
  const getLegalStatus = useAction(interviewApi.legal.getStatus);
  const acceptCurrentLegal = useAction(interviewApi.legal.acceptCurrent);
  const [legalStatus, setLegalStatus] = useState<LegalAcceptanceStatus | null>(
    null,
  );
  const [legalError, setLegalError] = useState(false);
  const [legalCheckAttempt, setLegalCheckAttempt] = useState(0);
  const [legalCheckboxChecked, setLegalCheckboxChecked] = useState(false);
  const [acceptingLegal, setAcceptingLegal] = useState(false);
  const balance = useQuery(
    interviewApi.billing.getBalance,
    legalStatus?.accepted ? {} : "skip",
  );

  useEffect(() => {
    if (!profileEmail) return;
    let active = true;
    setLegalStatus(null);
    setLegalError(false);
    setLegalCheckboxChecked(false);
    void getLegalStatus({})
      .then((status) => {
        if (!active) return;
        setLegalStatus(status);
      })
      .catch(() => {
        if (!active) return;
        setLegalError(true);
      });
    return () => {
      active = false;
    };
  }, [getLegalStatus, legalCheckAttempt, profileEmail]);

  const submitLegalAcceptance = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!legalCheckboxChecked || acceptingLegal) return;
    setAcceptingLegal(true);
    void acceptCurrentLegal({})
      .then((status) => {
        setLegalStatus(status);
        setLegalCheckboxChecked(false);
      })
      .catch(() => {
        setLegalError(true);
      })
      .finally(() => {
        setAcceptingLegal(false);
      });
  };

  const dashboardContent = legalError ? (
    <LegalAcceptanceError
      language={language}
      onRetry={() => setLegalCheckAttempt((attempt) => attempt + 1)}
    />
  ) : legalStatus === null ? (
    <LegalAcceptanceLoading language={language} />
  ) : legalStatus.accepted ? (
    <Outlet />
  ) : (
    <LegalAcceptancePrompt
      accepting={acceptingLegal}
      checked={legalCheckboxChecked}
      language={language}
      onCheckedChange={setLegalCheckboxChecked}
      onSubmit={submitLegalAcceptance}
    />
  );
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <a className="skip-link" href="#main-content">
        {text.shell.skipToMain}
      </a>
      <header className="border-b border-line bg-surface px-4 sm:px-8">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4">
          <NavLink
            className="flex items-center gap-3 font-display font-extrabold text-ink no-underline"
            to="/interviews"
          >
            <BrandMark />
            <span className="hidden sm:inline">
              Interview
              {deploymentMode !== "production"
                ? ` | ${deploymentMode === "local" ? "local" : "dev"}`
                : ""}
            </span>
          </NavLink>
          <div className="flex items-center gap-3 text-sm text-muted">
            <span className="hidden sm:inline">{profile?.displayName}</span>
            <Link
              className={softButton}
              to="/settings#passes"
            >
              {balance
                ? text.shell.passBalance(balance.availablePasses)
                : text.shell.buyPasses}
            </Link>
            <ThemeToggle />
            {!localDevelopment ? (
              <button
                aria-label={text.shell.signOut}
                className="inline-grid size-12 place-items-center rounded-field transition hover:bg-soft"
                onClick={() => void authClient.signOut()}
                type="button"
              >
                <LogOut aria-hidden="true" size={18} />
              </button>
            ) : null}
          </div>
        </div>
      </header>
      <nav aria-label={text.shell.workspace} className="border-b border-line bg-surface px-4 sm:px-8">
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto">
          {tabs.map(({ to, label, icon: Icon }) => (
            <NavLink
              className={({ isActive }) =>
                `inline-flex min-h-12 items-center gap-2 border-b-2 px-3 text-sm font-semibold no-underline ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted hover:text-ink"
                }`
              }
              key={to}
              to={to}
            >
              <Icon aria-hidden="true" size={17} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
      {profile && !hasCompletePublicCreatorIdentity(profile) ? (
        <aside
          className="border-b border-amber-300 bg-amber-50 px-4 py-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100 sm:px-8"
          role="alert"
        >
          <div className="mx-auto flex max-w-7xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <ShieldAlert aria-hidden="true" className="mt-0.5 shrink-0" size={20} />
              <div>
                <p className="font-extrabold">{text.shell.profileIncompleteTitle}</p>
                <p className="mt-1 text-sm leading-6">
                  {text.shell.profileIncompleteDescription}
                </p>
              </div>
            </div>
            <Link className={softButton} to="/settings#settings-profile">
              {text.shell.completeSettings}
            </Link>
          </div>
        </aside>
      ) : null}
      <div className="flex-1">{dashboardContent}</div>
      <LegalFooter language={language} />
    </div>
  );
};

const LegalAcceptanceLoading = ({
  language,
}: {
  language: "en" | "de";
}) => {
  const text = creatorCopy[language];
  return (
    <main
      className="grid min-h-[28rem] place-items-center px-4 py-12"
      id="main-content"
    >
      <p className="font-bold text-muted" role="status">
        {text.legal.loading}
      </p>
    </main>
  );
};

const LegalAcceptanceError = ({
  language,
  onRetry,
}: {
  language: "en" | "de";
  onRetry: () => void;
}) => {
  const text = creatorCopy[language];
  return (
    <main
      className="mx-auto flex min-h-[28rem] max-w-2xl items-center px-4 py-12"
      id="main-content"
    >
      <section className="w-full rounded-box border border-error-border bg-error-surface p-6 sm:p-9">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-error-text">
          {text.legal.errorTitle}
        </h1>
        <p className="mt-4 leading-7 text-error-text">
          {text.legal.errorDescription}
        </p>
        <button
          className={`${primaryButton} mt-6`}
          onClick={onRetry}
          type="button"
        >
          {text.legal.retry}
        </button>
      </section>
    </main>
  );
};

const LegalAcceptancePrompt = ({
  accepting,
  checked,
  language,
  onCheckedChange,
  onSubmit,
}: {
  accepting: boolean;
  checked: boolean;
  language: "en" | "de";
  onCheckedChange: (checked: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) => {
  const text = creatorCopy[language];
  const hrefs = legalDocumentHrefs[language];
  return (
    <main
      className="mx-auto flex min-h-[28rem] max-w-3xl items-center px-4 py-12"
      id="main-content"
    >
      <section
        aria-labelledby="legal-acceptance-title"
        className="w-full rounded-box border border-line bg-surface p-6 shadow-xl sm:p-9"
      >
        <p className="text-xs font-extrabold tracking-[0.14em] text-primary uppercase">
          {text.legal.label}
        </p>
        <h1
          className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl"
          id="legal-acceptance-title"
        >
          {text.legal.title}
        </h1>
        <p className="mt-4 max-w-2xl leading-7 text-muted">
          {text.legal.description}
        </p>

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <a
            className="rounded-box border border-line bg-panel p-4 no-underline transition hover:border-primary hover:bg-soft-hover"
            href={hrefs.terms}
            rel="noopener noreferrer"
            target="_blank"
          >
            <span className="font-extrabold text-primary">{text.legal.terms}</span>
            <span className="mt-1 block text-sm leading-6 text-muted">
              {text.legal.termsDescription}
            </span>
          </a>
          <a
            className="rounded-box border border-line bg-panel p-4 no-underline transition hover:border-primary hover:bg-soft-hover"
            href={hrefs.dpa}
            rel="noopener noreferrer"
            target="_blank"
          >
            <span className="font-extrabold text-primary">{text.legal.dpa}</span>
            <span className="mt-1 block text-sm leading-6 text-muted">
              {text.legal.dpaDescription}
            </span>
          </a>
        </div>

        <form className="mt-7 grid gap-5" onSubmit={onSubmit}>
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
          <button
            className={primaryButton}
            disabled={!checked || accepting}
            type="submit"
          >
            {accepting ? text.legal.accepting : text.legal.continue}
          </button>
        </form>
      </section>
    </main>
  );
};
