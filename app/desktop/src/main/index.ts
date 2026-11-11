import { ensureDataLayout } from '@psdk-lab/core';
import { app, BrowserWindow, shell } from 'electron';
import { join } from 'node:path';
import { registerIpc } from './ipc';
import { appData } from './paths';
import { CUSTOM_TITLE_BAR, followMaximized, registerWindowIpc } from './window';

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1240,
    minWidth: 1000,
    minHeight: 680,
    height: 880,
    title: 'PSDK Lab',
    icon: join(__dirname, '../../resources/icon.png'),
    backgroundColor: '#1d1c22', // the app background: no white flash on start
    autoHideMenuBar: true,
    frame: !CUSTOM_TITLE_BAR, // Windows: title bar drawn by the renderer
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  followMaximized(win);
  // Links (the MR on GitLab) open in the system browser, never in the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  // MR descriptions are written by anyone: the page itself never leaves the app.
  win.webContents.on('will-navigate', (event, url) => {
    if (url === win.webContents.getURL()) return; // reload
    event.preventDefault();
    if (url.startsWith('https://')) void shell.openExternal(url);
  });
  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl) void win.loadURL(devUrl);
  else void win.loadFile(join(__dirname, '../renderer/index.html'));
}

app.whenReady().then(async () => {
  await ensureDataLayout(appData());
  registerIpc();
  registerWindowIpc();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
