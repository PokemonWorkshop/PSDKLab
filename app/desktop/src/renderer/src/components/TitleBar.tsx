import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

// Segoe Fluent Icons / MDL2 Assets glyphs, as in Pokémon Studio's title bar.
const MINIMIZE = '';
const MAXIMIZE = '';
const RESTORE = '';
const CLOSE = '';

/**
 * Title bar drawn by the app (Windows, frameless window): drag area with the
 * title, then minimize, maximize/restore and close. Renders nothing where the
 * system frame is kept (Linux, macOS).
 */
export function TitleBar() {
  const { t } = useTranslation();
  const win = window.api.window;
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!win.customTitleBar) return;
    void win.isMaximized().then(setMaximized);
    return win.onMaximizedChange(setMaximized);
  }, [win]);

  if (!win.customTitleBar) return null;
  return (
    <div className="titlebar" onDoubleClick={() => win.toggleMaximize()}>
      <span className="titlebar-title">PSDK Lab</span>
      <div
        className="titlebar-actions"
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="minimize"
          title={t('titlebar.minimize')}
          aria-label={t('titlebar.minimize')}
          onClick={() => win.minimize()}
        >
          {MINIMIZE}
        </button>
        <button
          type="button"
          className="maximize"
          title={t(maximized ? 'titlebar.restore' : 'titlebar.maximize')}
          aria-label={t(maximized ? 'titlebar.restore' : 'titlebar.maximize')}
          onClick={() => win.toggleMaximize()}
        >
          {maximized ? RESTORE : MAXIMIZE}
        </button>
        <button
          type="button"
          className="close"
          title={t('titlebar.close')}
          aria-label={t('titlebar.close')}
          onClick={() => win.close()}
        >
          {CLOSE}
        </button>
      </div>
    </div>
  );
}
