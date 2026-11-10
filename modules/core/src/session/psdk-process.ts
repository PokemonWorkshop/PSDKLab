import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, sep } from 'node:path';
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
 * Runs `Game.rb <args>` and waits for it, writing its
 * output to `logFile`. Resolves with the exit code.
 */
export async function runPsdk(
  t: PsdkTarget,
  args: string[],
  logFile: string,
): Promise<number> {
  await mkdir(dirname(logFile), { recursive: true });
  const log = createWriteStream(logFile, { flags: 'a' });
  log.write(`\n$ Game.rb ${args.join(' ')}\n`);
  return new Promise((resolve, reject) => {
    const child = spawn(t.ruby.bin, [...PSDK_RUBY_FLAGS, 'Game.rb', ...args], {
      cwd: t.gameDir,
      env: psdkEnv(t),
      windowsHide: true,
    });
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
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
