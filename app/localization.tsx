import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Language = "ru" | "uk";

type LocalizationValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  text: (ru: string, uk: string) => string;
};

const LocalizationContext = createContext<LocalizationValue | null>(null);

export function LocalizationProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("ru");

  useEffect(() => {
    const saved = localStorage.getItem("language");
    if (saved === "uk") setLanguageState("uk");
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<LocalizationValue>(() => ({
    language,
    setLanguage(nextLanguage) {
      localStorage.setItem("language", nextLanguage);
      setLanguageState(nextLanguage);
    },
    text: (ru, uk) => language === "uk" ? uk : ru,
  }), [language]);

  return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>;
}

export function useLocalization() {
  const context = useContext(LocalizationContext);
  if (!context) throw new Error("useLocalization must be used inside LocalizationProvider");
  return context;
}

export function formatLocalizedCount(
  language: Language,
  value: number,
  ru: [string, string, string],
  uk: [string, string, string],
) {
  const [one, few, many] = language === "uk" ? uk : ru;
  const lastTwo = value % 100;
  const last = value % 10;
  const word = lastTwo >= 11 && lastTwo <= 14
    ? many
    : last === 1
      ? one
      : last >= 2 && last <= 4
        ? few
        : many;
  return `${value} ${word}`;
}
