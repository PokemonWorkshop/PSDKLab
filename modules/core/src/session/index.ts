import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** The versions actually prepared for a session (session.lock.json). */
export interface SessionLock {
  mr: { iid: number; sha: string }; // the selected MR, as announced by GitLab
  pokemonsdk: { commit: string; version: string }; // HEAD after `psdk-use mr`, read with Git
  demo: { commit: string; version: string };
  binariesVersion: string;
  psdkCliVersion: string; // the published gem that switched pokemonsdk to the MR
  rubyVersion: string; // Ruby shipped in the PSDK binaries
  preparedAt: string;
}

/** ex. mr-101-7a4d9c2 */
export function sessionId(mrIid: number, sha: string): string {
  return `mr-${mrIid}-${sha.slice(0, 7)}`;
}

/** <userData>/sessions/<id>/ */
export function sessionDir(
  sessionsDir: string,
  mrIid: number,
  sha: string,
): string {
  return join(sessionsDir, sessionId(mrIid, sha));
}

/** pokemonsdk/version.txt holds an integer; PSDK shows it as bytes*/
export function psdkVersionString(raw: string): string {
  const n = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(n)) return raw.trim();
  const bytes = [24, 16, 8, 0].map((shift) => (n >>> shift) & 0xff);
  return bytes.join('.').replace(/^(0\.)+/, '');
}

export async function writeLock(dir: string, lock: SessionLock): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, 'session.lock.json'),
    JSON.stringify(lock, null, 2),
  );
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;
const isVersioned = (v: unknown) =>
  isObject(v) && typeof v.commit === 'string' && typeof v.version === 'string';

/** Rejects locks written in another format */
export function isSessionLock(v: unknown): v is SessionLock {
  return (
    isObject(v) &&
    isObject(v.mr) &&
    typeof v.mr.iid === 'number' &&
    typeof v.mr.sha === 'string' &&
    isVersioned(v.pokemonsdk) &&
    isVersioned(v.demo) &&
    ['binariesVersion', 'psdkCliVersion', 'rubyVersion', 'preparedAt'].every(
      (k) => typeof v[k] === 'string',
    )
  );
}

/** The session's lock, or null when missing, unreadable or in an unknown format (the session is then prepared again). */
export async function readLock(dir: string): Promise<SessionLock | null> {
  try {
    const lock: unknown = JSON.parse(
      await readFile(join(dir, 'session.lock.json'), 'utf8'),
    );
    return isSessionLock(lock) ? lock : null;
  } catch {
    return null;
  }
}
