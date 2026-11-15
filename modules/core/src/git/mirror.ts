import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Runtimes } from '../runtimes/layout';
import { git, gitWithProgress, type GitProgress } from './run';

/**
 * Keeps a bare mirror of `remote` in `mirrorDir`: cloned once, then only the
 * new objects are fetched. Sessions are cloned from it locally, so the
 * Technical Demo (~200 MB of Git objects) and pokemonsdk are not downloaded
 * again for every session.
 */
export async function updateMirror(
  rt: Runtimes,
  remote: string,
  mirrorDir: string,
  onProgress?: (p: GitProgress) => void,
): Promise<void> {
  if (existsSync(join(mirrorDir, 'HEAD'))) {
    await gitWithProgress(
      rt,
      mirrorDir,
      ['fetch', '--prune', 'origin'],
      onProgress,
    );
    return;
  }
  await mkdir(dirname(mirrorDir), { recursive: true });
  await gitWithProgress(
    rt,
    dirname(mirrorDir),
    ['clone', '--mirror', remote, mirrorDir],
    onProgress,
  );
}

/**
 * Clones from the local mirror (objects are hard-linked: no download, little
 * disk), then points `origin` back to the official remote.
 * `checkout: false` leaves the working tree empty for a later checkout.
 */
export async function cloneFromMirror(
  rt: Runtimes,
  mirrorDir: string,
  target: string,
  remote: string,
  opts: { checkout?: boolean; onProgress?: (p: GitProgress) => void } = {},
): Promise<void> {
  await mkdir(dirname(target), { recursive: true });
  const noCheckout = opts.checkout === false ? ['--no-checkout'] : [];
  await gitWithProgress(
    rt,
    dirname(target),
    ['clone', '--local', ...noCheckout, mirrorDir, target],
    opts.onProgress,
  );
  await git(rt, target, 'remote', 'set-url', 'origin', remote);
}
