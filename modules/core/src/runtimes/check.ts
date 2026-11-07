import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { buildEnv } from './env';
import { gitBin, psdkUseScript, type Runtimes } from './layout';

const run = promisify(execFile);

export interface RuntimeStatus {
  ok: boolean;
  git?: string;
  psdkCli?: string;
  thor?: string;
  /** Missing files or failed commands, in plain words. */
  problems: string[];
}

/** VERSION constant of a Ruby file, read as text (no Ruby needed). */
function rubyVersion(file: string): string | undefined {
  if (!existsSync(file)) return undefined;
  return /VERSION\s*=\s*['"]([^'"]+)['"]/.exec(readFileSync(file, 'utf8'))?.[1];
}

/**
 * Checks what the app bundles: Git answers, psdk-cli and thor sources are
 * there, 7za is there. Ruby comes later, with the PSDK binaries.
 */
export async function checkRuntimes(rt: Runtimes): Promise<RuntimeStatus> {
  const problems: string[] = [];
  const files = {
    Git: gitBin(rt),
    'psdk-use': psdkUseScript(rt),
    '7za': rt.sevenZip,
  };
  for (const [name, file] of Object.entries(files)) {
    if (!existsSync(file)) problems.push(`${name} not found: ${file}`);
  }
  const status: RuntimeStatus = {
    ok: false,
    problems,
    psdkCli: rubyVersion(
      join(rt.psdkCliDir, 'lib', 'psdk', 'cli', 'version.rb'),
    ),
    thor: rubyVersion(join(rt.thorDir, 'lib', 'thor', 'version.rb')),
  };
  if (!status.psdkCli) problems.push('psdk-cli gem incomplete');
  if (!status.thor) problems.push('thor gem incomplete');
  if (existsSync(gitBin(rt))) {
    try {
      const { stdout } = await run(gitBin(rt), ['--version'], {
        env: buildEnv(rt),
        timeout: 15000,
        windowsHide: true,
      });
      status.git = stdout.trim();
    } catch (err) {
      problems.push(`git: ${(err as Error).message.split('\n')[0]}`);
    }
  }
  status.ok = problems.length === 0;
  return status;
}
