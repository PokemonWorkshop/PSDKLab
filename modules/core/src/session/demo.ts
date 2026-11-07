import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { git, headCommit } from '../git/run';
import type { Runtimes } from '../runtimes/layout';

/** Official Technical Demo (plain Git, no LFS). */
export const DEMO_REMOTE_URL =
  'https://github.com/PokemonWorkshop/PSDKTechnicalDemo.git';

export interface DemoInfo {
  commit: string;
  version: string; // demo_version.txt
}

/** Latest demo (default branch), cloned once into the session's game/ folder. */
export async function cloneDemo(
  rt: Runtimes,
  gameDir: string,
): Promise<DemoInfo> {
  if (!existsSync(join(gameDir, 'project.studio'))) {
    await mkdir(dirname(gameDir), { recursive: true });
    await git(
      rt,
      dirname(gameDir),
      'clone',
      '--depth',
      '1',
      '--quiet',
      DEMO_REMOTE_URL,
      gameDir,
    );
  }
  const versionFile = join(gameDir, 'demo_version.txt');
  const version = existsSync(versionFile)
    ? (await readFile(versionFile, 'utf8')).trim()
    : 'unknown';
  return { commit: await headCommit(rt, gameDir), version };
}
