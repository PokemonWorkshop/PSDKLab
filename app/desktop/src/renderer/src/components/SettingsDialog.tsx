import { PSDK_PROJECT } from '@psdk-lab/core/constants';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { authErrorKey, useAuth } from '../auth';
import { LanguageSelect } from '../LanguageSelect';
import { AboutSection } from './AboutSection';
import { Avatar, GuestAvatar } from './Avatar';
import { TokenSignIn } from './TokenSignIn';

function AccountSection() {
  const { t } = useTranslation();
  const { status, signingIn, error, signIn, cancel, signOut } = useAuth();
  const user = status?.user ?? null;
  return (
    <section className="settings-section">
      <h3>{t('settings.account')}</h3>
      <div className="settings-account">
        {user ? <Avatar name={user.name} src={user.avatarUrl} size="lg" /> : <GuestAvatar size="lg" />}
        <div className="settings-account-text">
          <b>{user ? user.name : t('account.guest')}</b>
          <small className="muted">
            {user ? `@${user.username} · gitlab.com` : t('settings.guestText')}
          </small>
        </div>
        {user ? (
          <button type="button" className="btn btn-small" onClick={signOut}>
            {t('account.signOut')}
          </button>
        ) : !status?.configured ? null : signingIn ? (
          <button type="button" className="btn btn-small" onClick={cancel}>
            {t('settings.cancel')}
          </button>
        ) : (
          <button type="button" className="btn btn-primary btn-small" onClick={signIn}>
            {t('account.signIn')}
          </button>
        )}
      </div>
      {user && status?.method === 'token' && (
        <p className="small muted">
          {t(status.canWrite ? 'settings.viaToken' : 'settings.viaReadOnlyToken')}
        </p>
      )}
      {!user && signingIn && status?.configured && <p className="small muted">{t('settings.browserOpened')}</p>}
      {error && <p className="notice">{t(authErrorKey(error))}</p>}
      {/* Without an OAuth application ID, the personal token is the way to sign in. */}
      {!user && status && !status.configured && <TokenSignIn />}
      {!user && status?.configured && (
        <>
          <p className="small muted">{t('settings.scopes', { scopes: status.scopes.join(', ') })}</p>
          <details className="token-details">
            <summary className="small">{t('settings.tokenInstead')}</summary>
            <TokenSignIn />
          </details>
        </>
      )}
      {status && !status.persistent && <p className="small muted">{t('settings.memoryOnly')}</p>}
    </section>
  );
}

/** Settings, reachable from the account menu whether signed in or not. */
export function SettingsDialog() {
  const { t } = useTranslation();
  const { settingsOpen: open, closeSettings: onClose } = useAuth();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      d.focus(); // the dialog itself, not its first button (no ring on open)
    }
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="settings"
      tabIndex={-1}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="settings-head">
        <h2>{t('settings.title')}</h2>
        <button type="button" className="icon-btn" aria-label={t('settings.close')} onClick={onClose}>
          ✕
        </button>
      </div>
      <AccountSection />
      <section className="settings-section">
        <h3>{t('settings.repository')}</h3>
        <div className="settings-row">
          <span>{PSDK_PROJECT.replace('/', ' / ')}</span>
          <span className="chip">{t('settings.preset')}</span>
        </div>
        <p className="small muted">{t('settings.repositoryNote')}</p>
      </section>
      <section className="settings-section">
        <h3>{t('app.language')}</h3>
        <LanguageSelect />
      </section>
      <AboutSection open={open} />
    </dialog>
  );
}
