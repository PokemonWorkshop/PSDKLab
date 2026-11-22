import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import fr from './fr.json';

/** Interface languages. To add one: <code>.json + a line here. */
export const LANGUAGES = {
  en: { name: 'English', strings: en },
  fr: { name: 'Français', strings: fr },
} as const;

export type Language = keyof typeof LANGUAGES;
export const LANGUAGE_CODES = Object.keys(LANGUAGES) as Language[];

const FALLBACK: Language = 'en';
const STORAGE_KEY = 'psdk-lab.language';

const isLanguage = (code: string | null): code is Language =>
  code !== null && code in LANGUAGES;

/** The tester's choice, else the system language, else English. */
function initialLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLanguage(saved)) return saved;
  } catch {
    // Storage unavailable: fall back to the system language.
  }
  for (const tag of navigator.languages ?? [navigator.language]) {
    const code = tag.toLowerCase().split('-')[0];
    if (isLanguage(code)) return code;
  }
  return FALLBACK;
}

export function setLanguage(lang: Language): void {
  void i18n.changeLanguage(lang);
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Not remembered, still applied.
  }
}

void i18n.use(initReactI18next).init({
  resources: Object.fromEntries(
    LANGUAGE_CODES.map((code) => [code, { translation: LANGUAGES[code].strings }]),
  ),
  lng: initialLanguage(),
  fallbackLng: FALLBACK,
  interpolation: { escapeValue: false }, // React escapes already
});

export default i18n;
