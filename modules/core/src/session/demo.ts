import { existsSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { cloneFromMirror, updateMirror } from '../git/mirror';
import { headCommit, type GitProgress } from '../git/run';
import type { Runtimes } from '../runtimes/layout';

/** Official Technical Demo (plain Git, no LFS). */
export const DEMO_REMOTE_URL =
  'https://github.com/PokemonWorkshop/PSDKTechnicalDemo.git';

/** <userData>/cache/demo.git: bare mirror the sessions are cloned from. */
export const demoMirror = (cacheDir: string) => join(cacheDir, 'demo.git');

export interface DemoInfo {
  commit: string;
  version: string; // demo_version.txt
}

/**
 * Latest demo (default branch) in the session's game/ folder. The mirror is
 * updated (only new objects are downloaded), then cloned locally: the ~200 MB
 * of Git objects are downloaded once for all sessions, not once per session.
 * `onProgress` gets the fetch (0–30 %) then the checkout (30–100 %).
 */
export async function cloneDemo(
  rt: Runtimes,
  cacheDir: string,
  gameDir: string,
  onProgress?: (fraction: number, p: GitProgress) => void,
): Promise<DemoInfo> {
  if (!existsSync(join(gameDir, 'project.studio'))) {
    // Left by an interrupted clone: start again from an empty folder.
    await rm(gameDir, { recursive: true, force: true, maxRetries: 5 });
    const mirror = demoMirror(cacheDir);
    await updateMirror(rt, DEMO_REMOTE_URL, mirror, (p) =>
      onProgress?.(0.3 * p.fraction, p),
    );
    await cloneFromMirror(rt, mirror, gameDir, DEMO_REMOTE_URL, {
      onProgress: (p) => onProgress?.(0.3 + 0.7 * p.fraction, p),
    });
  }
  const versionFile = join(gameDir, 'demo_version.txt');
  const version = existsSync(versionFile)
    ? (await readFile(versionFile, 'utf8')).trim()
    : 'unknown';
  return { commit: await headCommit(rt, gameDir), version };
}
