// Integration test: launches the game of a real prepared session (opens a game
// window). Not part of `npm test`. Prepare a session in the app first, then:
//
//   npm run prepare:runtimes
//   PSDK_LAB_USER_DATA=<app userData> PSDK_LAB_SESSION_ID=mr-<iid>-<sha7> npm run test:integration
//
// On Windows the app's userData is %APPDATA%/@psdk-lab/desktop.
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { psdkRuby } from '../releases/ruby';
import { releaseCacheDir } from '../releases/index';
import { runtimesAt } from '../runtimes/layout';
import { readLock } from './index';
import type { GameState } from './game-end';
import { launchSession } from './launch';
import { dataLayout } from './layout';
import { convertStudioData, studioDataFile } from './studio-data';
import { rubyLibraries } from './verify';

const userData = process.env.PSDK_LAB_USER_DATA ?? '';
const id = process.env.PSDK_LAB_SESSION_ID ?? '';
const runtimesRoot =
  process.env.PSDK_LAB_RUNTIMES ??
  resolve(dirname(fileURLToPath(import.meta.url)), '../../../../runtimes/dist');
// Long enough for PSDK to boot and load its data (about 15 s on the demo).
const ALIVE_MS = 30_000;

describe.skipIf(!userData || !id)('launch a prepared session (integration)', () => {
  const data = dataLayout(userData);
  const rt = runtimesAt(runtimesRoot, data.psdkCliDir);
  let copyRoot = '';
  afterAll(() => copyRoot && rm(copyRoot, { recursive: true, force: true }));

  it('starts the real game with the session engine and keeps it running', async () => {
    const abort = new AbortController();
    const states: GameState[] = [];
    let timer: NodeJS.Timeout | undefined;
    const end = await launchSession({
      rt,
      data,
      id,
      signal: abort.signal,
      onState: (s) => {
        states.push(s);
        if (s.kind === 'running') timer = setTimeout(() => abort.abort(), ALIVE_MS);
      },
    });
    clearTimeout(timer);

    // Still running when stopped: it did not exit with an error while booting.
    expect(states.map((s) => s.kind)).toEqual(['starting', 'running', 'stopped']);
    expect(end.kind).toBe('stopped');
    const log = readFileSync(join(data.sessionsDir, id, 'logs', 'game.log'), 'utf8');
    // PSDK prints its paths with forward slashes.
    const psdk = join(data.sessionsDir, id, 'game', 'pokemonsdk').replace(/\\/g, '/');
    expect(log).toContain(psdk);
  }, 2 * ALIVE_MS);

  /** Copies the session and its binaries without `removed` (a file of the binaries). */
  async function copyWithout(removed: (binaries: string) => string) {
    const lock = await readLock(join(data.sessionsDir, id));
    expect(lock).not.toBeNull();
    copyRoot ||= mkdtempSync(join(tmpdir(), 'PSDK Lab copie é '));
    const copy = dataLayout(mkdtempSync(join(copyRoot, 'session ')));
    const binaries = releaseCacheDir(data.cacheDir, 'binaries', lock!.binariesVersion);
    const copyBinaries = releaseCacheDir(copy.cacheDir, 'binaries', lock!.binariesVersion);
    const skip = removed(binaries);
    // Not cpSync: on Windows its native copy mangles non-ASCII destination paths.
    await cp(join(data.sessionsDir, id), join(copy.sessionsDir, id), { recursive: true });
    await cp(binaries, copyBinaries, { recursive: true, filter: (src) => src !== skip });
    const missing = join(copyBinaries, relative(binaries, skip));
    expect(existsSync(missing)).toBe(false);
    return { copy, binaries, missing };
  }

  async function launchCopy(removed: (binaries: string) => string) {
    const { copy, missing } = await copyWithout(removed);
    const states: GameState['kind'][] = [];
    const end = await launchSession({ rt, data: copy, id, onState: (s) => states.push(s.kind) });
    expect(states).toEqual(['failed']);
    expect(end.kind).toBe('failed');
    if (end.kind !== 'failed') return;
    expect(end.reason).toBe('missing-files');
    // Only the copy's own binaries are looked at, never the original ones.
    expect(end.files).toEqual([missing]);
    expect(readFileSync(join(copy.sessionsDir, id, 'logs', 'game.log'), 'utf8')).toContain(
      'game could not start',
    );
  }

  it('fails clearly on a copy of the session whose Ruby executable is missing', () =>
    launchCopy((b) => psdkRuby(b).bin), 10 * 60_000);

  it.runIf(process.platform === 'win32')(
    'fails clearly on a copy whose Ruby DLL is missing, instead of loading another Ruby',
    () => launchCopy((b) => rubyLibraries(b)[0]),
    10 * 60_000,
  );
  it('builds the game data before launching, so the game window never waits on it', async () => {
    const { copy } = await copyWithout((b) => join(b, 'none'));
    const lock = await readLock(join(copy.sessionsDir, id));
    const binariesDir = releaseCacheDir(copy.cacheDir, 'binaries', lock!.binariesVersion);
    const gameDir = join(copy.sessionsDir, id, 'game');
    await rm(studioDataFile(gameDir));
    const log = join(copy.sessionsDir, id, 'logs', 'game.log');
    const target = { rt, ruby: psdkRuby(binariesDir), binariesDir, gameDir };
    expect(await convertStudioData(target, log)).toBeNull();
    expect(existsSync(studioDataFile(gameDir))).toBe(true);
    expect(readFileSync(log, 'utf8')).toContain('converting dex');
  }, 10 * 60_000);
});
