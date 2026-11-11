import { useTranslation } from 'react-i18next';
import { LANGUAGES, setLanguage } from './i18n';

/** FR | EN switch styled like the rest of the interface; remembered on this computer. */
export function LanguageSelect() {
  const { t, i18n } = useTranslation();
  return (
    <div className="seg" role="radiogroup" aria-label={t('app.language')}>
      {LANGUAGES.map((l) => {
        const active = i18n.resolvedLanguage === l;
        return (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={active}
            className={`seg-item${active ? ' active' : ''}`}
            onClick={() => setLanguage(l)}
          >
            {l.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
