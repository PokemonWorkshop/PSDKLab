import { BrowserWindow, ipcMain } from 'electron';
import { IPC } from '../shared/ipc';

/**
 * Windows: no system frame, the renderer draws its own title bar (like
 * Pokémon Studio) and drives the window through these channels. Linux and
 * macOS keep their native frame: the window manager's buttons are expected.
 */
export const CUSTOM_TITLE_BAR = process.platform === 'win32';

const win = (e: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) =>
  BrowserWindow.fromWebContents(e.sender);

export function registerWindowIpc(): void {
  ipcMain.on(IPC.windowMinimize, (e) => win(e)?.minimize());
  ipcMain.on(IPC.windowToggleMaximize, (e) => {
    const w = win(e);
    if (!w) return;
    if (w.isMaximized()) w.unmaximize();
    else w.maximize();
  });
  ipcMain.on(IPC.windowClose, (e) => win(e)?.close());
  ipcMain.handle(IPC.windowIsMaximized, (e) => win(e)?.isMaximized() ?? false);
}

/** Tells the renderer when the window is maximized or restored (maximize/restore icon). */
export function followMaximized(w: BrowserWindow): void {
  const send = () => {
    if (!w.webContents.isDestroyed()) w.webContents.send(IPC.windowMaximized, w.isMaximized());
  };
  w.on('maximize', send);
  w.on('unmaximize', send);
}
