import type { MergeRequest, SessionStep } from '@psdk-lab/core';
import { useTranslation } from 'react-i18next';

const DOWNLOADS: SessionStep[] = ['demo', 'binaries'];

/** Step 2 interrupted: what failed, what to do, and the technical details. */
export function FailedScreen(props: {
  mr: MergeRequest;
  step: SessionStep | null;
  error: string | null;
  onRetry: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const step = props.step ?? 'demo';
  const download = DOWNLOADS.includes(step);
  return (
    <div className="center">
      <div className="center-head">
        <div className="eyebrow orange">{t('failed.eyebrow')}</div>
        <h1 className="center-title">
          {t(download ? 'failed.downloadTitle' : 'failed.title')}
        </h1>
        <div className="center-sub">
          {t(`failed.cause.${step}`)} {t('failed.notReady')}
        </div>
      </div>
      <p className="body-text">
        {t(download ? 'failed.downloadAdvice' : 'failed.advice')}
      </p>
      <div className="actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={props.onRetry}
        >
          {t('failed.retry')}
        </button>
        <button type="button" className="btn" onClick={props.onBack}>
          {t('failed.back')}
        </button>
      </div>
      <hr className="divider" />
      <details>
        <summary>{t('failed.details')}</summary>
        <pre className="code-box">
          {`MR !${props.mr.iid} · ${props.mr.sha.slice(0, 7)} · ${step}\n${props.error ?? ''}`}
        </pre>
      </details>
    </div>
  );
}
