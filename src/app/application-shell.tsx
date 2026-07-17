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
  <div className="app-shell">
    <a className="skip-link" href="#main-content">
      {t("skip")}
    </a>
    <header className="site-header">
      <a className="brand" href="/">
        <span aria-hidden="true" className="brand-mark">
          PI
        </span>
        <span>Project Interviewer</span>
      </a>
      <div className="language-indicator" aria-label={t("languages")}>
        <Languages aria-hidden="true" size={17} />
        <button
          aria-pressed={locale === "en"}
          onClick={() => setLocale("en")}
          type="button"
        >
          EN
        </button>
        <button
          aria-pressed={locale === "de"}
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
