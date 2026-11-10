import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Game.rb, as shipped by Pokémon Studio in resources/psdk-binaries/Game.rb.
 * It boots PSDK from ./pokemonsdk first (the clone switched to the MR by
 * psdk-use), then from $PSDK_BINARY_PATH/pokemonsdk.
 */
export const GAME_RB = `if ARGV.first == 'gem'
  require './lib/__gem.rb'
elsif ARGV.first == 'bundle'
  require './lib/__bundle.rb'
else
  psdk_path =
    (Dir.exist?('pokemonsdk') && File.expand_path('pokemonsdk')) ||
    (ENV['PSDK_BINARY_PATH'] && File.join(ENV['PSDK_BINARY_PATH'].tr('\\\\', '/'), 'pokemonsdk')) ||
    ((ENV['APPDATA'] || ENV['HOME']).dup.force_encoding('UTF-8') + '/.pokemonsdk')
  require "#{psdk_path}/scripts/ScriptLoad.rb"
  ScriptLoader.load_tool('GameLoader/Z_load_uncompiled')
end
`;

/** Ruby options Studio uses to start PSDK. */
export const PSDK_RUBY_FLAGS = ['--disable=gems,rubyopt,did_you_mean'];

/** Writes the Game.rb entry point Studio would generate in the project. */
export async function writeGameRb(gameDir: string): Promise<void> {
  await writeFile(join(gameDir, 'Game.rb'), GAME_RB);
}
