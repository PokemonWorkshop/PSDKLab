import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { moveDir } from '../releases/download';
import type { Runtimes } from '../runtimes/layout';
import {
  dataKeys,
  restoreFromCache,
  saveToCache,
  type DataPart,
} from './data-cache';
import { cloneDemo } from './demo';
import { writeGameRb } from './game-files';
import {
  readLock,
  sessionDir,
  sessionId,
  writeLock,
  type SessionLock,
} from './index';
import type { DataLayout } from './layout';
import { stagePokemonsdk, switchToMr } from './pokemonsdk';
import {
  buildLock,
  convertData,
  installTools,
  restoreGameData,
  verifySession,
} from './prepare-steps';
import { reporter, type OnUpdate, type SessionStep } from './progress';
import { isComplete } from './sessions';

export interface PrepareOptions {
  rt: Runtimes;
  data: DataLayout;
  mr: { iid: number; sha: string };
  /** Each step reports when it starts, how far it is, and when it is done. */
  onUpdate?: OnUpdate;
  fetchFn?: typeof fetch;
}

export interface PreparedSession {
  id: string;
  dir: string;
  gameDir: string;
  lock: SessionLock;
}

/**
 * Prefixes a failure with its step, e.g. "[binaries] HTTP 503": steps run in
 * parallel and only the message crosses IPC, so the interface reads the step here.
 */
async function tagged<T>(step: SessionStep, work: Promise<T>): Promise<T> {
  try {
    return await work;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      message.startsWith('[') ? message : `[${step}] ${message}`,
      {
        cause: err,
      },
    );
  }
}

/**
 * Copies a game data part from the cache when its key is known, else builds
 * it and caches it for the next sessions. Resolves with "reused".
 */
async function cachedPart(
  cacheDir: string,
  part: DataPart,
  key: string,
  gameDir: string,
  report: ReturnType<typeof reporter>,
  build: () => Promise<void>,
): Promise<boolean> {
  if (await restoreFromCache(cacheDir, part, key, gameDir)) {
    report.done({ kind: 'cached' });
    return true;
  }
  await build();
  await saveToCache(cacheDir, part, key, gameDir);
  return false;
}

/** A session already prepared and still complete is kept for a later launch. */
async function existingSession(
  dir: string,
  gameDir: string,
  cacheDir: string,
): Promise<SessionLock | null> {
  const lock = await readLock(dir);
  return lock && isComplete(gameDir, cacheDir, lock) ? lock : null;
}

/**
 * Prepares a playable, independent environment for an MR in one call, the way
 * Studio and the demo README do it: latest demo, latest PSDK binaries for this
 * OS, pokemonsdk switched to the MR by the published psdk-cli gem (unchanged),
 * Game.rb, `--util=restore` and the Studio data conversion.
 *
 * What does not depend on each other runs at the same time:
 *   1. demo ∥ binaries ∥ pokemonsdk (cloned from local mirrors, not the network)
 *   2. psdk-use mr (only fetches the MR head)
 *   3. restore ∥ data (two PSDK processes writing different files)
 * Ready is reported only once the required files exist and the lock with the
 * versions actually prepared is written.
 */
export async function prepareSession(
  opts: PrepareOptions,
): Promise<PreparedSession> {
  const { rt, data, mr, onUpdate } = opts;
  const id = sessionId(mr.iid, mr.sha);
  const dir = sessionDir(data.sessionsDir, mr.iid, mr.sha);
  const gameDir = join(dir, 'game');
  const logs = join(dir, 'logs');
  const step = {
    demo: reporter('demo', onUpdate),
    binaries: reporter('binaries', onUpdate),
    mr: reporter('mr', onUpdate),
    restore: reporter('restore', onUpdate),
    data: reporter('data', onUpdate),
    verify: reporter('verify', onUpdate),
    ready: reporter('ready', onUpdate),
  };

  const kept = await existingSession(dir, gameDir, data.cacheDir);
  if (kept) {
    step.ready.done({ kind: 'cached' });
    return { id, dir, gameDir, lock: kept };
  }
  await mkdir(logs, { recursive: true });

  // 1. Independent downloads and copies, side by side.
  const staged = join(dir, 'pokemonsdk.staged');
  Object.values(step)
    .slice(0, 3)
    .forEach((s) => s.start());
  step.demo.progress(0, { kind: 'lookup' });
  step.mr.progress(0, { kind: 'lookup' });
  const [demo, installed] = await Promise.all([
    tagged(
      'demo',
      cloneDemo(rt, data.cacheDir, gameDir, (f, p) =>
        step.demo.progress(f, { kind: 'git', phase: p.phase }),
      ).then((d) => (step.demo.done(), d)),
    ),
    tagged(
      'binaries',
      installTools(rt, data.cacheDir, step.binaries, opts.fetchFn),
    ),
    tagged(
      'mr',
      stagePokemonsdk(rt, data.cacheDir, staged, (f, p) =>
        step.mr.progress(0.6 * f, { kind: 'git', phase: p.phase }),
      ),
    ),
  ]);

  // 2. pokemonsdk into the project, then psdk-cli switches it to the MR.
  const psdkDir = join(gameDir, 'pokemonsdk');
  await tagged(
    'mr',
    (async () => {
      await rm(psdkDir, { recursive: true, force: true });
      await moveDir(staged, psdkDir);
      step.mr.progress(0.7, { kind: 'git', phase: 'checkout' });
      await switchToMr(rt, installed.ruby, mr.iid, gameDir, logs);
    })(),
  );
  step.mr.done();

  // 3. Game data: restore (.rxdata) and conversion (psdk.dat), side by side,
  // copied from the cache when the same demo, binaries and MR files built them.
  await writeGameRb(gameDir);
  step.restore.start();
  step.data.start();
  const keys = await dataKeys(gameDir, demo.commit, installed.binariesVersion);
  const [restoreReused, dataReused] = await Promise.all([
    tagged(
      'restore',
      cachedPart(
        data.cacheDir,
        'restore',
        keys.restore,
        gameDir,
        step.restore,
        () => restoreGameData(rt, installed, gameDir, logs, step.restore),
      ),
    ),
    tagged(
      'data',
      cachedPart(data.cacheDir, 'data', keys.data, gameDir, step.data, () =>
        convertData(rt, installed, gameDir, logs, step.data),
      ),
    ),
  ]);
  const gameData = {
    restore: { key: keys.restore, reused: restoreReused },
    data: { key: keys.data, reused: dataReused },
  };

  step.verify.start();
  await tagged(
    'verify',
    Promise.resolve().then(() => verifySession(gameDir, installed.binariesDir)),
  );
  const lock = await buildLock(rt, mr, demo, installed, gameDir, gameData);
  await writeLock(dir, lock);
  step.verify.done();

  step.ready.done();
  return { id, dir, gameDir, lock };
}
