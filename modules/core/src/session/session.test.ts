import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GAME_RB } from './game-files';
import { isSessionLock, psdkVersionString, sessionId } from './index';
import { missingFiles, requiredFiles } from './verify';

describe('session', () => {
  it('names sessions after the MR and its head', () => {
    expect(sessionId(101, '7a4d9c2f0000')).toBe('mr-101-7a4d9c2');
  });

  it('reads pokemonsdk/version.txt like PSDK does', () => {
    expect(psdkVersionString('6694\n')).toBe('26.38');
  });

  it('rejects a lock from another format, so the session is prepared again', () => {
    const lock = {
      mr: { iid: 101, sha: '7a4d9c2' },
      pokemonsdk: { commit: 'a'.repeat(40), version: '26.38' },
      demo: { commit: 'b'.repeat(40), version: '1.0.28' },
      binariesVersion: '1.1.1',
      psdkCliVersion: '0.1.1',
      rubyVersion: '3.0.0',
      preparedAt: '2026-11-07T00:00:00.000Z',
    };
    expect(isSessionLock(lock)).toBe(true);
    expect(isSessionLock({ ...lock, pokemonsdk: undefined })).toBe(false);
    expect(isSessionLock({ mr: { iid: 101 }, binariesVersion: '1.1.1' })).toBe(
      false,
    );
  });

  it('writes the Game.rb Studio ships, booting the local pokemonsdk first', () => {
    expect(GAME_RB).toContain(
      "(Dir.exist?('pokemonsdk') && File.expand_path('pokemonsdk'))",
    );
    expect(GAME_RB).toContain(".tr('\\\\', '/')");
    expect(GAME_RB).toContain(
      "ScriptLoader.load_tool('GameLoader/Z_load_uncompiled')",
    );
  });

  for (const platform of ['win32', 'linux'] as const) {
    it(`is ready only when every required file exists (${platform})`, () => {
      // Spaces and accents on purpose: sessions live in the user's profile.
      const root = mkdtempSync(join(tmpdir(), 'psdk lab é '));
      const game = join(root, 'session à tester', 'game');
      const binaries = join(root, 'binaries 1.1.1');
      const files = requiredFiles(game, binaries, platform);
      expect(missingFiles(game, binaries, platform)).toEqual(files);
      for (const f of files.slice(1)) {
        mkdirSync(dirname(f), { recursive: true });
        writeFileSync(f, '');
      }
      expect(missingFiles(game, binaries, platform)).toEqual([files[0]]);
      writeFileSync(files[0], '{}');
      expect(missingFiles(game, binaries, platform)).toEqual([]);
    });
  }
});
