// Checks that the Electron binary is present, downloads it otherwise.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
let dir;
try {
  dir = dirname(require.resolve('electron/package.json'));
} catch {
  console.error(
    '[electron] package not found: run `npm install` at the repo root.',
  );
  process.exit(1);
}

const present = () =>
  existsSync(join(dir, 'path.txt')) && existsSync(join(dir, 'dist'));

if (!present()) {
  console.warn('[electron] binary missing, downloading…');
  const env = { ...process.env };
  delete env.ELECTRON_SKIP_BINARY_DOWNLOAD;
  const r = spawnSync(process.execPath, [join(dir, 'install.js')], {
    stdio: 'inherit',
    env,
  });
  if (r.status !== 0 || !present()) {
    console.error('[electron] download failed (network, proxy, antivirus?).');
    console.error('Try again, or set ELECTRON_MIRROR if GitHub is blocked.');
    process.exit(1);
  }
}
