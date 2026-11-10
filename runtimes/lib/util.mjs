// Small helpers shared by the runtimes/ scripts (plain Node, no dependencies).
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const isWin = process.platform === 'win32';

/** Key used in versions.json, "win32-x64" or "linux-x64". */
export function platformKey() {
  return `${process.platform}-${process.arch}`;
}

/**
 * Windows ships curl.exe and tar.exe (bsdtar) in System32. We call them by full
 * path so a GNU tar from Git Bash or MSYS2 never takes over (it chokes on "C:").
 */
export function systemTool(name) {
  if (!isWin) return name;
  const root = process.env.SystemRoot ?? 'C:\\Windows';
  return join(root, 'System32', `${name}.exe`);
}

/** Runs a command, streams its output, throws on a non-zero exit code. */
export function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    stdio: opts.capture ? 'pipe' : 'inherit',
    encoding: 'utf8',
    ...opts,
  });
  if (r.error) throw new Error(`${cmd}: ${r.error.message}`);
  if (r.status !== 0) {
    const detail = opts.capture ? `\n${r.stdout ?? ''}${r.stderr ?? ''}` : '';
    throw new Error(
      `${cmd} ${args.join(' ')} exited with ${r.status}${detail}`,
    );
  }
  return (r.stdout ?? '').trim();
}

export function sha256(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    createReadStream(file)
      .on('data', (d) => hash.update(d))
      .on('error', reject)
      .on('end', () => resolve(hash.digest('hex')));
  });
}

/**
 * Finds the directory that contains `marker` ("bin/ruby.exe") at most
 * `depth` levels below `dir`. Archives wrap their content in one or two folders.
 */
export function findRoot(dir, marker, depth = 3) {
  if (existsSync(join(dir, marker))) return dir;
  if (depth === 0) return null;
  for (const name of readdirSync(dir)) {
    const child = join(dir, name);
    if (!statSync(child).isDirectory()) continue;
    const found = findRoot(child, marker, depth - 1);
    if (found) return found;
  }
  return null;
}

export function log(step, message) {
  console.log(`[runtimes] ${step.padEnd(8)} ${message}`);
}
