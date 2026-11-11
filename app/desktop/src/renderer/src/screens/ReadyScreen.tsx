import type { MergeRequest } from '@psdk-lab/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SessionReport } from '../../../shared/ipc';
import { GamePanel } from '../components/GamePanel';
import { RemoveSessions } from '../components/Sessions';
import { osName } from '../components/Shell';
import { instructions } from '../mr-text';

function Fact({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="fact">
      <span className="fact-label">{label}</span>
      <span className="fact-value">
        {value}
        {note && <small> · {note}</small>}
      </span>
    </div>
  );
}

/** Copies the exact versions, so they go with the tester's feedback. */
function CopyButton({ text }: { text: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const copy = () =>
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  return (
    <button type="button" className="btn" onClick={() => void copy()}>
      {copied ? t('ready.copied') : t('ready.copy')}
    </button>
  );
}

/** Step 3: the session is ready; launch the game, then come back. */
export function ReadyScreen(props: {
  mr: MergeRequest;
  session: SessionReport;
  onBack: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { mr, session } = props;
  const { lock } = session;
  const commit = lock.pokemonsdk.commit.slice(0, 7);
  const how = instructions(mr.description);
  const report = t('ready.report', {
    iid: mr.iid,
    title: mr.title,
    psdk: lock.pokemonsdk.version,
    commit,
    demo: lock.demo.version,
    binaries: lock.binariesVersion,
    cli: lock.psdkCliVersion,
    ruby: lock.rubyVersion,
    os: osName(),
  });

  return (
    <div className="center">
      <div className="center-head">
        <div className="eyebrow green">{t('ready.eyebrow')}</div>
        <h1 className="center-title">{t('ready.title')}</h1>
        <div className="center-sub">
          {t('prepare.mr', { iid: mr.iid, title: mr.title })}
        </div>
      </div>
      <div className="facts">
        <Fact
          label={t('ready.psdk')}
          value={t('ready.psdkValue', { iid: lock.mr.iid, commit })}
          note={lock.pokemonsdk.version}
        />
        <Fact label={t('ready.demo')} value={lock.demo.version} />
        <Fact label={t('ready.binaries')} value={lock.binariesVersion} />
        <Fact label={t('ready.session')} value={t('ready.independent')} />
      </div>
      <GamePanel sessionId={session.id} extra={<CopyButton text={report} />} />
      <p className="muted small" style={{ marginTop: 12 }}>
        {t('ready.relaunchNote')}
      </p>
      <hr className="divider" />
      <details>
        <summary>{t('ready.details')}</summary>
        {how.steps.length > 0 && (
          <ol className="instructions">
            {how.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        )}
        {how.text.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <pre className="code-box">
          {`${t('ready.sessionDir')} : ${session.dir}\n` +
            t('ready.tools', {
              cli: lock.psdkCliVersion,
              ruby: lock.rubyVersion,
              date: new Date(lock.preparedAt).toLocaleString(
                i18n.resolvedLanguage,
              ),
            }) +
            (lock.gameData
              ? (['restore', 'data'] as const)
                  .map(
                    (part) =>
                      `
${t(`ready.gameData.${part}`)} : ` +
                      t(
                        lock.gameData![part].reused
                          ? 'ready.gameData.reused'
                          : 'ready.gameData.built',
                        {
                          key: lock.gameData![part].key,
                        },
                      ),
                  )
                  .join('')
              : '')}
        </pre>
      </details>
      <div className="back">
        <button type="button" className="link-btn" onClick={props.onBack}>
          {t('ready.back')}
        </button>
        <RemoveSessions
          ids={[session.id]}
          label={t('session.remove')}
          onRemoved={props.onBack}
        />
      </div>
    </div>
  );
}
