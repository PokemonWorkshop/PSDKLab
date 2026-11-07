import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chmod, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { Runtimes } from '../runtimes/layout';
import { downloadFile, moveDir, type Progress } from './download';
import { releaseCacheDir } from './index';
import { psdkRuby } from './ruby';

const run = promisify(execFile);
const RELEASES =
  'https://github.com/PokemonWorkshop/PokemonSDKBinaries/releases';
const rmOpts = {
  recursive: true,
  force: true,
  maxRetries: 10,
  retryDelay: 200,
} as const;

/** Archive name of the official release for an OS. */
export function binariesAsset(platform = process.platform): string {
  if (platform === 'win32') return 'Windows.7z';
  if (platform === 'linux') return 'Linux.7z';
  throw new Error(`No PSDK binaries for ${platform}`);
}

/** Latest published version, from the release's version.json */
export async function latestBinariesVersion(
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  const res = await fetchFn(`${RELEASES}/latest/download/version.json`, {
    redirect: 'follow',
  });
  if (!res.ok)
    throw new Error(
      `Latest PSDK binaries version not found (HTTP ${res.status})`,
    );
  const { version } = (await res.json()) as { version?: string };
  if (!version) throw new Error('version.json has no "version" field');
  return version;
}

export interface InstallOptions {
  rt: Runtimes;
  cacheDir: string; // <userData>/cache
  version: string;
  onProgress?: (p: Progress) => void;
  fetchFn?: typeof fetch;
}

/**
 * Makes sure cache/binaries/<version> holds the extracted PSDK binaries and
 * returns that folder. Done once per version; a `.complete` marker is written
 * last, so an interrupted download is redone instead of half-used.
 */
export async function installBinaries(opts: InstallOptions): Promise<string> {
  const dir = releaseCacheDir(opts.cacheDir, 'binaries', opts.version);
  if (existsSync(join(dir, '.complete'))) return dir;

  const archive = `${dir}.7z`;
  const tmp = `${dir}.tmp`;
  await mkdir(join(dir, '..'), { recursive: true });
  await Promise.all([rm(dir, rmOpts), rm(tmp, rmOpts)]);
  const url = `${RELEASES}/download/${opts.version}/${binariesAsset()}`;
  await downloadFile(url, archive, opts.onProgress, opts.fetchFn);

  await run(opts.rt.sevenZip, ['x', '-y', `-o${tmp}`, archive], {
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  await moveDir(tmp, dir);
  const ruby = psdkRuby(dir);
  if (!existsSync(ruby.bin))
    throw new Error(`Ruby not found in the PSDK binaries: ${ruby.bin}`);
  if (process.platform !== 'win32') await chmod(ruby.bin, 0o755);
  await writeFile(join(dir, '.complete'), opts.version);
  await rm(archive, { force: true });
  return dir;
}
