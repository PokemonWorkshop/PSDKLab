import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { PsdkRuby } from '../releases/ruby';
import type { Runtimes } from './layout';

// gitToolchainDir, gitPath and gitEnv mirror runtimes/lib/env.mjs (build time);
// env.test.ts checks that both give the same result.

/** Git for Windows builds put their tools in ucrt64/ (recent) or mingw64/ (older). */
export function gitToolchainDir(
  gitDir: string,
  platform = process.platform,
): string | null {
  if (platform !== 'win32') return null;
  const dirs = ['ucrt64', 'mingw64'].map((d) => join(gitDir, d));
  return dirs.find((d) => existsSync(d)) ?? dirs[0];
}

export function gitPath(gitDir: string, platform = process.platform): string[] {
  const tool = gitToolchainDir(gitDir, platform);
  return tool
    ? [join(gitDir, 'cmd'), join(tool, 'bin'), join(gitDir, 'usr', 'bin')]
    : [join(gitDir, 'bin')];
}

/** Variables that make the bundled Git self-contained (no system install needed). */
export function gitEnv(
  gitDir: string,
  platform = process.platform,
): Record<string, string> {
  const tool = gitToolchainDir(gitDir, platform);
  const env: Record<string, string> = {
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

/**
 * Environment for Git and psdk-cli: the PSDK Ruby (when given) and the bundled
 * Git come first, and no Ruby, gem or Bundler setup from the machine leaks in.
 */
export function buildEnv(
  rt: Runtimes,
  ruby: PsdkRuby | null = null,
  base: NodeJS.ProcessEnv = process.env,
  platform = process.platform,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  let systemPath = '';
  for (const [key, value] of Object.entries(base)) {
    // Windows names it "Path": keeping it next to "PATH" would make the lookup ambiguous.
    if (/^path$/i.test(key)) systemPath = value ?? '';
    else if (!/^(RUBY|GEM_|BUNDLE_)/i.test(key)) env[key] = value;
  }
  const sep = platform === 'win32' ? ';' : ':';
  const path = [
    ...(ruby?.path ?? []),
    ...gitPath(rt.gitDir, platform),
    systemPath,
  ];
  return {
    ...env,
    ...gitEnv(rt.gitDir, platform),
    ...(ruby?.env ?? {}),
    PSDK_CLI_DIR: rt.psdkCliHome,
    PATH: path.filter(Boolean).join(sep),
  };
}
