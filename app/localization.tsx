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

export function LocalizedFormValidation() {
  const { language } = useLocalization();

  useEffect(() => {
    type FormControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    const message = (ru: string, uk: string) => language === "uk" ? uk : ru;

    function validationMessage(control: FormControl) {
      control.setCustomValidity("");
      const validity = control.validity;
      if (validity.valid) return "";
      if (validity.valueMissing) {
        if (control instanceof HTMLInputElement && control.type === "checkbox") {
          return message("Подтвердите это поле.", "Підтвердьте це поле.");
        }
        return message("Заполните это поле.", "Заповніть це поле.");
      }
      if (validity.typeMismatch) {
        return control instanceof HTMLInputElement && control.type === "email"
          ? message("Введите корректный адрес электронной почты.", "Введіть коректну адресу електронної пошти.")
          : message("Введите значение в правильном формате.", "Введіть значення у правильному форматі.");
      }
      if (validity.tooShort) {
        const lengthControl = control as HTMLInputElement | HTMLTextAreaElement;
        return message(
          `Введите не менее ${lengthControl.minLength} символов. Сейчас: ${lengthControl.value.length}.`,
          `Введіть щонайменше ${lengthControl.minLength} символів. Зараз: ${lengthControl.value.length}.`,
        );
      }
      if (validity.tooLong) {
        const lengthControl = control as HTMLInputElement | HTMLTextAreaElement;
        return message(
          `Введите не более ${lengthControl.maxLength} символов.`,
          `Введіть не більше ${lengthControl.maxLength} символів.`,
        );
      }
      if (validity.patternMismatch) return message("Введите значение в указанном формате.", "Введіть значення у вказаному форматі.");
      if (validity.rangeUnderflow && control instanceof HTMLInputElement) return message(`Минимальное значение: ${control.min}.`, `Мінімальне значення: ${control.min}.`);
      if (validity.rangeOverflow && control instanceof HTMLInputElement) return message(`Максимальное значение: ${control.max}.`, `Максимальне значення: ${control.max}.`);
      if (validity.stepMismatch) return message("Введите допустимое значение.", "Введіть допустиме значення.");
      if (validity.badInput) return message("Введите корректное значение.", "Введіть коректне значення.");
      return message("Проверьте правильность заполнения поля.", "Перевірте правильність заповнення поля.");
    }

    function handleInvalid(event: Event) {
      const control = event.target;
      if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement) {
        control.setCustomValidity(validationMessage(control));
      }
    }

    function handleInput(event: Event) {
      const control = event.target;
      if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement) {
        control.setCustomValidity("");
      }
    }

    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select")
      .forEach((control) => control.setCustomValidity(""));
    document.addEventListener("invalid", handleInvalid, true);
    document.addEventListener("input", handleInput, true);
    document.addEventListener("change", handleInput, true);
    return () => {
      document.removeEventListener("invalid", handleInvalid, true);
      document.removeEventListener("input", handleInput, true);
      document.removeEventListener("change", handleInput, true);
    };
  }, [language]);

  return null;
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
