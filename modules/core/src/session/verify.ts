import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { psdkRuby } from '../releases/ruby';

/** First file of `dir` matching `pattern`, else `fallback` (reported as missing). */
function findIn(dir: string, pattern: RegExp, fallback: string): string {
  const name = existsSync(dir)
    ? readdirSync(dir).find((f) => pattern.test(f))
    : undefined;
  return join(dir, name ?? fallback);
}

/**
 * The Ruby DLL ruby.exe loads (Windows). Checked here because when it is
 * missing Windows could load it from another Ruby found on PATH.
 * TODO Linux: check ruby-dist/lib/libruby.so* once confirmed in Linux.7z.
 */
export function rubyLibraries(
  binariesDir: string,
  platform = process.platform,
): string[] {
  return platform === 'win32'
    ? [
        findIn(
          binariesDir,
          /^(x64-)?(msvcrt|ucrt)-ruby\d+\.dll$/,
          'msvcrt-ruby300.dll',
        ),
      ]
    : [];
}

/**
 * Files a session needs to be playable. "Ready" is only reported when all of
 * them exist (and the lock with the prepared versions is written).
 */
export function requiredFiles(
  gameDir: string,
  binariesDir: string,
  platform = process.platform,
): string[] {
  const libDir =
    platform === 'win32'
      ? join(binariesDir, 'lib')
      : join(binariesDir, 'ruby-dist', 'lib');
  return [
    join(gameDir, 'project.studio'), // the demo
    join(gameDir, 'Game.rb'), // entry point
    join(gameDir, 'pokemonsdk', '.git'), // MR code, switched by psdk-use
    join(gameDir, 'pokemonsdk', 'version.txt'),
    join(gameDir, 'pokemonsdk', 'scripts', 'ScriptLoad.rb'),
    join(gameDir, 'Data', 'System.rxdata'), // rebuilt by --util=restore
    join(gameDir, 'Data', 'MapInfos.rxdata'),
    psdkRuby(binariesDir, platform).bin, // PSDK binaries
    ...rubyLibraries(binariesDir, platform),
    join(libDir, 'LiteRGSS.so'),
  ];
}

/** Required files that are missing (empty when the session is playable). */
export function missingFiles(
  gameDir: string,
  binariesDir: string,
  platform = process.platform,
): string[] {
  return requiredFiles(gameDir, binariesDir, platform).filter(
    (f) => !existsSync(f),
  );
}
