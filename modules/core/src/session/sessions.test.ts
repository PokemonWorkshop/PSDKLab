import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { writeLock, type SessionLock } from './index';
import { dataLayout } from './layout';
import { isSessionId, listSessions, removeSession } from './sessions';
import { requiredFiles } from './verify';

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
  // Spaces and accents on purpose: sessions live in the user's profile.
  const data = dataLayout(mkdtempSync(join(tmpdir(), 'psdk lab é ')));
  mkdirSync(data.sessionsDir, { recursive: true });
  return data;
}

describe('sessions', () => {
  it('lists ready, unfinished and ignores unknown folders', async () => {
    const data = setup();
    const ready = join(data.sessionsDir, 'mr-101-7a4d9c2');
    await writeLock(ready, lock);
    const binaries = join(data.cacheDir, 'binaries', '1.1.1');
    for (const f of requiredFiles(join(ready, 'game'), binaries)) {
      mkdirSync(dirname(f), { recursive: true });
      writeFileSync(f, '');
    }
    mkdirSync(join(data.sessionsDir, 'mr-205-0000000', 'game'), { recursive: true });
    mkdirSync(join(data.sessionsDir, 'not-a-session'));

    const sessions = await listSessions(data);
    expect(sessions.map((s) => [s.id, s.mrIid, s.ready])).toEqual([
      ['mr-205-0000000', 205, false],
      ['mr-101-7a4d9c2', 101, true],
    ]);
    expect(sessions[0].lock).toBeNull();
    expect(sessions[1]).toMatchObject({ sha7: '7a4d9c2', lock });
  });

  it('removes a session folder and nothing else', async () => {
    const data = setup();
    await writeLock(join(data.sessionsDir, 'mr-101-7a4d9c2'), lock);
    await writeLock(join(data.sessionsDir, 'mr-102-1111111'), lock);
    await removeSession(data, 'mr-101-7a4d9c2');
    expect((await listSessions(data)).map((s) => s.id)).toEqual(['mr-102-1111111']);
  });

  it('refuses anything that is not a session id', async () => {
    expect(isSessionId('../cache')).toBe(false);
    await expect(removeSession(setup(), '../cache')).rejects.toThrow('Invalid session id');
  });
});
