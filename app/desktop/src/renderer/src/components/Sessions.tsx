import type { SessionSummary } from '@psdk-lab/core';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SessionReport } from '../../../shared/ipc';
import { ipcMessage } from '../machines/workflow';

/** Session folders on disk; `refresh` reads them again (after a change). */
export function useSessions() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const refresh = useCallback(() => {
    window.api
      .listSessions()
      .then(setSessions)
      .catch(() => setSessions([]));
  }, []);
  useEffect(() => refresh(), [refresh]);
  return { sessions, refresh };
}

/** A ready session as the ready screen expects it. */
export function toReport(s: SessionSummary): SessionReport | null {
  return s.ready && s.lock
    ? { id: s.id, dir: s.dir, gameDir: s.gameDir, lock: s.lock }
    : null;
}

type Phase = 'idle' | 'confirm' | 'removing';

/**
 * "Remove the session" with an inline confirmation. `ids` are removed one
 * after the other; `onRemoved` runs once they are all gone.
 */
export function RemoveSessions(props: {
  ids: string[];
  label: string;
  onRemoved: () => void;
}) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setPhase('removing');
    setError(null);
    try {
      for (const id of props.ids) {
        if ((await window.api.removeSession(id)) === 'game-running') {
          setError(t('session.gameRunning'));
          setPhase('idle');
          return;
        }
      }
      props.onRemoved();
    } catch (err) {
      setError(t('session.removeError', { message: ipcMessage(err) }));
    }
    setPhase('idle');
  };

  return (
    <div className="remove">
      {phase === 'idle' && (
        <button
          type="button"
          className="link-btn danger"
          onClick={() => setPhase('confirm')}
        >
          {props.label}
        </button>
      )}
      {phase === 'confirm' && (
        <div className="remove-confirm">
          <span>{t('session.confirm')}</span>
          <button
            type="button"
            className="btn btn-danger btn-small"
            onClick={() => void remove()}
          >
            {t('session.confirmYes')}
          </button>
          <button
            type="button"
            className="btn btn-small"
            onClick={() => setPhase('idle')}
          >
            {t('session.cancel')}
          </button>
        </div>
      )}
      {phase === 'removing' && (
        <span className="muted">{t('session.removing')}</span>
      )}
      {error && <div className="remove-error">{error}</div>}
    </div>
  );
}
