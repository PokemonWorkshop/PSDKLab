import type { MergeRequest, Progress, SessionStep } from '@psdk-lab/core';
import { useEffect, useState } from 'react';
import type { SessionReport } from '../../shared/ipc';

const STEP_LABELS: Record<SessionStep, string> = {
  demo: 'Getting the latest Technical Demo…',
  binaries: 'Getting the latest PSDK binaries…',
  mr: 'Switching pokemonsdk to the MR (psdk-use mr)…',
  restore: 'Rebuilding game data (--util=restore)…',
  verify: 'Checking the prepared files…',
  ready: 'Ready',
};

const row = { padding: '8px 0', borderBottom: '1px solid #333' };
const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);

/** One MR: prepare its environment in one action, show progress, then the ready state. */
export function MrItem({ mr }: { mr: MergeRequest }) {
  const [step, setStep] = useState<SessionStep | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [session, setSession] = useState<SessionReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = step !== null && step !== 'ready' && !error;

  useEffect(
    () =>
      window.api.onSessionStep((e) => e.mrIid === mr.iid && setStep(e.step)),
    [mr.iid],
  );
  useEffect(
    () => (busy ? window.api.onDownloadProgress(setProgress) : undefined),
    [busy],
  );

  const prepare = () => {
    setError(null);
    setStep('demo');
    window.api
      .prepareSession({ iid: mr.iid, sha: mr.sha })
      .then(setSession)
      .catch((e: Error) => setError(e.message))
      .finally(() => setProgress(null));
  };

  const lock = session?.lock;
  return (
    <li style={row}>
      <div>
        <strong>!{mr.iid}</strong> — {mr.title} ({mr.author})
      </div>
      {busy && step && (
        <small>
          {STEP_LABELS[step]}
          {step === 'binaries' && progress && ` ${mb(progress.received)} MB`}
        </small>
      )}
      {error && <small>Error: {error}</small>}
      {lock ? (
        <div>
          <small>
            Ready · PSDK {lock.pokemonsdk.version} (
            {lock.pokemonsdk.commit.slice(0, 7)}) · demo {lock.demo.version} ·
            binaries {lock.binariesVersion} · psdk-cli {lock.psdkCliVersion}
          </small>
          <br />
          <small>{session.gameDir}</small>
        </div>
      ) : (
        <button type="button" onClick={prepare} disabled={busy}>
          {busy ? 'Preparing…' : 'Prepare'}
        </button>
      )}
    </li>
  );
}
