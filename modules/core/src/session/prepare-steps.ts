import { readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { headCommit } from '../git/run';
import { checkPsdkCli } from '../psdk-cli/runner';
import { installBinaries, latestBinariesVersion } from '../releases/binaries';
import { psdkRuby } from '../releases/ruby';
import type { Runtimes } from '../runtimes/layout';
import type { DemoInfo } from './demo';
import { psdkVersionString, type SessionLock } from './index';
import { counter, type reporter } from './progress';
import { runPsdk, type PsdkTarget } from './psdk-process';
import { convertStudioData } from './studio-data';
import { missingFiles } from './verify';

type Report = ReturnType<typeof reporter>;

export interface InstalledTools {
  binariesVersion: string;
  binariesDir: string;
  ruby: ReturnType<typeof psdkRuby>;
  tools: Awaited<ReturnType<typeof checkPsdkCli>>;
}

/** Latest PSDK binaries for this OS (downloaded once per version), plus the Ruby and psdk-cli. */
export async function installTools(
  rt: Runtimes,
  cacheDir: string,
  report: Report,
  fetchFn?: typeof fetch,
): Promise<InstalledTools> {
  const binariesVersion = await latestBinariesVersion(fetchFn);
  let downloaded = false;
  const binariesDir = await installBinaries({
    rt,
    cacheDir,
    version: binariesVersion,
    fetchFn,
    onProgress: (p) => {
      downloaded = true;
      // Download up to 90 %, extraction is the rest.
      const fraction = p.total > 0 ? 0.9 * (p.received / p.total) : 0;
      report.progress(fraction, {
        kind: 'download',
        received: p.received,
        total: p.total,
      });
    },
  });
  const ruby = psdkRuby(binariesDir);
  const tools = await checkPsdkCli(rt, ruby);
  report.done(downloaded ? undefined : { kind: 'cached' });
  return { binariesVersion, binariesDir, ruby, tools };
}

const target = (
  rt: Runtimes,
  i: InstalledTools,
  gameDir: string,
): PsdkTarget => ({
  rt,
  ruby: i.ruby,
  binariesDir: i.binariesDir,
  gameDir,
});

/** YAML files `--util=restore` turns back into .rxdata (it prints each one). */
function yamlCount(dir: string): number {
  let n = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) n += yamlCount(join(dir, e.name));
    else if (e.name.endsWith('.yml')) n += 1;
  }
  return n;
}

/** `--util=restore`: rebuilds the .rxdata files from the demo's YAML. */
export async function restoreGameData(
  rt: Runtimes,
  installed: InstalledTools,
  gameDir: string,
  logs: string,
  report: Report,
): Promise<void> {
  const log = join(logs, 'restore.log');
  const total = Math.max(1, yamlCount(join(gameDir, 'Data')));
  const count = counter('.yml', (n) => {
    const done = Math.min(n, total);
    report.progress(done / total, { kind: 'items', done, total });
  });
  report.progress(0, { kind: 'boot' });
  const code = await runPsdk(
    target(rt, installed, gameDir),
    ['--util=restore'],
    log,
    count,
  );
  if (code !== 0)
    throw new Error(`--util=restore failed (exit ${code}). See ${log}`);
  report.done();
}

/** Data/Studio → psdk.dat, so the game window does not freeze on first launch. */
export async function convertData(
  rt: Runtimes,
  installed: InstalledTools,
  gameDir: string,
  logs: string,
  report: Report,
): Promise<void> {
  const log = join(logs, 'data.log');
  report.progress(0, { kind: 'boot' });
  const code = await convertStudioData(
    target(rt, installed, gameDir),
    log,
    report.progress,
  );
  if (code !== null)
    throw new Error(
      `Converting Data/Studio to psdk.dat failed (exit ${code}). See ${log}`,
    );
  report.done();
}

/** Throws if any required file is missing from the prepared game. */
export function verifySession(gameDir: string, binariesDir: string): void {
  const missing = missingFiles(gameDir, binariesDir);
  if (missing.length > 0)
    throw new Error(`Session incomplete, missing:\n${missing.join('\n')}`);
}

/** Records the versions actually prepared. */
export async function buildLock(
  rt: Runtimes,
  mr: SessionLock['mr'],
  demo: DemoInfo,
  installed: InstalledTools,
  gameDir: string,
  gameData: SessionLock['gameData'],
): Promise<SessionLock> {
  const psdkDir = join(gameDir, 'pokemonsdk');
  return {
    mr,
    pokemonsdk: {
      commit: await headCommit(rt, psdkDir),
      version: psdkVersionString(
        await readFile(join(psdkDir, 'version.txt'), 'utf8'),
      ),
    },
    demo,
    binariesVersion: installed.binariesVersion,
    psdkCliVersion: installed.tools.psdkCli,
    rubyVersion: installed.tools.ruby,
    preparedAt: new Date().toISOString(),
    gameData,
  };
}
