import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppInfo, RuntimeReport } from '../../../shared/ipc';
import { osName } from '../os';

const SYSTEMS: Record<string, string> = { win32: 'Windows', linux: 'Linux', darwin: 'macOS' };
const systemName = (platform: string) => SYSTEMS[platform] ?? osName();

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="muted">{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

/** Settings > About: what to quote when reporting a problem. Read when opened. */
export function AboutSection({ open }: { open: boolean }) {
  const { t } = useTranslation();
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [tools, setTools] = useState<RuntimeReport | null>(null);

  useEffect(() => {
    if (!open) return;
    void window.api.appInfo().then(setInfo);
    void window.api.checkRuntimes().then(setTools, () => setTools(null));
  }, [open]);

  return (
    <section className="settings-section">
      <h3>{t('settings.about')}</h3>
      <dl className="about">
        <Row label={t('app.name')} value={info?.version ?? '…'} />
        <Row
          label={t('settings.system')}
          value={info ? `${systemName(info.platform)} ${info.osRelease} · ${info.arch}` : osName()}
        />
        <Row
          label={t('settings.tools')}
          value={
            tools
              ? `Git ${tools.git?.replace(/^git version /, '') ?? '—'} · psdk-cli ${tools.psdkCli ?? '—'}`
              : '…'
          }
        />
        <Row label="Electron" value={info ? `${info.electron} · Chromium ${info.chrome}` : '…'} />
      </dl>
    </section>
  );
}
