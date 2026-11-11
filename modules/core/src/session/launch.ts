import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { releaseCacheDir } from '../releases/index';
import { psdkRuby } from '../releases/ruby';
import type { Runtimes } from '../runtimes/layout';
import { endSummary, exitHint, type GameEnd, type GameState } from './game-end';
import { PSDK_RUBY_FLAGS } from './game-files';
import { readLock } from './index';
import type { DataLayout } from './layout';
import { psdkEnv, type PsdkTarget } from './psdk-process';
import { isSessionId } from './sessions';
import { convertStudioData } from './studio-data';
import { missingFiles } from './verify';

export interface RunGameOptions {
  onState?: (state: GameState) => void;
  signal?: AbortSignal;
  /** Tests only: replaces child_process.spawn. */
  spawnFn?: typeof spawn;
}

const TAIL_CHARS = 4000;
// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g;
/** PSDK prints this once its graphics (the game window) are up. */
export const GAME_READY = '[Graphics]';

/**
 * PSDK's environment, with a PATH reduced to the PSDK Ruby and the OS: a
 * missing dependency then fails instead of being loaded from a Ruby or
 * library installed elsewhere on the machine.
 */
export function gameEnv(
  t: PsdkTarget,
  base: NodeJS.ProcessEnv = process.env,
  platform = process.platform,
): NodeJS.ProcessEnv {
  const root = base.SystemRoot ?? base.SYSTEMROOT ?? 'C:\\Windows';
  const os =
    platform === 'win32'
      ? [join(root, 'System32'), root]
      : ['/usr/bin', '/bin'];
  const sep = platform === 'win32' ? ';' : ':';
  return { ...psdkEnv(t), PATH: [...t.ruby.path, ...os].join(sep) };
}

function spawnError(
  bin: string,
  err: NodeJS.ErrnoException,
  log: string,
): GameEnd {
  if (err.code === 'ENOENT')
    return { kind: 'failed', reason: 'executable-not-found', detail: bin, log };
  if (err.code === 'EACCES')
    return { kind: 'failed', reason: 'executable-denied', detail: bin, log };
  return {
    kind: 'failed',
    reason: 'spawn-error',
    detail: `${bin}: ${err.message}`,
    log,
  };
}

/**
 * Starts `Game.rb` with the session's PSDK Ruby (absolute path, never a Ruby
 * found on PATH) and follows it until it ends. Output goes to `logFile`.
 * Resolves with how it ended; never rejects.
 */
export async function runGame(
  t: PsdkTarget,
  logFile: string,
  opts: RunGameOptions = {},
): Promise<GameEnd> {
  const { onState, signal, spawnFn = spawn } = opts;
  onState?.({ kind: 'starting' });
  await mkdir(dirname(logFile), { recursive: true });
  const log = createWriteStream(logFile, { flags: 'a' });
  log.write(
    `\n[PSDK Lab] ${new Date().toISOString()} $ ${t.ruby.bin} Game.rb\n`,
  );

  const end = await new Promise<GameEnd>((resolve) => {
    let tail = '';
    let running = false;
    let done = false;
    const finish = (e: GameEnd) => {
      if (done) return;
      done = true;
      resolve(signal?.aborted ? { kind: 'stopped', log: logFile } : e);
    };
    // stdin ignored: PSDK's console prompt then reads EOF instead of waiting.
    const child = spawnFn(t.ruby.bin, [...PSDK_RUBY_FLAGS, 'Game.rb'], {
      cwd: t.gameDir,
      env: gameEnv(t),
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      signal,
    });
    const keep = (chunk: Buffer) => {
      tail = (tail + chunk.toString()).slice(-TAIL_CHARS);
      if (!running && tail.includes(GAME_READY)) {
        running = true;
        onState?.({ kind: 'running', pid: child.pid ?? 0 });
      }
    };
    for (const stream of [child.stdout, child.stderr]) {
      stream?.on('data', keep);
      stream?.pipe(log, { end: false });
    }
    child.on('error', (err) => finish(spawnError(t.ruby.bin, err, logFile)));
    child.on('close', (code, sig) =>
      finish(
        code === 0
          ? { kind: 'closed', log: logFile }
          : {
              kind: 'crashed',
              during: running ? 'game' : 'startup',
              code,
              signal: sig,
              hint: exitHint(code),
              output: tail.replace(ANSI, '').trim(),
              log: logFile,
            },
      ),
    );
  });

  // The log is complete on disk before the end is reported.
  await new Promise<void>((r) => log.end(`[PSDK Lab] ${endSummary(end)}\n`, r));
  onState?.(end);
  return end;
}

export interface LaunchOptions extends RunGameOptions {
  rt: Runtimes;
  data: DataLayout;
  id: string; // session id, ex. mr-101-7a4d9c2
}

/**
 * Launches the game of a prepared session with that session's engine
 * (pokemonsdk in game/), PSDK binaries and directory. A missing file fails
 * with the list of what is missing; no other Ruby or PSDK is tried.
 */
export async function launchSession(opts: LaunchOptions): Promise<GameEnd> {
  const { rt, data, id } = opts;
  if (!isSessionId(id))
    return failed(opts, { reason: 'invalid-session', detail: id });

  const dir = join(data.sessionsDir, id);
  const logFile = join(dir, 'logs', 'game.log');
  const lock = await readLock(dir);
  if (!lock) return failed(opts, { reason: 'not-prepared', detail: dir });

  const binariesDir = releaseCacheDir(
    data.cacheDir,
    'binaries',
    lock.binariesVersion,
  );
  const gameDir = join(dir, 'game');
  const missing = missingFiles(gameDir, binariesDir);
  if (missing.length > 0)
    return failed(opts, {
      reason: 'missing-files',
      files: missing,
      log: logFile,
    });

  try {
    const target = { rt, ruby: psdkRuby(binariesDir), binariesDir, gameDir };
    // Done here, without a window, for sessions prepared before this step existed.
    opts.onState?.({ kind: 'starting' });
    const code = await convertStudioData(target, logFile);
    if (code !== null)
      return failed(opts, {
        reason: 'data-conversion',
        detail: `exit ${code}`,
        log: logFile,
      });
    return await runGame(target, logFile, {
      ...opts,
      // 'starting' was already reported above.
      onState: (s) => s.kind !== 'starting' && opts.onState?.(s),
    });
  } catch (err) {
    return failed(opts, {
      reason: 'spawn-error',
      detail: (err as Error).message,
      log: logFile,
    });
  }
}

/** Reports a launch that never started, and records it in the session's log. */
async function failed(
  opts: LaunchOptions,
  failure: Omit<Extract<GameEnd, { kind: 'failed' }>, 'kind'>,
): Promise<GameEnd> {
  const end: GameEnd = { kind: 'failed', ...failure };
  const { log } = failure;
  if (log) {
    const line = `\n[PSDK Lab] ${new Date().toISOString()} ${endSummary(end)}\n`;
    try {
      await mkdir(dirname(log), { recursive: true });
      await appendFile(log, line);
    } catch {
      // The failure still reaches the interface.
    }
  }
  opts.onState?.(end);
  return end;
}
