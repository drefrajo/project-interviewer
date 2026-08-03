import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type CreatorLanguage = "en" | "de";

const browserLanguageBase = (value: string) =>
  value.trim().toLowerCase().replaceAll("_", "-").split("-")[0];

export const creatorLanguageFromBrowser = (
  languages: readonly string[],
): CreatorLanguage => {
  for (const language of languages) {
    const base = browserLanguageBase(language);
    if (base === "de") return "de";
    if (base === "en") return "en";
  }
  return "en";
};

export const browserLanguages = () => {
  if (typeof navigator === "undefined") return [];
  return navigator.languages?.length
    ? navigator.languages
    : navigator.language
      ? [navigator.language]
      : [];
};

export const creatorLanguageFromCurrentBrowser = (): CreatorLanguage =>
  creatorLanguageFromBrowser(browserLanguages());

type CreatorLanguageContextValue = {
  language: CreatorLanguage;
  setLanguage: (language: CreatorLanguage) => void;
};

const CreatorLanguageContext = createContext<CreatorLanguageContextValue>({
  language: creatorLanguageFromCurrentBrowser(),
  setLanguage: () => undefined,
});

export const CreatorLanguageProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [language, setLanguage] = useState<CreatorLanguage>(
    creatorLanguageFromCurrentBrowser,
  );

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return createElement(
    CreatorLanguageContext.Provider,
    { value: { language, setLanguage } },
    children,
  );
};

export const useCreatorLanguage = (): CreatorLanguage =>
  useContext(CreatorLanguageContext).language;

export const useSetCreatorLanguage = () =>
  useContext(CreatorLanguageContext).setLanguage;
