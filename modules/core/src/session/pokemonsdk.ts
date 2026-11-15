import { existsSync } from 'node:fs';
import { appendFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { cloneFromMirror, updateMirror } from '../git/mirror';
import type { GitProgress } from '../git/run';
import { runPsdkUseMr } from '../psdk-cli/runner';
import type { PsdkRuby } from '../releases/ruby';
import type { Runtimes } from '../runtimes/layout';

/** The URL psdk-cli uses (Psdk::Cli::PSDK::MAIN_REPOSITORY_URL). */
export const PSDK_REMOTE_URL = 'https://gitlab.com/pokemonsdk/pokemonsdk.git';

/** <userData>/cache/pokemonsdk.git: bare mirror (branches and MR heads). */
export const psdkMirror = (cacheDir: string) =>
  join(cacheDir, 'pokemonsdk.git');

/**
 * Gets pokemonsdk ready for psdk-cli, in `target` (outside game/, which the
 * demo clone needs empty): the mirror is updated, then cloned locally without
 * checkout. psdk-cli then finds a repository and only fetches the MR head
 * (already local) and checks it out, instead of cloning all of pokemonsdk.
 */
export async function stagePokemonsdk(
  rt: Runtimes,
  cacheDir: string,
  target: string,
  onProgress?: (fraction: number, p: GitProgress) => void,
): Promise<void> {
  const mirror = psdkMirror(cacheDir);
  await updateMirror(rt, PSDK_REMOTE_URL, mirror, (p) =>
    onProgress?.(0.8 * p.fraction, p),
  );
  await rm(target, { recursive: true, force: true });
  await cloneFromMirror(rt, mirror, target, PSDK_REMOTE_URL, {
    checkout: false,
    onProgress: (p) => onProgress?.(0.8 + 0.2 * p.fraction, p),
  });
}

/**
 * Switches game/pokemonsdk to the MR with the published psdk-cli gem
 * (unchanged). Throws with the log to read when it fails.
 */
export async function switchToMr(
  rt: Runtimes,
  ruby: PsdkRuby,
  iid: number,
  gameDir: string,
  logs: string,
): Promise<void> {
  const prepareLog = join(logs, 'prepare.log');
  const code = await runPsdkUseMr(rt, ruby, iid, {
    cwd: gameDir,
    onLog: (l) => void appendFile(prepareLog, l),
  });
  if (code !== 0 || !existsSync(join(gameDir, 'pokemonsdk', '.git')))
    throw new Error(
      `psdk-use mr ${iid} failed (exit ${code}). See ${prepareLog}`,
    );
}
