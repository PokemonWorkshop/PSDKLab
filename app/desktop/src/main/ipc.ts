import { checkRuntimes, MrCache, prepareSession } from '@psdk-lab/core';
import { ipcMain, type WebContents } from 'electron';
import { join } from 'node:path';
import { IPC, type MrSelection, type SessionReport } from '../shared/ipc';
import { appData, appRuntimes, runtimesRoot } from './paths';

const sender = (wc: WebContents) => (channel: string, payload: unknown) => {
  if (!wc.isDestroyed()) wc.send(channel, payload);
};

/** Prepares (or reuses) the session of an MR, reporting each step to the renderer. */
function prepare(
  send: ReturnType<typeof sender>,
  mr: MrSelection,
): Promise<SessionReport> {
  return prepareSession({
    rt: appRuntimes(),
    data: appData(),
    mr: { iid: mr.iid, sha: mr.sha },
    onStep: (step) => send(IPC.sessionStep, { mrIid: mr.iid, step }),
    onProgress: (p) => send(IPC.downloadProgress, p),
  });
}

// The renderer never touches the network, the disk or a process: everything goes through here.
export function registerIpc(): void {
  const mrs = new MrCache(join(appData().cacheDir, 'merge-requests.json'));
  ipcMain.handle(IPC.listMrs, (_event, force = false) => mrs.get(force));
  ipcMain.handle(IPC.checkRuntimes, async () => ({
    root: runtimesRoot(),
    ...(await checkRuntimes(appRuntimes())),
  }));
  ipcMain.handle(IPC.prepareSession, (event, mr: MrSelection) =>
    prepare(sender(event.sender), mr),
  );
}
