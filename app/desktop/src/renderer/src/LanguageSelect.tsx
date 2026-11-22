import { useTranslation } from 'react-i18next';
import { LANGUAGE_CODES, LANGUAGES, setLanguage, type Language } from './i18n';

/** Language choice, one row per entry of LANGUAGES. */
export function LanguageSelect() {
  const { t, i18n } = useTranslation();
  const current = (i18n.resolvedLanguage ?? 'en') as Language;
  return (
    <div className="lang-list" role="radiogroup" aria-label={t('app.language')}>
      {LANGUAGE_CODES.map((code) => (
        <button
          key={code}
          type="button"
          role="radio"
          aria-checked={code === current}
          className="lang-option"
          onClick={() => setLanguage(code)}
        >
          <span className="radio" aria-hidden="true" />
          {LANGUAGES[code].name}
        </button>
      ))}
    </div>
  );
}
