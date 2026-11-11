import type { GameEnd } from '@psdk-lab/core';
import { useMachine } from '@xstate/react';
import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { gameMachine } from '../machines/game';

function Status({
  tone,
  children,
}: {
  tone?: 'running' | 'error';
  children: ReactNode;
}) {
  return (
    <div className={`status ${tone ?? ''}`} role="status">
      <span className="status-dot" />
      {children}
    </div>
  );
}

/** How the game ended. A normal close never reads as a validation of the MR. */
function EndStatus({ end }: { end: GameEnd }) {
  const { t } = useTranslation();
  switch (end.kind) {
    case 'closed':
      return <Status>{t('game.closed')}</Status>;
    case 'stopped':
      return <Status>{t('game.stopped')}</Status>;
    case 'crashed':
      return (
        <Status tone="error">
          {t(
            end.during === 'startup'
              ? 'game.crashedStartup'
              : 'game.crashedGame',
          )}{' '}
          {end.hint && t(`game.hint.${end.hint}`)}
          <div className="muted small">
            {t('game.exitCode', { code: end.code ?? '—' })}
            {end.signal && ` · ${t('game.exitSignal', { signal: end.signal })}`}
            {' · '}
            {t('game.log', { path: end.log })}
          </div>
          {end.output && <pre className="code-box">{end.output}</pre>}
        </Status>
      );
    case 'failed':
      return (
        <Status tone="error">
          {t('game.failedTitle')}{' '}
          {t(`game.reason.${end.reason}`, { detail: end.detail ?? '' })}
          {end.files && <pre className="code-box">{end.files.join('\n')}</pre>}
          {end.reason === 'missing-files' && (
            <div className="small">{t('game.noFallback')}</div>
          )}
          {end.log && (
            <div className="muted small">
              {t('game.log', { path: end.log })}
            </div>
          )}
        </Status>
      );
  }
}

/**
 * "Launch the game" with its state: starting (no window yet), running, then
 * how it ended. `extra` sits next to the button (copy the test information).
 */
export function GamePanel({
  sessionId,
  extra,
}: {
  sessionId: string;
  extra?: ReactNode;
}) {
  const { t } = useTranslation();
  const [snapshot, send] = useMachine(gameMachine, { input: { sessionId } });
  const { pid, end } = snapshot.context;

  useEffect(
    () =>
      window.api.onGameState(
        (e) =>
          e.sessionId === sessionId && send({ type: 'GAME', state: e.state }),
      ),
    [sessionId, send],
  );

  const active = snapshot.matches('starting') || snapshot.matches('running');
  return (
    <>
      <div className="actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => send({ type: 'LAUNCH' })}
          disabled={active}
        >
          {active
            ? t('game.busy')
            : t(snapshot.matches('ended') ? 'game.launchAgain' : 'game.launch')}
        </button>
        {extra}
      </div>
      {snapshot.matches('starting') && <Status>{t('game.starting')}</Status>}
      {snapshot.matches('running') && (
        <Status tone="running">
          {pid ? t('game.runningPid', { pid }) : t('game.running')}
        </Status>
      )}
      {snapshot.matches('ended') && end && <EndStatus end={end} />}
    </>
  );
}
