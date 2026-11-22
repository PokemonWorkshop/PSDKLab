import {
  checkRuntimes,
  launchSession,
  listSessions,
  MrCache,
  prepareSession,
  removeSession,
} from '@psdk-lab/core';
import { app, BrowserWindow, ipcMain, type WebContents } from 'electron';
import { release } from 'node:os';
import { join } from 'node:path';
import { auth, registerAuthIpc } from './auth';
import { comment, discussions } from './discussions';
import {
  IPC,
  type CommentInput,
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
async function prepare(
  send: ReturnType<typeof sender>,
  mr: MrSelection,
): Promise<SessionReport> {
  const session = await prepareSession({
    rt: appRuntimes(),
    data: appData(),
    mr: { iid: mr.iid, sha: mr.sha },
    onUpdate: (update) => send(IPC.sessionStep, { mrIid: mr.iid, update }),
  });
  // Update: the older sessions of this MR go once the new head is ready.
  const old = (mr.replace ?? []).filter(
    (id) => id !== session.id && id.startsWith(`mr-${mr.iid}-`),
  );
  for (const id of old) await remove(id).catch(() => 'kept');
  return session;
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
  registerAuthIpc();
  // Signed in, the list is asked with the account (its own GitLab quota).
  const mrs = new MrCache(
    join(appData().cacheDir, 'merge-requests.json'),
    undefined,
    undefined,
    undefined,
    () => auth().accessToken().catch(() => null),
  );
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
  ipcMain.handle(IPC.listDiscussions, (_event, iid: number, force = false) =>
    discussions(iid, force),
  );
  ipcMain.handle(IPC.comment, (_event, input: CommentInput) => comment(input));
  ipcMain.handle(IPC.appInfo, () => ({
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    osRelease: release(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  }));
}
