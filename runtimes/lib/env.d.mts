// Types for env.mjs, so the core test can import the build-time copy.
export function gitToolchainDir(
  gitDir: string,
  platform?: string,
): string | null;
export function gitPath(gitDir: string, platform?: string): string[];
export function gitEnv(
  gitDir: string,
  platform?: string,
): Record<string, string>;
export function withGit(
  gitDir: string,
  base?: Record<string, string | undefined>,
  platform?: string,
): Record<string, string | undefined>;
