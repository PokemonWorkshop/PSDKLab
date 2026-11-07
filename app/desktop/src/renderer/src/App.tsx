import type { MrList } from '@psdk-lab/core';
import { useCallback, useEffect, useState } from 'react';
import { MrItem } from './MrItem';
import { RuntimeStatus } from './RuntimeStatus';

const time = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString() : '—';

export function App() {
  const [list, setList] = useState<MrList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback((force = false) => {
    setLoading(true);
    window.api
      .listMrs(force)
      .then((l) => {
        setList(l);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load]);

  return (
    <main style={{ fontFamily: 'sans-serif', padding: 24 }}>
      <h1>PSDK Lab</h1>
      <RuntimeStatus />
      <h2>Open merge requests</h2>
      <p>
        <button type="button" onClick={() => load(true)} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>{' '}
        {list && <small>List from {time(list.fetchedAt)}</small>}
      </p>
      {list?.notice && <p>{list.notice}</p>}
      {error && <p>Error: {error}</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {list?.mrs.map((mr) => (
          <MrItem key={mr.iid} mr={mr} />
        ))}
      </ul>
    </main>
  );
}
