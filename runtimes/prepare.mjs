// Assembles runtimes/dist for the current OS, before electron-builder copies
// it into the app resources (extraResources):
//
//   dist/git/        portable Git (dugite-native)
//   dist/psdk-cli/   the published psdk-cli gem, unpacked unchanged
//   dist/thor/       the published thor gem (psdk-cli's only dependency)
//   dist/7z/         7za, to extract the PSDK binaries at runtime
//
// No Ruby here: psdk-cli runs with the Ruby shipped in the PSDK binaries.
//
//   node runtimes/prepare.mjs           # only what changed in versions.json
//   node runtimes/prepare.mjs --force   # rebuild everything
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { download, installArchive } from './lib/archive.mjs';
import { withGit } from './lib/env.mjs';
import { installGems, readVersion } from './lib/gems.mjs';
import { isWin, log, platformKey, run } from './lib/util.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, 'dist');
const cache = join(here, '.cache');
const force = process.argv.includes('--force');

const versions = JSON.parse(readFileSync(join(here, 'versions.json'), 'utf8'));
const target = versions[platformKey()];
if (!target) {
  console.error(
    `[runtimes] no runtimes defined for ${platformKey()} in versions.json`,
  );
  process.exit(1);
}

const gitDir = join(dist, 'git');
const manifestFile = join(dist, 'manifest.json');
const previous = existsSync(manifestFile)
  ? JSON.parse(readFileSync(manifestFile, 'utf8'))
  : {};
const same = (key, value) =>
  !force && JSON.stringify(previous[key]) === JSON.stringify(value);

async function prepareGit() {
  const marker = isWin ? join('cmd', 'git.exe') : join('bin', 'git');
  if (same('git', target.git) && existsSync(join(gitDir, marker)))
    return log('git', `${target.git.version} up to date`);
  const archive = await download(
    target.git.url,
    join(cache, 'git'),
    target.git.sha256,
  );
  log('git', `installing ${target.git.version}`);
  installArchive(archive, gitDir, marker);
}

async function prepareGems() {
  const ready = versions.gems.every((g) =>
    existsSync(join(dist, g.name, 'lib')),
  );
  if (same('gems', versions.gems) && ready) return log('gems', 'up to date');
  await installGems(versions.gems, dist, cache);
}

const gitBin = () =>
  join(gitDir, isWin ? join('cmd', 'git.exe') : join('bin', 'git'));

function prepareSevenZip() {
  const src = require('7zip-bin').path7za;
  const dest = join(dist, '7z', basename(src));
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  if (!isWin) chmodSync(dest, 0o755);
  return dest;
}

/** Removes leftovers from older layouts (dist/ruby, dist/gems) so they are not shipped. */
function pruneDist() {
  const keep = new Set([
    'git',
    '7z',
    'manifest.json',
    ...versions.gems.map((g) => g.name),
  ]);
  for (const name of readdirSync(dist)) {
    if (keep.has(name)) continue;
    log('clean', `removing dist/${name}`);
    rmSync(join(dist, name), {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 200,
    });
  }
}

async function main() {
  mkdirSync(dist, { recursive: true });
  pruneDist();
  await prepareGit();
  await prepareGems();
  prepareSevenZip();
  const found = {
    git: run(gitBin(), ['--version'], { env: withGit(gitDir), capture: true }),
    psdkCli: readVersion(
      join(dist, 'psdk-cli', 'lib', 'psdk', 'cli', 'version.rb'),
    ),
    thor: readVersion(join(dist, 'thor', 'lib', 'thor', 'version.rb')),
  };
  if (!found.psdkCli || !found.thor)
    throw new Error('psdk-cli or thor gem is incomplete');
  if (!existsSync(join(dist, 'psdk-cli', 'exe', 'psdk-use')))
    throw new Error('psdk-use missing from the psdk-cli gem');
  const manifest = {
    platform: platformKey(),
    git: target.git,
    gems: versions.gems,
    found,
  };
  writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
  log('ok', `${found.git} · psdk-cli ${found.psdkCli} · thor ${found.thor}`);
}

main().catch((err) => {
  console.error(`[runtimes] ${err.message}`);
  process.exit(1);
});
