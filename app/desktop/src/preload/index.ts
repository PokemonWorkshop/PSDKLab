import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import {
  IPC,
  type Api,
  type GameStateEvent,
  type SessionStepEvent,
} from '../shared/ipc';

/** Subscribes to a main → renderer channel; returns the unsubscribe function. */
function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, payload: T) => cb(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const api: Api = {
  window: {
    // Same rule as the main process (frame: false on Windows only).
    customTitleBar: process.platform === 'win32',
    minimize: () => ipcRenderer.send(IPC.windowMinimize),
    toggleMaximize: () => ipcRenderer.send(IPC.windowToggleMaximize),
    close: () => ipcRenderer.send(IPC.windowClose),
    isMaximized: () => ipcRenderer.invoke(IPC.windowIsMaximized),
    onMaximizedChange: (cb) => subscribe<boolean>(IPC.windowMaximized, cb),
  },
  listMrs: (force = false) => ipcRenderer.invoke(IPC.listMrs, force),
  checkRuntimes: () => ipcRenderer.invoke(IPC.checkRuntimes),
  prepareSession: (mr) => ipcRenderer.invoke(IPC.prepareSession, mr),
  onSessionStep: (cb) => subscribe<SessionStepEvent>(IPC.sessionStep, cb),
  launchSession: (id) => ipcRenderer.invoke(IPC.launchSession, id),
  onGameState: (cb) => subscribe<GameStateEvent>(IPC.gameState, cb),
  listSessions: () => ipcRenderer.invoke(IPC.listSessions),
  removeSession: (id) => ipcRenderer.invoke(IPC.removeSession, id),
};

contextBridge.exposeInMainWorld('api', api);
