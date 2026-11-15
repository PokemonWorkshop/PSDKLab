import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { dataKeys, outputs, restoreFromCache, saveToCache } from './data-cache';

// Spaces and accents on purpose: sessions live in the user's profile.
const tmp = () => mkdtempSync(join(tmpdir(), 'psdk lab é '));

function write(root: string, file: string, content: string) {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), content);
}

/** A game with the pokemonsdk files the keys look at. */
function game() {
  const dir = tmp();
  const s = 'pokemonsdk/scripts';
  write(dir, `${s}/tools/ProjectToYAML.rb`, 'module ProjectToYAML; end');
  write(dir, `${s}/tools/Studio2PSDK.rb`, 'module Studio2PSDK; end');
  write(dir, `${s}/3 Studio/001 Accessors.rb`, 'module Studio; end');
  write(dir, `${s}/0 Dependencies/999 RMXP_DATA.rb`, 'module RPG\n  class Map; end\nend');
  write(dir, `${s}/4 Systems/100 Battle.rb`, 'class Battle; end');
  return dir;
}

describe('game data cache', () => {
  it('changes the key only when what the result depends on changes', async () => {
    const dir = game();
    const base = await dataKeys(dir, 'demo1', '1.1.1');
    const s = join(dir, 'pokemonsdk/scripts');

    writeFileSync(join(s, '4 Systems/100 Battle.rb'), 'class Battle; def x; end; end');
    expect(await dataKeys(dir, 'demo1', '1.1.1')).toEqual(base); // unrelated to the data

    writeFileSync(join(s, '3 Studio/001 Accessors.rb'), 'module Studio; X = 1; end');
    const studio = await dataKeys(dir, 'demo1', '1.1.1');
    expect(studio.data).not.toBe(base.data); // psdk.dat depends on Studio classes
    expect(studio.restore).toBe(base.restore); // .rxdata does not

    expect((await dataKeys(dir, 'demo2', '1.1.1')).restore).not.toBe(base.restore);
    expect((await dataKeys(dir, 'demo1', '1.2.0')).data).not.toBe(studio.data);
  });

  it('follows a serializer an MR adds in a file of its own', async () => {
    const dir = game();
    const base = await dataKeys(dir, 'demo1', '1.1.1');
    write(dir, 'pokemonsdk/scripts/4 Systems/200 Table.rb', 'class Table\n  def _dump(_l) = ""\nend');
    const after = await dataKeys(dir, 'demo1', '1.1.1');
    expect(after.restore).not.toBe(base.restore);
    expect(after.data).not.toBe(base.data);
  });

  it('copies cached files into the next game, and never a half-written entry', async () => {
    const cache = tmp();
    const first = game();
    write(first, 'Data/System.rxdata.yml', 'yaml');
    write(first, 'Data/System.rxdata', 'binary system');
    write(first, 'Data/Map001.rxdata.yml', 'yaml');
    write(first, 'Data/Map001.rxdata', 'binary map');
    write(first, 'Data/configs/console_config.yml', 'not a restore output');
    expect(outputs(first, 'restore').sort()).toEqual(['Data/Map001.rxdata', 'Data/System.rxdata']);

    const next = game();
    expect(await restoreFromCache(cache, 'restore', 'k1', next)).toBe(false);
    await saveToCache(cache, 'restore', 'k1', first);
    expect(await restoreFromCache(cache, 'restore', 'k1', next)).toBe(true);
    expect(readFileSync(join(next, 'Data/System.rxdata'), 'utf8')).toBe('binary system');

    // A cached file gone missing: the entry is not used, the data is rebuilt.
    rmSync(join(cache, 'game-data', 'restore-k1', 'files', 'Data/Map001.rxdata'));
    expect(await restoreFromCache(cache, 'restore', 'k1', game())).toBe(false);
  });
});
