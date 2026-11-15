import { createHash } from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';
import { cp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';

/**
 * Game data rebuilt from the demo (restore → .rxdata, conversion → psdk.dat)
 * is the same for most MRs. It is kept in <cache>/game-data/<key>/ and copied
 * into the next sessions whose key matches, instead of running Ruby again.
 *
 * The key covers everything the result depends on: the demo commit (its YAML
 * and JSON), the binaries version (LiteRGSS serializes Table, Color…), and the
 * MR's own files that produce or serialize the data. Those files are found in
 * the MR itself, so an MR adding a serializer elsewhere changes the key.
 */
export type DataPart = 'restore' | 'data';

const VERSION = 'v1'; // bump when what is cached or how keys are made changes

/** Every .rb file under `dir` (sorted, for a stable key). */
function rubyFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, e.name);
    if (e.isDirectory()) out.push(...rubyFiles(path));
    else if (e.name.endsWith('.rb')) out.push(path);
  }
  return out.sort();
}

// Classes stored in .rxdata / psdk.dat, and custom Marshal formats.
const SERIALIZATION = /^\s*(?:module|class)\s+RPG\b|def\s+(?:self\.)?(?:_dump|_load|marshal_dump|marshal_load)\b/m;

/** The MR's files each part depends on (paths inside pokemonsdk/scripts). */
export async function dependencies(scriptsDir: string): Promise<Record<DataPart, string[]>> {
  const serializers: string[] = [];
  for (const file of rubyFiles(scriptsDir))
    if (SERIALIZATION.test(await readFile(file, 'utf8'))) serializers.push(file);
  const tools = join(scriptsDir, 'tools');
  return {
    restore: [join(tools, 'ProjectToYAML.rb'), ...serializers],
    data: [join(tools, 'Studio2PSDK.rb'), ...rubyFiles(join(scriptsDir, '3 Studio')), ...serializers],
  };
}

export interface DataKeys {
  restore: string;
  data: string;
}

/** Cache keys of both parts for a prepared game (pokemonsdk already on the MR). */
export async function dataKeys(
  gameDir: string,
  demoCommit: string,
  binariesVersion: string,
): Promise<DataKeys> {
  const scripts = join(gameDir, 'pokemonsdk', 'scripts');
  const deps = await dependencies(scripts);
  const key = async (part: DataPart) => {
    const hash = createHash('sha256').update(`${VERSION}\n${part}\n${demoCommit}\n${binariesVersion}\n`);
    for (const file of [...new Set(deps[part])]) {
      hash.update(relative(scripts, file).replace(/\\/g, '/') + '\n');
      hash.update(existsSync(file) ? await readFile(file) : 'missing');
    }
    return hash.digest('hex').slice(0, 16);
  };
  return { restore: await key('restore'), data: await key('data') };
}

/** Files each part writes, relative to game/. */
export function outputs(gameDir: string, part: DataPart): string[] {
  if (part === 'data') return ['Data/Studio/psdk.dat'];
  // restore writes X from X.yml (the list it skips is tracked as-is by Git).
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(join(gameDir, dir), { withFileTypes: true })) {
      const path = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(path);
      else if (e.name.endsWith('.yml')) found.push(path.slice(0, -'.yml'.length));
    }
  };
  walk('Data');
  return found.filter((f) => existsSync(join(gameDir, f)));
}

const entry = (cacheDir: string, part: DataPart, key: string) =>
  join(cacheDir, 'game-data', `${part}-${key}`);

/** Copies a cached part into the game. False when that key is not cached. */
export async function restoreFromCache(
  cacheDir: string,
  part: DataPart,
  key: string,
  gameDir: string,
): Promise<boolean> {
  const dir = entry(cacheDir, part, key);
  const manifest = join(dir, 'files.json');
  if (!existsSync(manifest)) return false;
  const files = JSON.parse(await readFile(manifest, 'utf8')) as string[];
  if (!files.every((f) => existsSync(join(dir, 'files', f)))) return false;
  for (const f of files) {
    await mkdir(dirname(join(gameDir, f)), { recursive: true });
    await cp(join(dir, 'files', f), join(gameDir, f), { force: true });
  }
  return true;
}

/**
 * Keeps a part just built. Written to a temporary folder and renamed, so a
 * half-written entry is never used (two preparations may finish together).
 */
export async function saveToCache(
  cacheDir: string,
  part: DataPart,
  key: string,
  gameDir: string,
): Promise<void> {
  const dir = entry(cacheDir, part, key);
  if (existsSync(join(dir, 'files.json'))) return;
  const files = outputs(gameDir, part);
  if (files.length === 0) return;
  const tmp = `${dir}.tmp-${process.pid}-${Date.now()}`;
  try {
    for (const f of files) {
      await mkdir(dirname(join(tmp, 'files', f)), { recursive: true });
      await cp(join(gameDir, f), join(tmp, 'files', f));
    }
    await writeFile(join(tmp, 'files.json'), JSON.stringify(files, null, 2));
    await rename(tmp, dir);
  } catch {
    // Not cached this time (another preparation saved it first, disk full…).
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}
