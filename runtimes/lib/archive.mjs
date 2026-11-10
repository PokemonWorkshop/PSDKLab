// Download (with cache and checksum) and extraction of the runtime archives.
import { cpSync, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, join } from 'node:path';
import { findRoot, log, run, sha256, systemTool } from './util.mjs';

const require = createRequire(import.meta.url);

/**
 * Downloads `url` into `cacheDir` once, then reuses it. curl is used instead of
 * fetch: it ships with Windows 10+ and Linux, and honours HTTPS_PROXY.
 */
export async function download(url, cacheDir, expectedSha) {
  mkdirSync(cacheDir, { recursive: true });
  const file = join(cacheDir, basename(new URL(url).pathname));
  if (!existsSync(file)) {
    log('fetch', url);
    const part = `${file}.part`;
    run(systemTool('curl'), [
      '-fL',
      '--retry',
      '3',
      '--progress-bar',
      '-o',
      part,
      url,
    ]);
    renameSync(part, file);
  }
  const actual = await sha256(file);
  if (expectedSha && actual !== expectedSha) {
    rmSync(file, { force: true });
    throw new Error(
      `checksum mismatch for ${basename(file)}\n  expected ${expectedSha}\n  got      ${actual}`,
    );
  }
  if (!expectedSha)
    log('sha256', `${basename(file)} ${actual} (pin it in versions.json)`);
  return file;
}

/** 7za binary from the 7zip-bin package (already used by electron-builder). */
function sevenZip() {
  return require('7zip-bin').path7za;
}

function extractInto(archive, dest) {
  mkdirSync(dest, { recursive: true });
  if (archive.endsWith('.7z') || archive.endsWith('.zip')) {
    run(sevenZip(), ['x', '-y', `-o${dest}`, archive], { capture: true });
  } else if (archive.endsWith('.tar.gz') || archive.endsWith('.tgz')) {
    run(systemTool('tar'), ['-xzf', archive, '-C', dest]);
  } else {
    throw new Error(`unsupported archive: ${archive}`);
  }
}

const sleep = (ms) =>
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const rmOpts = {
  recursive: true,
  force: true,
  maxRetries: 10,
  retryDelay: 200,
};

/**
 * On Windows, an antivirus (Defender) or the search indexer briefly locks
 * freshly extracted files, so renaming the folder fails with EPERM/EBUSY.
 * Retry for a few seconds, then fall back to a copy.
 */
function moveDir(src, dest) {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      renameSync(src, dest);
      return;
    } catch (err) {
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(err.code)) throw err;
      sleep(500);
    }
  }
  log('copy', `rename blocked, copying ${basename(src)} instead`);
  cpSync(src, dest, { recursive: true, verbatimSymlinks: true });
}

/**
 * Extracts `archive`, locates the folder holding `marker`, and moves it to
 * `target` (replacing any previous version).
 */
export function installArchive(archive, target, marker) {
  const tmp = `${target}.tmp`;
  rmSync(tmp, rmOpts);
  extractInto(archive, tmp);
  const root = findRoot(tmp, marker);
  if (!root) throw new Error(`${marker} not found in ${basename(archive)}`);
  rmSync(target, rmOpts);
  moveDir(root, target);
  rmSync(tmp, rmOpts);
}
