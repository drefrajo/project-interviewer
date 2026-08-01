import { useEffect, useState } from "react";

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

const browserLanguages = () => {
  if (typeof navigator === "undefined") return [];
  return navigator.languages?.length
    ? navigator.languages
    : navigator.language
      ? [navigator.language]
      : [];
};

export const useCreatorLanguage = (): CreatorLanguage => {
  const [language] = useState(() =>
    creatorLanguageFromBrowser(browserLanguages()),
  );

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return language;
};
