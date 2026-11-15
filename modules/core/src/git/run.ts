import { execFile, spawn } from 'node:child_process';
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

/** What Git is doing, from its --progress output. */
export type GitPhase = 'receive' | 'resolve' | 'checkout';

export interface GitProgress {
  phase: GitPhase;
  fraction: number; // 0..1
}

const PHASES: [RegExp, GitPhase][] = [
  [/Receiving objects:\s+(\d+)%/, 'receive'],
  [/Resolving deltas:\s+(\d+)%/, 'resolve'],
  [/(?:Updating files|Checking out files):\s+(\d+)%/, 'checkout'],
];

/** Last progress update in a chunk of `git --progress` stderr, if any. */
export function parseGitProgress(chunk: string): GitProgress | null {
  const lines = chunk.split(/[\r\n]+/).reverse();
  for (const line of lines)
    for (const [re, phase] of PHASES) {
      const m = re.exec(line);
      if (m) return { phase, fraction: Number(m[1]) / 100 };
    }
  return null;
}

/**
 * Runs Git with `--progress` (inserted after the subcommand) and reports its
 * progress. Rejects with Git's last error lines when it fails.
 */
export function gitWithProgress(
  rt: Runtimes,
  cwd: string,
  args: string[],
  onProgress?: (p: GitProgress) => void,
): Promise<void> {
  const [command, ...rest] = args;
  return new Promise((resolve, reject) => {
    const child = spawn(gitBin(rt), [command, '--progress', ...rest], {
      cwd,
      env: buildEnv(rt),
      windowsHide: true,
    });
    let errors = '';
    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      errors = (errors + text).slice(-2000);
      const p = parseGitProgress(text);
      if (p) onProgress?.(p);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else {
        const last = errors
          .split(/[\r\n]+/)
          .filter((l) => l && !/\d+%/.test(l));
        reject(
          new Error(
            `git ${command} failed (exit ${code}): ${last.slice(-3).join(' ')}`,
          ),
        );
      }
    });
  });
}
