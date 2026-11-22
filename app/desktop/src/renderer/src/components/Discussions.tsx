import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DiscussionList } from '../../../shared/ipc';
import { useAuth } from '../auth';
import { ipcMessage } from '../machines/workflow';
import { time } from '../screens/mr-list';
import { Composer, Thread } from './DiscussionThread';

/** MR threads, read on open or Refresh. Commenting needs an account. */
export function Discussions({ iid, projectId }: { iid: number; projectId?: number }) {
  const { t } = useTranslation();
  const { status, signingIn, signIn } = useAuth();
  const [list, setList] = useState<DiscussionList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const userId = status?.user?.id ?? null;

  const load = useCallback(
    (force = false) => {
      setLoading(true);
      window.api
        .listDiscussions(iid, force)
        .then((l) => {
          setList(l);
          setError(null);
        })
        .catch((e: unknown) => setError(ipcMessage(e)))
        .finally(() => setLoading(false));
    },
    [iid],
  );

  // Another MR, or signed in / out: what may be done changes.
  useEffect(() => {
    setList(null);
    load();
  }, [load, userId]);

  const count = list?.discussions.reduce((n, d) => n + d.notes.length, 0) ?? 0;
  const canComment = list?.capabilities.comment ?? false;

  return (
    <section className="discussions">
      <div className="discussions-head">
        <span className="detail-section">{t('discussions.title', { count })}</span>
        <button type="button" className="link-btn" onClick={() => load(true)} disabled={loading}>
          {loading ? t('select.loading') : t('select.refresh')}
        </button>
      </div>
      {list?.stale && (
        <p className="notice">
          {list.retryInSec
            ? t('discussions.staleRateLimit', { time: time(list.fetchedAt), sec: list.retryInSec })
            : t('discussions.stale', { time: time(list.fetchedAt) })}
        </p>
      )}
      {error && (
        <p className="notice">
          {error === 'sign-in-required'
            ? t('discussions.signInToRead')
            : t('discussions.loadError', { message: error })}
        </p>
      )}
      {list && list.discussions.length === 0 && <p className="muted small">{t('discussions.empty')}</p>}
      {list?.discussions.map((d) => (
        <Thread key={d.id} iid={iid} projectId={projectId} discussion={d} canReply={list.capabilities.reply} onPosted={setList} />
      ))}
      {list &&
        (canComment ? (
          <Composer input={{ iid }} placeholder={t('discussions.commentPlaceholder')} onPosted={setList} />
        ) : (
          <div className="discussions-guest">
            <span className="small muted">{t('discussions.signInToComment')}</span>
            {!status?.user && (
              <button type="button" className="btn btn-small" onClick={signIn} disabled={signingIn}>
                {t(signingIn ? 'account.signingIn' : 'account.signIn')}
              </button>
            )}
          </div>
        ))}
    </section>
  );
}
