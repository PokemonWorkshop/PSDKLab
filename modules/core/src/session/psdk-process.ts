import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, sep } from 'node:path';
import type { PsdkRuby } from '../releases/ruby';
import { buildEnv } from '../runtimes/env';
import type { Runtimes } from '../runtimes/layout';
import { PSDK_RUBY_FLAGS } from './game-files';

export interface PsdkTarget {
  rt: Runtimes;
  ruby: PsdkRuby;
  binariesDir: string; // cache/binaries/<version>
  gameDir: string; // sessions/<id>/game
}

/** Environment Studio gives PSDK: the binaries' Ruby, plus PSDK_BINARY_PATH (LiteRGSS & co). */
export function psdkEnv(t: PsdkTarget): NodeJS.ProcessEnv {
  return { ...buildEnv(t.rt, t.ruby), PSDK_BINARY_PATH: t.binariesDir + sep };
}

/**
 * Loaded with `ruby -r` when the output is followed: piped, Ruby's stdout is
 * block-buffered (PSDK only syncs it once the game window opens), so progress
 * lines would only arrive at the end.
 */
const SYNC_FILE = 'psdk_lab_sync.rb';
const SYNC_RB =
  '# PSDK Lab: flush each line, so progress shows while it runs.\n$stdout.sync = true\n';

/**
 * Runs `Game.rb <args>` and waits for it, writing its output to `logFile`
 * (and to `onOutput`, for progress). Resolves with the exit code.
 */
export async function runPsdk(
  t: PsdkTarget,
  args: string[],
  logFile: string,
  onOutput?: (chunk: string) => void,
): Promise<number> {
  await mkdir(dirname(logFile), { recursive: true });
  const log = createWriteStream(logFile, { flags: 'a' });
  log.write(`\n$ Game.rb ${args.join(' ')}\n`);
  const sync: string[] = [];
  if (onOutput) {
    await writeFile(join(t.gameDir, SYNC_FILE), SYNC_RB);
    sync.push(`-r./${SYNC_FILE}`);
  }
  return new Promise((resolve, reject) => {
    const child = spawn(
      t.ruby.bin,
      [...PSDK_RUBY_FLAGS, ...sync, 'Game.rb', ...args],
      {
        cwd: t.gameDir,
        env: psdkEnv(t),
        windowsHide: true,
      },
    );
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    if (onOutput)
      child.stdout.on('data', (c: Buffer) => onOutput(c.toString()));
    child.on('error', (err) => {
      log.end();
      reject(err);
    });
    child.on('close', (code) => {
      log.end();
      resolve(code ?? 1);
    });
  });
}
