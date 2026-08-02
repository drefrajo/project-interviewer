import { textLink } from "./form-controls";

type LegalFooterLanguage = "de" | "en";

const copy = {
  en: {
    label: "Legal information",
    privacy: "Privacy policy",
    imprint: "Imprint",
    privacyHref: "https://drefrajo.dev/en/privacy",
    imprintHref: "https://drefrajo.dev/en/imprint",
  },
  de: {
    label: "Rechtliche Informationen",
    privacy: "Datenschutz",
    imprint: "Impressum",
    privacyHref: "https://drefrajo.dev/privacy",
    imprintHref: "https://drefrajo.dev/imprint",
  },
} as const satisfies Record<
  LegalFooterLanguage,
  {
    label: string;
    privacy: string;
    imprint: string;
    privacyHref: string;
    imprintHref: string;
  }
>;

export const LegalFooter = ({
  language = "en",
}: {
  language?: LegalFooterLanguage;
}) => {
  const text = copy[language];
  return (
    <footer
      aria-label={text.label}
      className="border-t border-line bg-panel px-4 py-5 text-sm text-muted sm:px-8"
    >
      <nav
        aria-label={text.label}
        className="mx-auto flex max-w-7xl flex-wrap justify-center gap-x-5 gap-y-2 sm:justify-end"
      >
        <a
          className={`${textLink} text-sm text-muted hover:text-primary`}
          href={text.privacyHref}
          rel="noopener noreferrer"
          target="_blank"
        >
          {text.privacy}
        </a>
        <a
          className={`${textLink} text-sm text-muted hover:text-primary`}
          href={text.imprintHref}
          rel="noopener noreferrer"
          target="_blank"
        >
          {text.imprint}
        </a>
      </nav>
    </footer>
  );
};
