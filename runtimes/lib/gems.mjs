// Published gems (thor, psdk-cli), used unchanged.
//
// A .gem is a plain tar holding data.tar.gz (the gem's files). These gems are
// pure Ruby, so there is nothing to compile or install: we download the
// official .gem from rubygems.org, check its SHA-256, and unpack data.tar.gz
// into dist/<name>/. The app then loads them with `ruby -I <name>/lib`.
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { download } from './archive.mjs';
import { log, run, systemTool } from './util.mjs';

const rmOpts = {
  recursive: true,
  force: true,
  maxRetries: 10,
  retryDelay: 200,
};

function unpackGem(gemFile, target) {
  const tmp = `${target}.tmp`;
  rmSync(tmp, rmOpts);
  mkdirSync(tmp, { recursive: true });
  run(systemTool('tar'), ['-xf', gemFile, '-C', tmp]);
  const data = join(tmp, 'data.tar.gz');
  if (!existsSync(data)) throw new Error(`data.tar.gz missing in ${gemFile}`);
  rmSync(target, rmOpts);
  mkdirSync(target, { recursive: true });
  run(systemTool('tar'), ['-xzf', data, '-C', target]);
  rmSync(tmp, rmOpts);
}

/** dist/<name>/ for every gem listed in versions.json. */
export async function installGems(gems, dist, cache) {
  for (const spec of gems) {
    const url = `https://rubygems.org/downloads/${spec.name}-${spec.version}.gem`;
    const file = await download(url, join(cache, 'gems'), spec.sha256);
    unpackGem(file, join(dist, spec.name));
    log(spec.name, `${spec.version} unpacked`);
  }
}

/** VERSION constant of a Ruby file, read as text (no Ruby needed). */
export function readVersion(file) {
  const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
  return /VERSION\s*=\s*['"]([^'"]+)['"]/.exec(text)?.[1] ?? null;
}
