import { useEffect, useState } from 'react';
import type { RuntimeReport } from '../../shared/ipc';

const box = {
  border: '1px solid #444',
  borderRadius: 8,
  padding: '12px 16px',
  marginBottom: 24,
};

/** What the app bundles: Git, psdk-cli and thor (Ruby comes with the PSDK binaries). */
export function RuntimeStatus() {
  const [report, setReport] = useState<RuntimeReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.api
      .checkRuntimes()
      .then(setReport)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <section style={box}>Check failed: {error}</section>;
  if (!report) return <section style={box}>Checking bundled tools…</section>;

  return (
    <section style={box}>
      <strong>
        {report.ok ? 'Bundled tools: OK' : 'Bundled tools: problem'}
      </strong>
      <ul>
        <li>{report.git ?? 'Git —'}</li>
        <li>psdk-cli {report.psdkCli ?? '—'}</li>
        <li>thor {report.thor ?? '—'}</li>
      </ul>
      {report.problems.length > 0 && (
        <>
          <ul>
            {report.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <p>
            In development, run <code>npm run prepare:runtimes</code> at the
            repository root.
          </p>
        </>
      )}
      <small>{report.root}</small>
    </section>
  );
}
