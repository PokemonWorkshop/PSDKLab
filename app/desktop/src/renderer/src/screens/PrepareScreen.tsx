import type {
  MergeRequest,
  SessionStep,
  StepDetail,
  StepUpdate,
} from '@psdk-lab/core';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StepStates } from '../machines/workflow';

/**
 * Rows shown to the tester, with their share of the bar (measured durations:
 * game data is the longest, then the demo copy). Restore and data run together
 * and make one row.
 */
const ROWS = [
  { key: 'demo', steps: ['demo'], weight: 25, cache: true },
  { key: 'binaries', steps: ['binaries'], weight: 10, cache: true },
  { key: 'mr', steps: ['mr'], weight: 15, cache: false },
  { key: 'data', steps: ['restore', 'data'], weight: 45, cache: false },
  { key: 'verify', steps: ['verify'], weight: 5, cache: false },
] as const satisfies readonly {
  key: string;
  steps: readonly SessionStep[];
  weight: number;
  cache: boolean;
}[];

type Row = (typeof ROWS)[number];
type RowState = {
  state: 'pending' | 'active' | 'done';
  fraction: number;
  details: StepDetail[];
};

/** State of a row from the updates of its steps. */
export function rowState(row: Row, steps: StepStates): RowState {
  const updates = row.steps
    .map((s) => steps[s])
    .filter((u): u is StepUpdate => !!u);
  const fraction =
    row.steps.reduce((sum, s) => sum + (steps[s]?.fraction ?? 0), 0) /
    row.steps.length;
  const details = updates.flatMap((u) => (u.detail ? [u.detail] : []));
  if (
    updates.length === row.steps.length &&
    updates.every((u) => u.state === 'done')
  )
    return { state: 'done', fraction: 1, details };
  return {
    state: updates.length > 0 ? 'active' : 'pending',
    fraction,
    details,
  };
}

/** Share of the whole preparation done, 0..1. */
export function overall(steps: StepStates): number {
  const total = ROWS.reduce((sum, r) => sum + r.weight, 0);
  return (
    ROWS.reduce((sum, r) => sum + r.weight * rowState(r, steps).fraction, 0) /
    total
  );
}

const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);

function Detail({ row, detail }: { row: Row; detail: StepDetail }) {
  const { t } = useTranslation();
  switch (detail.kind) {
    case 'cached':
      return <>{t('prepare.detail.cached')}</>;
    case 'boot':
      return <>{t('prepare.detail.boot')}</>;
    case 'lookup':
      return <>{t('prepare.detail.lookup')}</>;
    case 'git':
      return <>{t(`prepare.detail.git.${detail.phase}`)}</>;
    case 'download':
      return (
        <>
          {detail.total > 0
            ? t('prepare.detail.download', {
                received: mb(detail.received),
                total: mb(detail.total),
              })
            : t('prepare.detail.downloadUnknown', {
                received: mb(detail.received),
              })}
        </>
      );
    case 'items':
      return (
        <>
          {t(
            row.key === 'data' && detail.total < 30
              ? 'prepare.detail.categories'
              : 'prepare.detail.files',
            {
              done: detail.done,
              total: detail.total,
            },
          )}
        </>
      );
  }
}

/** Time since the preparation started, m:ss, refreshed every second. */
function useElapsed(startedAt: number | null): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const sec = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

/** Step 2: the session is being prepared; each step shows what it is doing. */
export function PrepareScreen(props: {
  mr: MergeRequest;
  steps: StepStates;
  startedAt: number | null;
}) {
  const { t } = useTranslation();
  const elapsed = useElapsed(props.startedAt);
  const percent = Math.round(overall(props.steps) * 100);
  const states = ROWS.map((r) => rowState(r, props.steps));
  const current = ROWS.find((_, i) => states[i].state === 'active') ?? ROWS[0];

  return (
    <div className="center">
      <div className="center-head">
        <div className="eyebrow">{t('prepare.eyebrow')}</div>
        <h1 className="center-title">{t('prepare.title')}</h1>
        <div className="center-sub">
          {t('prepare.mr', { iid: props.mr.iid, title: props.mr.title })}
        </div>
      </div>
      <div className="progress-label">
        <span>{t(`prepare.steps.${current.key}`)}</span>
        <span>
          <span className="muted small">{elapsed}</span>{' '}
          <strong>{percent} %</strong>
        </span>
      </div>
      <div
        className="progress working"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div style={{ width: `${Math.max(percent, 2)}%` }} />
      </div>
      <ol className="steps">
        {ROWS.map((r, i) => {
          const s = states[i];
          return (
            <li key={r.key} className={s.state}>
              <span className="mark" aria-hidden="true">
                {s.state === 'done' ? (
                  '✓'
                ) : s.state === 'active' ? (
                  <span className="spinner" />
                ) : (
                  '○'
                )}
              </span>
              <span>
                {t(`prepare.steps.${r.key}`)}
                {s.state === 'active' && (
                  <span className="hint active-hint">
                    {s.details.length > 0
                      ? s.details.map((d, k) => (
                          <span key={k}>
                            {k > 0 && ' · '}
                            <Detail row={r} detail={d} />
                          </span>
                        ))
                      : t('prepare.detail.working')}
                    {r.steps.length === 1 &&
                      s.fraction > 0 &&
                      ` · ${Math.round(s.fraction * 100)} %`}
                  </span>
                )}
                {s.state === 'done' &&
                  s.details.some((d) => d.kind === 'cached') && (
                    <span className="hint">{t('prepare.detail.cached')}</span>
                  )}
                {s.state === 'pending' && r.cache && (
                  <span className="hint">{t('prepare.cacheHint')}</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="footnote">{t('prepare.footnote')}</p>
    </div>
  );
}
