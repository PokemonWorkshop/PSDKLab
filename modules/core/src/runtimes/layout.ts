import { join } from 'node:path';

/**
 * What the app bundles (runtimes/dist in dev, <resources>/runtimes once packaged).
 * No Ruby: psdk-cli runs with the Ruby shipped in the PSDK binaries.
 */
export interface Runtimes {
  gitDir: string; // <root>/git
  psdkCliDir: string; // <root>/psdk-cli (lib/ + exe/)
  thorDir: string; // <root>/thor (lib/)
  sevenZip: string; // <root>/7z/7za(.exe), extracts the PSDK binaries
  psdkCliHome: string; // <userData>/psdk-cli (PSDK_CLI_DIR)
}

export function runtimesAt(
  root: string,
  psdkCliHome: string,
  platform = process.platform,
): Runtimes {
  return {
    gitDir: join(root, 'git'),
    psdkCliDir: join(root, 'psdk-cli'),
    thorDir: join(root, 'thor'),
    sevenZip: join(root, '7z', platform === 'win32' ? '7za.exe' : '7za'),
    psdkCliHome,
  };
}

export function gitBin(rt: Runtimes, platform = process.platform): string {
  return platform === 'win32'
    ? join(rt.gitDir, 'cmd', 'git.exe')
    : join(rt.gitDir, 'bin', 'git');
}

export function psdkUseScript(rt: Runtimes): string {
  return join(rt.psdkCliDir, 'exe', 'psdk-use');
}

/** `ruby -I` arguments that make thor and psdk-cli loadable without RubyGems. */
export function rubyLoadArgs(rt: Runtimes): string[] {
  return ['-I', join(rt.thorDir, 'lib'), '-I', join(rt.psdkCliDir, 'lib')];
}
