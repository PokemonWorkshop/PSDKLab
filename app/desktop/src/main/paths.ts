import {
  dataLayout,
  runtimesAt,
  type DataLayout,
  type Runtimes,
} from '@psdk-lab/core';
import { app } from 'electron';
import { join } from 'node:path';

/**
 * Packaged: electron-builder copies runtimes/dist to <resources>/runtimes
 * (extraResources). Dev: app.getAppPath() is app/desktop, so the repo's
 * runtimes/dist is two levels up.
 */
export function runtimesRoot(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'runtimes')
    : join(app.getAppPath(), '..', '..', 'runtimes', 'dist');
}

export function appData(): DataLayout {
  return dataLayout(app.getPath('userData'));
}

export function appRuntimes(): Runtimes {
  return runtimesAt(runtimesRoot(), appData().psdkCliDir);
}
