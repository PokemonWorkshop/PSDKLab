import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { runtimesAt } from '../runtimes/layout';
import { writeLock, type SessionLock } from './index';
import { exitHint, type GameState } from './game-end';
import { gameEnv, GAME_READY, launchSession, runGame } from './launch';
import { dataLayout } from './layout';
import type { PsdkTarget } from './psdk-process';

// Spaces and accents on purpose: sessions live in the user's profile.
const tmp = () => mkdtempSync(join(tmpdir(), 'psdk lab é '));

function target(): PsdkTarget {
  const root = tmp();
  return {
    rt: runtimesAt(join(root, 'runtimes'), join(root, 'psdk-cli')),
    ruby: { bin: join(root, 'binaries', 'ruby.exe'), path: [], env: {} },
    binariesDir: join(root, 'binaries'),
    gameDir: root,
  };
}

/** Records what would have been started, then runs a Node script instead of Ruby. */
function fakeRuby(script: string) {
  const calls: { cmd: string; args: readonly string[]; env: NodeJS.ProcessEnv }[] = [];
  const fn = ((cmd: string, args: readonly string[], opts: { env: NodeJS.ProcessEnv }) => {
    calls.push({ cmd, args, env: opts.env });
    return spawn(process.execPath, ['-e', script], opts);
  }) as unknown as typeof spawn;
  return { fn, calls };
}

async function run(t: PsdkTarget, spawnFn?: typeof spawn, signal?: AbortSignal) {
  const states: GameState['kind'][] = [];
  const log = join(t.gameDir, 'logs', 'game.log');
  const end = await runGame(t, log, {
    spawnFn,
    signal,
    onState: (s) => states.push(s.kind),
  });
  return { end, states, log: () => readFileSync(log, 'utf8') };
}

const READY = `console.log(${JSON.stringify(GAME_READY)} + " window up");`;

describe('runGame', () => {
  it("starts Game.rb with the session's Ruby, binaries and directory, then reports a normal close", async () => {
    const t = target();
    const ruby = fakeRuby(
      READY +
        'console.log(process.cwd(), process.env.PSDK_BINARY_PATH, process.env.RUBYOPT ?? "-")',
    );
    vi.stubEnv('RUBYOPT', '-rsystem_ruby');
    const { end, states, log } = await run(t, ruby.fn);
    vi.unstubAllEnvs();

    expect(states).toEqual(['starting', 'running', 'closed']);
    expect(end.kind).toBe('closed');
    expect(ruby.calls[0].cmd).toBe(t.ruby.bin);
    expect(ruby.calls[0].args.at(-1)).toBe('Game.rb');
    expect(log()).toContain(`${t.gameDir} ${t.binariesDir}`);
    expect(log()).not.toContain('-rsystem_ruby'); // no RUBYOPT from the machine
    expect(log()).toContain('[PSDK Lab] game closed (exit 0)');
  });

  it('stays starting until PSDK reports its window, and reports an exit before that as a startup failure', async () => {
    const ruby = fakeRuby(
      'console.error("\u001b[31mLoadError: LiteRGSS\u001b[37m"); process.exit(3)',
    );
    const { end, states } = await run(target(), ruby.fn);
    expect(states).toEqual(['starting', 'crashed']);
    expect(end).toMatchObject({
      kind: 'crashed',
      during: 'startup',
      code: 3,
      output: 'LoadError: LiteRGSS',
    });
  });

  it('tells an error while the game runs apart from a startup failure', async () => {
    const ruby = fakeRuby(READY + 'process.exit(1)');
    const { end, states } = await run(target(), ruby.fn);
    expect(states).toEqual(['starting', 'running', 'crashed']);
    expect(end).toMatchObject({ kind: 'crashed', during: 'game', code: 1 });
  });

  it('fails clearly when the executable is missing, without trying another Ruby', async () => {
    const t = target();
    const { end, states, log } = await run(t);
    expect(states).toEqual(['starting', 'failed']);
    expect(end).toMatchObject({
      kind: 'failed',
      reason: 'executable-not-found',
      detail: t.ruby.bin,
    });
    expect(log()).toContain('game could not start');
  });

  it('reports a game stopped by PSDK Lab as stopped, not as a crash', async () => {
    const ruby = fakeRuby(READY + 'setTimeout(() => {}, 30000)');
    const abort = new AbortController();
    const t = target();
    const states: GameState['kind'][] = [];
    const end = await runGame(t, join(t.gameDir, 'game.log'), {
      spawnFn: ruby.fn,
      signal: abort.signal,
      onState: (s) => {
        states.push(s.kind);
        if (s.kind === 'running') abort.abort();
      },
    });
    expect(end.kind).toBe('stopped');
    expect(states).toEqual(['starting', 'running', 'stopped']);
  });
});

describe('gameEnv', () => {
  it('keeps only the PSDK Ruby and the OS on PATH, so no other Ruby can fill in a missing DLL', () => {
    const t = target();
    t.ruby.path = [t.binariesDir];
    vi.stubEnv('PATH', 'C:\\Ruby33-x64\\bin;C:\\Windows\\System32');
    const env = gameEnv(t, { SystemRoot: 'C:\\Windows' }, 'win32');
    vi.unstubAllEnvs();
    expect(env.PATH).toBe(
      [t.binariesDir, 'C:\\Windows\\System32', 'C:\\Windows'].join(';'),
    );
    expect(env.PSDK_BINARY_PATH?.startsWith(t.binariesDir)).toBe(true);
  });
});

describe('exitHint', () => {
  it('explains the Windows exit code of a missing DLL, signed or not', () => {
    expect(exitHint(0xc0000135, 'win32')).toBe('dll-not-found');
    expect(exitHint(-1073741515, 'win32')).toBe('dll-not-found');
    expect(exitHint(1, 'win32')).toBeNull();
    expect(exitHint(127, 'linux')).toBe('not-found');
  });
});

describe('launchSession', () => {
  const lock: SessionLock = {
    mr: { iid: 101, sha: '7a4d9c2' },
    pokemonsdk: { commit: 'a'.repeat(40), version: '26.38' },
    demo: { commit: 'b'.repeat(40), version: '1.0.28' },
    binariesVersion: '1.1.1',
    psdkCliVersion: '0.1.1',
    rubyVersion: '3.0.6',
    preparedAt: '2026-11-07T00:00:00.000Z',
  };

  function setup() {
    const root = tmp();
    const data = dataLayout(root);
    const ruby = fakeRuby('');
    const states: GameState[] = [];
    const launch = (id: string) =>
      launchSession({
        rt: runtimesAt(join(root, 'runtimes'), data.psdkCliDir),
        data,
        id,
        spawnFn: ruby.fn,
        onState: (s) => states.push(s),
      });
    return { data, ruby, states, launch };
  }

  it('lists the missing files and starts nothing', async () => {
    const { data, ruby, states, launch } = setup();
    await writeLock(join(data.sessionsDir, 'mr-101-7a4d9c2'), lock);
    const end = await launch('mr-101-7a4d9c2');
    expect(end.kind).toBe('failed');
    if (end.kind !== 'failed') return;
    expect(end.reason).toBe('missing-files');
    expect(end.files).toContain(join(data.cacheDir, 'binaries', '1.1.1', 'ruby.exe'));
    expect(ruby.calls).toEqual([]);
    expect(states.map((s) => s.kind)).toEqual(['failed']);
    const log = readFileSync(join(data.sessionsDir, 'mr-101-7a4d9c2', 'logs', 'game.log'), 'utf8');
    expect(log).toContain('game could not start: missing-files');
  });

  it('refuses a session that is not prepared', async () => {
    const { ruby, launch } = setup();
    const end = await launch('mr-102-0000000');
    expect(end).toMatchObject({ kind: 'failed', reason: 'not-prepared' });
    expect(ruby.calls).toEqual([]);
  });

  it('refuses an id that is not a session id', async () => {
    const { ruby, launch } = setup();
    const end = await launch('../../somewhere');
    expect(end).toMatchObject({
      kind: 'failed',
      reason: 'invalid-session',
      detail: '../../somewhere',
    });
    expect(ruby.calls).toEqual([]);
  });
});
