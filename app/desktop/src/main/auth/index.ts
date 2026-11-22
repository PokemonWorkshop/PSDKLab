import { AuthManager, GITLAB_SCOPES, type AuthStatus } from '@psdk-lab/core';
import {
  GITLAB_CLIENT_ID,
  GITLAB_REDIRECT_URI,
} from '@psdk-lab/core/constants';
import { BrowserWindow, ipcMain, shell } from 'electron';
import { IPC } from '../../shared/ipc';
import { waitForCallback } from './loopback';
import { electronTokenStore } from './token-store';

let manager: AuthManager | null = null;
let pending: AbortController | null = null;

/** The account of the tester (created once the app is ready: safeStorage needs it). */
export function auth(): AuthManager {
  if (!manager) {
    const clientId = process.env.PSDK_LAB_GITLAB_CLIENT_ID || GITLAB_CLIENT_ID;
    const app = clientId
      ? { clientId, redirectUri: GITLAB_REDIRECT_URI, scopes: GITLAB_SCOPES }
      : null;
    manager = new AuthManager(app, electronTokenStore());
  }
  return manager;
}

/** Every window shows the account in its header. */
export async function broadcastAuth(): Promise<AuthStatus> {
  const status = await auth().status();
  for (const win of BrowserWindow.getAllWindows())
    if (!win.webContents.isDestroyed())
      win.webContents.send(IPC.authChanged, status);
  return status;
}

const PAGE = (ok: boolean) => `<!doctype html><meta charset="utf-8">
<title>PSDK Lab</title>
<body style="background:#1d1c22;color:#f4f4f5;font:15px 'Segoe UI',system-ui,sans-serif;display:grid;place-items:center;height:90vh;margin:0">
<div style="text-align:center">
<p style="font-size:18px;font-weight:600">${ok ? 'PSDK Lab ✓' : 'PSDK Lab ✗'}</p>
<p style="color:#a1a1aa">${
  ok
    ? 'You can close this tab and go back to PSDK Lab.<br>Vous pouvez fermer cet onglet et revenir sur PSDK Lab.'
    : 'Sign-in cancelled. You can close this tab.<br>Connexion annulée. Vous pouvez fermer cet onglet.'
}</p></div></body>`;

/** Opens GitLab in the system browser and waits for the account to come back. */
async function signIn(win: BrowserWindow | null): Promise<AuthStatus> {
  pending?.abort();
  const controller = new AbortController();
  pending = controller;
  try {
    const req = auth().begin();
    const callback = waitForCallback(
      GITLAB_REDIRECT_URI,
      controller.signal,
      PAGE,
    );
    await shell.openExternal(req.url);
    const { code, state } = await callback;
    await auth().complete(req, code, state);
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
    return await broadcastAuth();
  } finally {
    if (pending === controller) pending = null;
  }
}

export function registerAuthIpc(): void {
  ipcMain.handle(IPC.authStatus, () => auth().status());
  ipcMain.handle(IPC.authSignIn, (e) =>
    signIn(BrowserWindow.fromWebContents(e.sender)),
  );
  ipcMain.handle(IPC.authSignInToken, async (_e, token: string) => {
    await auth().signInWithToken(token);
    return broadcastAuth();
  });
  ipcMain.handle(IPC.authCancel, () => pending?.abort());
  ipcMain.handle(IPC.authSignOut, async () => {
    await auth().signOut();
    return broadcastAuth();
  });
}
