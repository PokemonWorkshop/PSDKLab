import type {
  MrList,
  Progress,
  RuntimeStatus,
  SessionLock,
  SessionStep,
} from '@psdk-lab/core';

/** IPC channel names, shared by main and preload. */
export const IPC = {
  listMrs: 'mr:list',
  checkRuntimes: 'runtimes:check',
  prepareSession: 'session:prepare',
  sessionStep: 'session:step',
  downloadProgress: 'session:download-progress',
} as const;

export type RuntimeReport = RuntimeStatus & { root: string };

/** The MR to prepare, as selected in the list. */
export interface MrSelection {
  iid: number;
  sha: string;
}

/** A session ready to launch, with the versions actually prepared. */
export interface SessionReport {
  id: string;
  dir: string;
  gameDir: string;
  lock: SessionLock;
}

/** Progress of one MR's preparation, sent while it runs. */
export interface SessionStepEvent {
  mrIid: number;
  step: SessionStep;
}

export interface Api {
  /** Cached for a few minutes; `force` re-asks GitLab unless it is rate limiting us. */
  listMrs(force?: boolean): Promise<MrList>;
  checkRuntimes(): Promise<RuntimeReport>;
  prepareSession(mr: MrSelection): Promise<SessionReport>;
  onSessionStep(cb: (e: SessionStepEvent) => void): () => void;
  onDownloadProgress(cb: (p: Progress) => void): () => void;
}
