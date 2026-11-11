import { existsSync, readdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { counter, type StepDetail } from './progress';
import { runPsdk, type PsdkTarget } from './psdk-process';

/**
 * What PSDK does on the first launch of a project (Studio::Accessors#__game_data)
 * when Data/Studio/psdk.dat is missing. Run alone, with --util, it opens no
 * window. In the game, it runs with the window open and not responding, and
 * Windows then offers to close ruby.exe ("has stopped responding").
 */
export const CONVERT_RB = `# PSDK Lab: converts Data/Studio to psdk.dat before the game starts.
ScriptLoader.load_tool('Studio2PSDK')
Studio2PSDK.try_convert
Studio2PSDK.cleanup
`;
const CONVERT_FILE = 'psdk_lab_convert.rb';

export function studioDataFile(gameDir: string): string {
  return join(gameDir, 'Data', 'Studio', 'psdk.dat');
}

/** Studio2PSDK prints "converting <folder>" for each folder of Data/Studio. */
function folderCount(gameDir: string): number {
  const root = join(gameDir, 'Data', 'Studio');
  if (!existsSync(root)) return 0;
  return readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).length;
}

export type ItemsProgress = (fraction: number, detail: StepDetail) => void;

/**
 * Builds Data/Studio/psdk.dat when missing (output in `logFile`). Resolves
 * with null once the file exists, else with PSDK's exit code.
 */
export async function convertStudioData(
  t: PsdkTarget,
  logFile: string,
  onProgress?: ItemsProgress,
): Promise<number | null> {
  if (existsSync(studioDataFile(t.gameDir))) return null;
  await writeFile(join(t.gameDir, CONVERT_FILE), CONVERT_RB);
  const total = Math.max(1, folderCount(t.gameDir));
  const count = counter('converting ', (n) => {
    const done = Math.min(n, total);
    // The last part (saving psdk.dat) is not announced: stop just before 1.
    onProgress?.(Math.min(0.95, done / total), { kind: 'items', done, total });
  });
  // 50_load_game_uncompiled.rb requires any --util it does not know.
  const code = await runPsdk(t, [`--util=./${CONVERT_FILE}`], logFile, count);
  if (existsSync(studioDataFile(t.gameDir))) return null;
  return code;
}
