import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { psdkRuby } from '../releases/ruby';

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
