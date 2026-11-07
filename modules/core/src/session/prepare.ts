import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { headCommit } from '../git/run';
import { checkPsdkCli, runPsdkUseMr } from '../psdk-cli/runner';
import { installBinaries, latestBinariesVersion } from '../releases/binaries';
import type { Progress } from '../releases/download';
import { releaseCacheDir } from '../releases/index';
import { psdkRuby } from '../releases/ruby';
import type { Runtimes } from '../runtimes/layout';
import { cloneDemo } from './demo';
import { writeGameRb } from './game-files';
import {
  psdkVersionString,
  readLock,
  sessionDir,
  sessionId,
  writeLock,
  type SessionLock,
} from './index';
import type { DataLayout } from './layout';
import { runPsdk } from './psdk-process';
import { missingFiles } from './verify';

export type SessionStep =
  | 'demo'
  | 'binaries'
  | 'mr'
  | 'restore'
  | 'verify'
  | 'ready';

export interface PrepareOptions {
  rt: Runtimes;
  data: DataLayout;
  mr: { iid: number; sha: string };
  onStep?: (step: SessionStep) => void;
  onProgress?: (p: Progress) => void;
  fetchFn?: typeof fetch;
}

export interface PreparedSession {
  id: string;
  dir: string;
  gameDir: string;
  lock: SessionLock;
}

/** A session already prepared and still complete is kept for a later launch. */
async function existingSession(
  dir: string,
  gameDir: string,
  cacheDir: string,
): Promise<SessionLock | null> {
  const lock = await readLock(dir);
  if (!lock) return null;
  const binariesDir = releaseCacheDir(
    cacheDir,
    'binaries',
    lock.binariesVersion,
  );
  return missingFiles(gameDir, binariesDir).length === 0 ? lock : null;
}

/**
 * Prepares a playable, independent environment for an MR in one call, the way
 * Studio and the demo README do it: latest demo, latest PSDK binaries for this
 * OS, pokemonsdk switched to the MR by the published psdk-cli gem (unchanged),
 * Game.rb, then `--util=restore` to rebuild the .rxdata files.
 * Ready is reported only once the required files exist and the lock with the
 * versions actually prepared is written.
 */
export async function prepareSession(
  opts: PrepareOptions,
): Promise<PreparedSession> {
  const { rt, data, mr, onStep } = opts;
  const id = sessionId(mr.iid, mr.sha);
  const dir = sessionDir(data.sessionsDir, mr.iid, mr.sha);
  const gameDir = join(dir, 'game');
  const logs = join(dir, 'logs');

  const kept = await existingSession(dir, gameDir, data.cacheDir);
  if (kept) {
    onStep?.('ready');
    return { id, dir, gameDir, lock: kept };
  }
  await mkdir(logs, { recursive: true });
  const prepareLog = join(logs, 'prepare.log');

  onStep?.('demo');
  const demo = await cloneDemo(rt, gameDir);

  onStep?.('binaries');
  const binariesVersion = await latestBinariesVersion(opts.fetchFn);
  const binariesDir = await installBinaries({
    rt,
    cacheDir: data.cacheDir,
    version: binariesVersion,
    onProgress: opts.onProgress,
    fetchFn: opts.fetchFn,
  });
  const ruby = psdkRuby(binariesDir);
  const tools = await checkPsdkCli(rt, ruby);

  onStep?.('mr');
  const code = await runPsdkUseMr(rt, ruby, mr.iid, {
    cwd: gameDir,
    onLog: (l) => void appendFile(prepareLog, l),
  });
  if (code !== 0)
    throw new Error(
      `psdk-use mr ${mr.iid} failed (exit ${code}). See ${prepareLog}`,
    );

  onStep?.('restore');
  await writeGameRb(gameDir);
  const restoreLog = join(logs, 'restore.log');
  const restoreCode = await runPsdk(
    { rt, ruby, binariesDir, gameDir },
    ['--util=restore'],
    restoreLog,
  );
  if (restoreCode !== 0)
    throw new Error(
      `--util=restore failed (exit ${restoreCode}). See ${restoreLog}`,
    );

  onStep?.('verify');
  const missing = missingFiles(gameDir, binariesDir);
  if (missing.length > 0)
    throw new Error(`Session incomplete, missing:\n${missing.join('\n')}`);
  const lock: SessionLock = {
    mr,
    pokemonsdk: {
      commit: await headCommit(rt, join(gameDir, 'pokemonsdk')),
      version: psdkVersionString(
        await readFile(join(gameDir, 'pokemonsdk', 'version.txt'), 'utf8'),
      ),
    },
    demo,
    binariesVersion,
    psdkCliVersion: tools.psdkCli,
    rubyVersion: tools.ruby,
    preparedAt: new Date().toISOString(),
  };
  await writeLock(dir, lock);
  onStep?.('ready');
  return { id, dir, gameDir, lock };
}
