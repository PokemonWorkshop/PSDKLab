import type { Progress } from '@psdk-lab/core';
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { IPC, type Api, type SessionStepEvent } from '../shared/ipc';

/** Subscribes to a main → renderer channel; returns the unsubscribe function. */
function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, payload: T) => cb(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const api: Api = {
  listMrs: (force = false) => ipcRenderer.invoke(IPC.listMrs, force),
  checkRuntimes: () => ipcRenderer.invoke(IPC.checkRuntimes),
  prepareSession: (mr) => ipcRenderer.invoke(IPC.prepareSession, mr),
  onSessionStep: (cb) => subscribe<SessionStepEvent>(IPC.sessionStep, cb),
  onDownloadProgress: (cb) => subscribe<Progress>(IPC.downloadProgress, cb),
};

contextBridge.exposeInMainWorld('api', api);
