import { useQuery } from "convex/react";
import { FileText, LogOut, Settings, Shapes, ShieldAlert } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";
import type { ProductionAuthClient } from "../../infrastructure/auth-client";
import type { BrowserRuntimeMode } from "../../infrastructure/environment";
import { interviewApi } from "../../infrastructure/interview-api";
import { BrandMark } from "../shared/brand-mark";
import { LegalFooter } from "../shared/legal-footer";
import { softButton } from "../shared/form-controls";
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
  const balance = useQuery(interviewApi.billing.getBalance, {});
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
      <div className="flex-1">
        <Outlet />
      </div>
      <LegalFooter language={language} />
    </div>
  );
};
