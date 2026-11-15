import { existsSync } from 'node:fs';
import { readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { releaseCacheDir } from '../releases/index';
import { readLock, type SessionLock } from './index';
import type { DataLayout } from './layout';
import { missingFiles } from './verify';

const SESSION_ID = /^mr-(\d+)-([0-9a-f]{7})$/;

/** ex. mr-101-7a4d9c2; anything else is refused (paths come from the renderer). */
export const isSessionId = (id: string) => SESSION_ID.test(id);

/** A session folder found on disk, prepared or not. */
export interface SessionSummary {
  id: string;
  mrIid: number;
  sha7: string; // MR head the session was prepared for
  dir: string;
  gameDir: string;
  lock: SessionLock | null; // null: preparation never finished
  ready: boolean; // lock written and every required file present
}

/** Whether a session has its lock and every file needed to launch it. */
export function isComplete(
  gameDir: string,
  cacheDir: string,
  lock: SessionLock,
): boolean {
  const binariesDir = releaseCacheDir(
    cacheDir,
    'binaries',
    lock.binariesVersion,
  );
  return missingFiles(gameDir, binariesDir).length === 0;
}

/** Every session folder in <userData>/sessions, most recent MR first. */
export async function listSessions(
  data: DataLayout,
): Promise<SessionSummary[]> {
  if (!existsSync(data.sessionsDir)) return [];
  const ids = (await readdir(data.sessionsDir)).filter(isSessionId);
  const sessions = await Promise.all(
    ids.map(async (id): Promise<SessionSummary> => {
      const [, iid, sha7] = SESSION_ID.exec(id)!;
      const dir = join(data.sessionsDir, id);
      const gameDir = join(dir, 'game');
      const lock = await readLock(dir);
      const ready = lock !== null && isComplete(gameDir, data.cacheDir, lock);
      return { id, mrIid: Number(iid), sha7, dir, gameDir, lock, ready };
    }),
  );
  return sessions.sort((a, b) => b.mrIid - a.mrIid || a.id.localeCompare(b.id));
}

/**
 * Deletes a session folder (its game, logs and lock). The cache (demo,
 * binaries, mirrors) is shared and kept, so preparing the MR again is quick.
 */
export async function removeSession(
  data: DataLayout,
  id: string,
): Promise<void> {
  if (!isSessionId(id)) throw new Error(`Invalid session id: ${id}`);
  // maxRetries: Windows may briefly lock files of a game that just closed.
  await rm(join(data.sessionsDir, id), {
    recursive: true,
    force: true,
    maxRetries: 5,
  });
}
