import { useAction, useQuery } from "convex/react";
import { FileText, LogOut, Settings, Shapes } from "lucide-react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import type { ProductionAuthClient } from "../../infrastructure/auth-client";
import type { BrowserRuntimeMode } from "../../infrastructure/environment";
import { interviewApi, type LegalAcceptanceStatus } from "../../infrastructure/interview-api";
import { BrandMark } from "../shared/brand-mark";
import { LegalFooter } from "../shared/legal-footer";
import { primaryButton, softButton } from "../shared/form-controls";
import { ThemeToggle } from "../shared/theme-toggle";
import { creatorCopy } from "./creator-copy";
import { useCreatorLanguage } from "./creator-language";
import { hasCompletePublicCreatorIdentity } from "./creator-profile-readiness";
import { CreatorOnboarding } from "./onboarding-flow";

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
  const navigate = useNavigate();
  const tabs = [
    { to: "/interviews", label: text.shell.tabs.interviews, icon: FileText },
    { to: "/templates", label: text.shell.tabs.templates, icon: Shapes },
    { to: "/settings", label: text.shell.tabs.settings, icon: Settings },
  ] as const;
  const profile = useQuery(interviewApi.creator_profiles.getCurrent, {});
  const profileEmail = profile?.email;
  const getLegalStatus = useAction(interviewApi.legal.getStatus);
  const [legalStatus, setLegalStatus] = useState<LegalAcceptanceStatus | null>(
    null,
  );
  const [legalError, setLegalError] = useState(false);
  const [legalCheckAttempt, setLegalCheckAttempt] = useState(0);
  const [onboardingActive, setOnboardingActive] = useState<boolean | null>(null);
  const balance = useQuery(
    interviewApi.billing.getBalance,
    legalStatus?.accepted && onboardingActive === false ? {} : "skip",
  );

  useEffect(() => {
    if (!profileEmail) return;
    let active = true;
    setLegalStatus(null);
    setLegalError(false);
    setOnboardingActive(null);
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

  useEffect(() => {
    if (legalStatus === null || !profile) return;
    setOnboardingActive((active) =>
      active ?? (!legalStatus.accepted || !hasCompletePublicCreatorIdentity(profile)),
    );
  }, [legalStatus, profile]);

  const dashboardContent = legalError ? (
    <LegalAcceptanceError
      language={language}
      onRetry={() => setLegalCheckAttempt((attempt) => attempt + 1)}
    />
  ) : legalStatus === null || onboardingActive === null ? (
    <LegalAcceptanceLoading language={language} />
  ) : onboardingActive && profile ? (
    <CreatorOnboarding
      legalStatus={legalStatus}
      onComplete={() => {
        setOnboardingActive(false);
        navigate("/interviews", { replace: true });
      }}
      onLegalAccepted={setLegalStatus}
      profile={profile}
    />
  ) : (
    <Outlet />
  );
  const workspaceReady = onboardingActive === false;
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <a className="skip-link" href="#main-content">
        {text.shell.skipToMain}
      </a>
      <header className="border-b border-line bg-surface px-4 sm:px-8">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4">
          {workspaceReady ? (
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
          ) : (
            <div className="flex items-center gap-3 font-display font-extrabold text-ink">
              <BrandMark />
              <span className="hidden sm:inline">
                Interview
                {deploymentMode !== "production"
                  ? ` | ${deploymentMode === "local" ? "local" : "dev"}`
                  : ""}
              </span>
            </div>
          )}
          <div className="flex items-center gap-3 text-sm text-muted">
            <span className="hidden sm:inline">{profile?.displayName}</span>
            {workspaceReady ? (
              <Link className={softButton} to="/settings#passes">
                {balance
                  ? text.shell.passBalance(balance.availablePasses)
                  : text.shell.buyPasses}
              </Link>
            ) : null}
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
      {workspaceReady ? (
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
