import type { MrList } from '@psdk-lab/core';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ipcMessage } from '../machines/workflow';

export const time = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString() : '—';

/** The MR list, cached by the main process; `refresh` asks GitLab again. */
export function useMrList() {
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
      .catch((e: unknown) => setError(ipcMessage(e)))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => load(), [load]);
  return { list, error, loading, refresh: () => load(true) };
}

export function StaleNotice({ list }: { list: MrList }) {
  const { t } = useTranslation();
  const r = list.staleReason;
  if (!list.stale || !r) return null;
  const at = time(list.fetchedAt);
  return (
    <p className="notice">
      {r.kind === 'rate-limit'
        ? t('select.staleRateLimit', { time: at, sec: r.retryInSec })
        : t('select.staleUnreachable', { time: at, detail: r.detail })}
    </p>
  );
}
