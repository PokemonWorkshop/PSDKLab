import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth';

// Opens GitLab's token page with the name and the scope filled in.
const CREATE_URL =
  'https://gitlab.com/-/user_settings/personal_access_tokens?name=PSDK%20Lab&scopes=api';

/** Sign-in with a personal access token, checked on GitLab then kept encrypted. */
export function TokenSignIn() {
  const { t } = useTranslation();
  const { signingIn, signInWithToken } = useAuth();
  const [token, setToken] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;
    void signInWithToken(token).then((ok) => ok && setToken(''));
  };

  return (
    <form className="token-form" onSubmit={submit}>
      <p className="small muted">
        {t('settings.tokenText')}{' '}
        <a href={CREATE_URL} target="_blank" rel="noreferrer">
          {t('settings.tokenCreate')}
        </a>
      </p>
      <div className="token-row">
        <input
          type="password"
          value={token}
          placeholder="glpat-…"
          autoComplete="off"
          spellCheck={false}
          aria-label={t('settings.tokenLabel')}
          onChange={(e) => setToken(e.target.value)}
        />
        <button type="submit" className="btn btn-primary btn-small" disabled={signingIn || !token.trim()}>
          {signingIn ? t('settings.tokenChecking') : t('settings.tokenSubmit')}
        </button>
      </div>
    </form>
  );
}
