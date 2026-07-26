import { useQuery } from "convex/react";
import { FileText, LogOut, Settings, Shapes } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import type { ProductionAuthClient } from "../../infrastructure/auth-client";
import { interviewApi } from "../../infrastructure/interview-api";

const tabs = [
  { to: "/interviews", label: "Interviews", icon: FileText },
  { to: "/templates", label: "Templates", icon: Shapes },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export const CreatorShell = ({
  authClient,
}: {
  authClient: ProductionAuthClient;
}) => {
  const profile = useQuery(interviewApi.creator_profiles.getCurrent, {});
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="border-b border-line bg-surface px-4 sm:px-8">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4">
          <NavLink
            className="flex items-center gap-3 font-display font-extrabold text-ink no-underline"
            to="/interviews"
          >
            <span
              aria-hidden="true"
              className="inline-grid size-9 place-items-center rounded-full bg-forest text-sm text-lime"
            >
              PI
            </span>
            <span className="hidden sm:inline">Project Interviewer</span>
          </NavLink>
          <div className="flex items-center gap-3 text-sm text-muted">
            <span className="hidden sm:inline">{profile?.displayName}</span>
            <button
              aria-label="Sign out"
              className="inline-grid size-11 place-items-center rounded-lg hover:bg-[#eef2eb]"
              onClick={() => void authClient.signOut()}
              type="button"
            >
              <LogOut aria-hidden="true" size={18} />
            </button>
          </div>
        </div>
      </header>
      <nav aria-label="Creator workspace" className="border-b border-line bg-white px-4 sm:px-8">
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto">
          {tabs.map(({ to, label, icon: Icon }) => (
            <NavLink
              className={({ isActive }) =>
                `inline-flex min-h-12 items-center gap-2 border-b-4 px-4 text-sm font-extrabold no-underline ${
                  isActive
                    ? "border-forest text-forest"
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
      <Outlet />
    </div>
  );
};

