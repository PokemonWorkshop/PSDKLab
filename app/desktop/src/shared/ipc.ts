import type {
  GameState,
  MrList,
  RuntimeStatus,
  SessionLock,
  SessionSummary,
  StepUpdate,
} from '@psdk-lab/core';

/** IPC channel names, shared by main and preload. */
export const IPC = {
  listMrs: 'mr:list',
  checkRuntimes: 'runtimes:check',
  prepareSession: 'session:prepare',
  sessionStep: 'session:step',
  launchSession: 'session:launch',
  gameState: 'session:game-state',
  windowMinimize: 'window:minimize',
  windowToggleMaximize: 'window:toggle-maximize',
  windowClose: 'window:close',
  windowIsMaximized: 'window:is-maximized',
  windowMaximized: 'window:maximized',
  listSessions: 'session:list',
  removeSession: 'session:remove',
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

/** Progress of one step of an MR's preparation, sent while it runs. */
export interface SessionStepEvent {
  mrIid: number;
  update: StepUpdate;
}

/** 'already-running': the game of this session was started earlier and is still running. */
export type LaunchResult = 'started' | 'already-running';

/** 'game-running': the session's game is open, close it first. */
export type RemoveResult = 'removed' | 'game-running';

/** State of a session's game (starting, running, then how it ended). */
export interface GameStateEvent {
  sessionId: string;
  state: GameState;
}

/** The window, for the title bar drawn by the renderer (Windows only). */
export interface WindowApi {
  customTitleBar: boolean;
  minimize(): void;
  toggleMaximize(): void;
  close(): void;
  isMaximized(): Promise<boolean>;
  onMaximizedChange(cb: (maximized: boolean) => void): () => void;
}

export interface Api {
  window: WindowApi;
  /** Cached for a few minutes; `force` re-asks GitLab unless it is rate limiting us. */
  listMrs(force?: boolean): Promise<MrList>;
  checkRuntimes(): Promise<RuntimeReport>;
  prepareSession(mr: MrSelection): Promise<SessionReport>;
  /** Step updates of the preparations running (several steps can run at once). */
  onSessionStep(cb: (e: SessionStepEvent) => void): () => void;
  /** Starts the game; its states then arrive through onGameState. */
  launchSession(id: string): Promise<LaunchResult>;
  onGameState(cb: (e: GameStateEvent) => void): () => void;
  /** Session folders on disk, prepared or not. */
  listSessions(): Promise<SessionSummary[]>;
  /** Deletes a session folder; the shared cache is kept. */
  removeSession(id: string): Promise<RemoveResult>;
}
