import type { MergeRequest, SessionSummary } from '@psdk-lab/core';
import { sessionId } from '@psdk-lab/core/constants';
import { useTranslation } from 'react-i18next';
import type { SessionReport } from '../../../shared/ipc';
import { RemoveSessions, toReport } from './Sessions';

/** The ready session of the MR's current head, if there is one. */
export function readySession(mr: MergeRequest, sessions: SessionSummary[]) {
  const id = sessionId(mr.iid, mr.sha);
  return sessions.find((s) => s.id === id && s.ready) ?? null;
}

/**
 * Bottom of the MR detail: "Prepare the environment", or "Open the session"
 * when this commit is already prepared. Older or unfinished sessions of the
 * MR can be removed from here.
 */
export function EnvironmentBox(props: {
  mr: MergeRequest;
  sessions: SessionSummary[];
  onPrepare: () => void;
  onOpen: (session: SessionReport) => void;
  onSessionsChanged: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { mr, sessions } = props;
  const current = readySession(mr, sessions);
  const report = current && toReport(current);
  const others = sessions.filter((s) => s.mrIid === mr.iid && s !== current);
  const date = (iso: string) =>
    new Date(iso).toLocaleString(i18n.resolvedLanguage);

  return (
    <div className="detail-actions">
      <hr className="divider" style={{ marginTop: 4 }} />
      <div className="detail-section" style={{ marginTop: 0 }}>
        {t('select.envTitle')}
      </div>
      {report ? (
        <>
          <div className="small">
            <span className="ready-dot" />
            {t('select.sessionReady', { date: date(report.lock.preparedAt) })}
          </div>
          <p className="muted small" style={{ margin: '6px 0 20px' }}>
            {t('select.sessionReadyNote')}
          </p>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => props.onOpen(report)}
          >
            {t('select.open')}
          </button>
          <RemoveSessions
            ids={[report.id]}
            label={t('session.remove')}
            onRemoved={props.onSessionsChanged}
          />
        </>
      ) : (
        <>
          <div className="small">{t('select.envText')}</div>
          <p className="muted small" style={{ margin: '6px 0 20px' }}>
            {t('select.envNote')}
          </p>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={props.onPrepare}
          >
            {t('select.prepare')}
          </button>
        </>
      )}
      {others.length > 0 && (
        <div className="old-sessions">
          <span className="muted small">
            {t('select.oldSessions', { count: others.length })}
          </span>
          <RemoveSessions
            ids={others.map((s) => s.id)}
            label={t('session.removeOld', { count: others.length })}
            onRemoved={props.onSessionsChanged}
          />
        </div>
      )}
    </div>
  );
}
