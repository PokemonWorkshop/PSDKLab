import type { MergeRequest, SessionSummary } from '@psdk-lab/core';
import { PSDK_PROJECT, TEST_LABEL } from '@psdk-lab/core/constants';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SessionReport } from '../../../shared/ipc';
import { EnvironmentBox, readySession } from '../components/EnvironmentBox';
import { instructions, isProposed, summary } from '../mr-text';
import { StaleNotice, time, useMrList } from './mr-list';

function MrCard(props: {
  mr: MergeRequest;
  ready: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const { mr } = props;
  return (
    <button
      type="button"
      className={`mr-card${props.selected ? ' selected' : ''}`}
      aria-pressed={props.selected}
      onClick={props.onSelect}
    >
      <div className="mr-card-top">
        <span>
          !{mr.iid} · {mr.author}
        </span>
        <span>
          {props.ready && (
            <span className="card-ready">
              <span className="ready-dot" />
              {t('select.readyBadge')}
            </span>
          )}
          {isProposed(mr) && t('select.proposedBadge')}
        </span>
      </div>
      <div className="mr-card-title">{mr.title}</div>
      <div className="mr-card-desc">{summary(mr.description)}</div>
    </button>
  );
}

type SessionProps = {
  sessions: SessionSummary[];
  onOpen: (session: SessionReport) => void;
  onSessionsChanged: () => void;
};

function MrDetail(props: { mr: MergeRequest | null; onPrepare: () => void } & SessionProps) {
  const { t } = useTranslation();
  const { mr } = props;
  if (!mr) return <p className="muted detail-empty">{t('select.noSelection')}</p>;
  const how = instructions(mr.description);
  const summed = summary(mr.description);
  // Without an introduction the summary is the first step: not shown twice.
  const about = how.steps[0]?.startsWith(summed.replace(/…$/, '')) ? '' : summed;
  return (
    <>
      <div className="detail-body">
      <div className="detail-head">
        <span>!{mr.iid}</span>
        {mr.labels.map((l) => (
          <span key={l} className="chip">
            {l}
          </span>
        ))}
      </div>
      <div className="detail-title">{mr.title}</div>
      {about && <div className="muted">{about}</div>}
      <div className="detail-section">{t('select.instructions')}</div>
      {how.steps.length > 0 ? (
        <ol className="instructions">
          {how.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      ) : how.text.length > 0 ? (
        <div className="instructions-text">
          {how.text.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      ) : (
        <p className="muted small">{t('select.noInstructions')}</p>
      )}
      <p className="small" style={{ marginTop: 14 }}>
        <a href={mr.webUrl} target="_blank" rel="noreferrer">
          {t('select.openGitlab')}
        </a>
      </p>
      </div>
      <EnvironmentBox
        mr={mr}
        sessions={props.sessions}
        onPrepare={props.onPrepare}
        onOpen={props.onOpen}
        onSessionsChanged={props.onSessionsChanged}
      />
    </>
  );
}

/** Step 1: choose a contribution and read its author's instructions. */
export function SelectScreen(props: {
  selected: MergeRequest | null;
  onSelect: (mr: MergeRequest) => void;
  onPrepare: () => void;
} & SessionProps) {
  const { t } = useTranslation();
  const { list, error, loading, refresh } = useMrList();
  const [tab, setTab] = useState<'proposed' | 'other'>('proposed');
  const mrs = useMemo(() => list?.mrs ?? [], [list]);
  const proposed = mrs.filter(isProposed);
  const other = mrs.filter((mr) => !isProposed(mr));
  const shown = tab === 'proposed' ? proposed : other;
  const { selected, onSelect } = props;

  // Open on "Other MRs" when nothing is proposed, and select the first MR shown.
  useEffect(() => {
    if (proposed.length === 0 && other.length > 0) setTab('other');
  }, [proposed.length, other.length]);
  useEffect(() => {
    if (!selected && shown[0]) onSelect(shown[0]);
  }, [selected, shown, onSelect]);
  const current = selected && mrs.find((m) => m.iid === selected.iid) ? selected : null;

  return (
    <div className="select-screen">
      <div className="select-head">
        <div>
          <h1 className="page-title">{t('select.title')}</h1>
          <div className="muted" style={{ fontSize: 15 }}>
            {t('select.subtitle')}
          </div>
        </div>
        <button type="button" className="btn" onClick={refresh} disabled={loading}>
          {loading ? t('select.loading') : t('select.refresh')}
        </button>
      </div>
      <div className="select-meta">
        <span className="repo">{PSDK_PROJECT.replace('/', ' / ')}</span>
        {list && (
          <span className="muted">
            {t('select.meta', { time: time(list.fetchedAt), count: mrs.length })}
          </span>
        )}
      </div>
      {list && <StaleNotice list={list} />}
      {error && <p className="notice">{t('select.loadError', { message: error })}</p>}
      <section className="panel">
        <div className="panel-list">
          <div className="tabs" role="tablist">
            {(['proposed', 'other'] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={tab === k}
                className={`tab${tab === k ? ' active' : ''}`}
                onClick={() => setTab(k)}
              >
                {t(k === 'proposed' ? 'select.tabProposed' : 'select.tabOther')}
                <span className="tab-count">{(k === 'proposed' ? proposed : other).length}</span>
              </button>
            ))}
          </div>
          <p className="list-note">
            {t(tab === 'proposed' ? 'select.priorityNote' : 'select.otherNote', { label: TEST_LABEL })}
          </p>
          {shown.length === 0 && <p className="list-empty">{t('select.empty')}</p>}
          {shown.map((mr) => (
            <MrCard
              key={mr.iid}
              mr={mr}
              ready={readySession(mr, props.sessions) !== null}
              selected={current?.iid === mr.iid}
              onSelect={() => onSelect(mr)}
            />
          ))}
          <p className="list-note" style={{ marginTop: 20 }}>
            {t('select.labelNote')}
          </p>
        </div>
        <div className="panel-detail">
          <MrDetail
            mr={current}
            onPrepare={props.onPrepare}
            sessions={props.sessions}
            onOpen={props.onOpen}
            onSessionsChanged={props.onSessionsChanged}
          />
        </div>
      </section>
    </div>
  );
}
