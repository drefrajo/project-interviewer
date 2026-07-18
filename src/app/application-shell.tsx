import { Languages } from "lucide-react";
import { Outlet } from "react-router-dom";
import { I18nProvider, useI18n } from "./i18n";

export const ApplicationShell = () => (
  <I18nProvider>
    <Shell />
  </I18nProvider>
);

const Shell = () => {
  const { locale, setLocale, t } = useI18n();
  return (
  <div className="min-h-screen bg-canvas text-ink">
    <a className="skip-link" href="#main-content">
      {t("skip")}
    </a>
    <header className="flex min-h-[4.5rem] items-center justify-between border-b border-line px-4 py-3 sm:px-8 lg:px-16">
      <a className="flex items-center gap-3 font-display font-extrabold text-ink no-underline" href="/">
        <span aria-hidden="true" className="inline-flex size-9 items-center justify-center rounded-full bg-forest font-sans tracking-[-0.08em] text-lime">
          PI
        </span>
        <span className="hidden sm:inline">Project Interviewer</span>
      </a>
      <div className="flex items-center gap-2 text-xs font-bold tracking-[0.08em] text-muted" aria-label={t("languages")}>
        <Languages aria-hidden="true" size={17} />
        <button
          aria-pressed={locale === "en"}
          className="min-h-0 cursor-pointer rounded px-2 py-1 text-xs font-extrabold text-muted aria-pressed:bg-forest aria-pressed:text-white"
          onClick={() => setLocale("en")}
          type="button"
        >
          EN
        </button>
        <button
          aria-pressed={locale === "de"}
          className="min-h-0 cursor-pointer rounded px-2 py-1 text-xs font-extrabold text-muted aria-pressed:bg-forest aria-pressed:text-white"
          onClick={() => setLocale("de")}
          type="button"
        >
          DE
        </button>
      </div>
    </header>
    <Outlet />
  </div>
  );
};
