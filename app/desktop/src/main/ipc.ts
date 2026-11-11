import {
  checkRuntimes,
  launchSession,
  listSessions,
  MrCache,
  prepareSession,
  removeSession,
} from '@psdk-lab/core';
import { BrowserWindow, ipcMain, type WebContents } from 'electron';
import { join } from 'node:path';
import {
  IPC,
  type LaunchResult,
  type MrSelection,
  type RemoveResult,
  type SessionReport,
} from '../shared/ipc';
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
    onUpdate: (update) => send(IPC.sessionStep, { mrIid: mr.iid, update }),
  });
}

const runningGames = new Set<string>();

/** Brings PSDK Lab back in front once the game is over, to go on with the MR. */
function backToWorkflow(wc: WebContents): void {
  const win = BrowserWindow.fromWebContents(wc);
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.focus();
}

/** Starts a session's game once at a time and forwards its states to the renderer. */
function launch(wc: WebContents, id: string): LaunchResult {
  if (runningGames.has(id)) return 'already-running';
  runningGames.add(id);
  const send = sender(wc);
  void launchSession({
    rt: appRuntimes(),
    data: appData(),
    id,
    onState: (state) => send(IPC.gameState, { sessionId: id, state }),
  }).finally(() => {
    runningGames.delete(id);
    backToWorkflow(wc);
  });
  return 'started';
}

/** Deletes a session, unless its game is open (its files are in use). */
async function remove(id: string): Promise<RemoveResult> {
  if (runningGames.has(id)) return 'game-running';
  await removeSession(appData(), id);
  return 'removed';
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
  ipcMain.handle(IPC.launchSession, (event, id: string) =>
    launch(event.sender, id),
  );
  ipcMain.handle(IPC.listSessions, () => listSessions(appData()));
  ipcMain.handle(IPC.removeSession, (_event, id: string) => remove(id));
}
