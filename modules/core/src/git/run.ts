import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { buildEnv } from '../runtimes/env';
import { gitBin, type Runtimes } from '../runtimes/layout';

const exec = promisify(execFile);

/** Runs the bundled Git (never the one installed on the machine). */
export async function git(
  rt: Runtimes,
  cwd: string,
  ...args: string[]
): Promise<string> {
  const { stdout } = await exec(gitBin(rt), args, {
    cwd,
    env: buildEnv(rt),
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout.trim();
}

export function headCommit(rt: Runtimes, repoDir: string): Promise<string> {
  return git(rt, repoDir, 'rev-parse', 'HEAD');
}
