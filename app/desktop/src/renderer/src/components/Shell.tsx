import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { RuntimeReport } from '../../../shared/ipc';
import { WorkshopIcon } from '../assets/WorkshopIcon';
import { LanguageSelect } from '../LanguageSelect';
import { TitleBar } from './TitleBar';

const OS = /Windows/i.test(navigator.userAgent)
  ? 'Windows'
  : /Mac/i.test(navigator.userAgent)
    ? 'macOS'
    : 'Linux';

/** Name of the tester's system, as shown in the header and the test report. */
export const osName = () => OS;

function Header() {
  const { t } = useTranslation();
  return (
    <header className="header">
      <WorkshopIcon size={28} />
      <div>
        <div className="brand-eyebrow">{t('app.eyebrow')}</div>
        <div className="brand-name">{t('app.name')}</div>
      </div>
      <div className="header-right">
        <LanguageSelect />
        <span>{OS}</span>
      </div>
    </header>
  );
}

/** Bundled tools check, kept discreet in the footer (shown in orange when broken). */
function RuntimeLine() {
  const { t } = useTranslation();
  const [report, setReport] = useState<RuntimeReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    window.api
      .checkRuntimes()
      .then(setReport)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error)
    return (
      <span className="problem">
        {t('runtime.checkFailed', { message: error })}
      </span>
    );
  if (!report) return <span>{t('runtime.checking')}</span>;
  if (!report.ok)
    return (
      <span
        className="problem"
        title={`${t('runtime.devHint')}\n${report.root}`}
      >
        {t('runtime.problem', { problems: report.problems.join(' · ') })}
      </span>
    );
  return (
    <span title={report.root}>
      {t('runtime.ok', {
        git: report.git?.replace(/^git version /, '') ?? '—',
        cli: report.psdkCli ?? '—',
      })}
    </span>
  );
}

function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="footer">
      <span>{t('app.community')}</span>
      <RuntimeLine />
    </footer>
  );
}

/** The three steps of a test, as on the mock-ups. */
export function Stepper({ current }: { current: 1 | 2 | 3 }) {
  const { t } = useTranslation();
  const labels = [
    t('stepper.choose'),
    t('stepper.prepare'),
    t('stepper.launch'),
  ];
  return (
    <ol className="stepper" style={{ listStyle: 'none', padding: 0 }}>
      {labels.map((label, i) => {
        const n = i + 1;
        const state = n === current ? 'active' : n < current ? 'done' : '';
        return (
          <li
            key={label}
            className={`step ${state}`}
            aria-current={n === current ? 'step' : undefined}
          >
            <span className="step-dot">{n}</span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <TitleBar />
      <Header />
      <main className="main">{children}</main>
      <Footer />
    </div>
  );
}
