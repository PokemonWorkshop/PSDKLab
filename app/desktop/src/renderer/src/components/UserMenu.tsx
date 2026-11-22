import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth';
import { Avatar, GuestAvatar } from './Avatar';
import { Chevron, useDropdown } from './dropdown';

type Entry =
  | { type: 'item'; label: string; onSelect: () => void; danger?: boolean }
  | { type: 'separator' };

/** Account menu of the header (after Soft Dark UI's UserMenu). */
export function UserMenu() {
  const { t } = useTranslation();
  const { status, signingIn, signIn, signOut, openSettings } = useAuth();
  const { open, close, wrap, trigger, menu } = useDropdown();
  const user = status?.user ?? null;

  const entries: Entry[] = user
    ? [
        { type: 'item', label: t('account.profile'), onSelect: () => window.open(user.webUrl, '_blank') },
        { type: 'item', label: t('account.settings'), onSelect: openSettings },
        { type: 'separator' },
        { type: 'item', label: t('account.signOut'), onSelect: signOut, danger: true },
      ]
    : [
        { type: 'item', label: t(signingIn ? 'account.signingIn' : 'account.signIn'), onSelect: signIn },
        { type: 'item', label: t('account.settings'), onSelect: openSettings },
      ];
  const label = user ? t('account.menuOf', { name: user.name }) : t('account.menuGuest');
  const avatar = (size: 'sm' | 'lg') =>
    user ? <Avatar name={user.name} src={user.avatarUrl} size={size} /> : <GuestAvatar size={size} />;

  return (
    <div ref={wrap} className="dropdown">
      <button type="button" className="dropdown-trigger usermenu-trigger" aria-label={label} {...trigger}>
        {avatar('sm')}
        <span>{user ? user.username : t('account.guest')}</span>
        <Chevron open={open} />
      </button>
      {open && (
        <div className="menu" aria-label={label} {...menu}>
          <div className="usermenu-head">
            {avatar('lg')}
            <span>
              <b>{user ? user.name : t('account.guest')}</b>
              <small>{user ? `@${user.username} · gitlab.com` : t('account.guestNote')}</small>
            </span>
          </div>
          <div role="separator" className="menu-sep" />
          {entries.map((it, k) =>
            it.type === 'separator' ? (
              <div key={k} role="separator" className="menu-sep" />
            ) : (
              <button
                key={k}
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={it.danger ? 'menu-item danger' : 'menu-item'}
                onClick={() => {
                  close();
                  it.onSelect();
                }}
              >
                {it.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
