// Environment for the bundled Git, used at build time to fetch the sources.
// Keep in sync with gitEnv() in modules/core/src/runtimes/env.ts (a core test compares both).
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** Git for Windows builds put their tools in ucrt64/ (recent) or mingw64/ (older). */
export function gitToolchainDir(gitDir, platform = process.platform) {
  if (platform !== 'win32') return null;
  const dirs = ['ucrt64', 'mingw64'].map((d) => join(gitDir, d));
  return dirs.find((d) => existsSync(d)) ?? dirs[0];
}

export function gitPath(gitDir, platform = process.platform) {
  const tool = gitToolchainDir(gitDir, platform);
  return tool
    ? [join(gitDir, 'cmd'), join(tool, 'bin'), join(gitDir, 'usr', 'bin')]
    : [join(gitDir, 'bin')];
}

/** Variables that make the bundled Git self-contained (no system install needed). */
export function gitEnv(gitDir, platform = process.platform) {
  const tool = gitToolchainDir(gitDir, platform);
  const env = {
    GIT_TERMINAL_PROMPT: '0',
    GIT_EXEC_PATH: join(tool ?? gitDir, 'libexec', 'git-core'),
  };
  if (!tool) {
    env.GIT_TEMPLATE_DIR = join(gitDir, 'share', 'git-core', 'templates');
    const ca = join(gitDir, 'ssl', 'cacert.pem');
    if (existsSync(ca)) env.GIT_SSL_CAINFO = ca;
  }
  return env;
}

/** Process environment with the bundled Git first in a single PATH key. */
export function withGit(
  gitDir,
  base = process.env,
  platform = process.platform,
) {
  const env = {};
  let systemPath = '';
  for (const [key, value] of Object.entries(base)) {
    if (/^path$/i.test(key)) systemPath = value ?? '';
    else env[key] = value;
  }
  const sep = platform === 'win32' ? ';' : ':';
  env.PATH = [...gitPath(gitDir, platform), systemPath]
    .filter(Boolean)
    .join(sep);
  return { ...env, ...gitEnv(gitDir, platform) };
}
