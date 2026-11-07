import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import type { PsdkRuby } from '../releases/ruby';
import { buildEnv } from '../runtimes/env';
import { psdkUseScript, rubyLoadArgs, type Runtimes } from '../runtimes/layout';

const exec = promisify(execFile);

export interface RunOptions {
  cwd: string; // sessions/<id>/game (contains project.studio)
  onLog?: (line: string) => void;
}

/**
 * Runs `psdk-use mr <id>` with the PSDK Ruby. psdk-cli and thor are loaded
 * with `-I` (no RubyGems install). Only the exit code is read: psdk-cli's
 * text output is not a stable interface.
 */
export function runPsdkUseMr(
  rt: Runtimes,
  ruby: PsdkRuby,
  mrIid: number,
  opts: RunOptions,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const args = [...rubyLoadArgs(rt), psdkUseScript(rt), 'mr', String(mrIid)];
    const child = spawn(ruby.bin, args, {
      cwd: opts.cwd,
      env: buildEnv(rt, ruby),
      windowsHide: true,
    });
    const forward = (chunk: Buffer) => opts.onLog?.(chunk.toString());
    child.stdout.on('data', forward);
    child.stderr.on('data', forward);
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });
}

/** Loads thor and psdk-cli with the PSDK Ruby; returns both versions. */
export async function checkPsdkCli(
  rt: Runtimes,
  ruby: PsdkRuby,
): Promise<{ ruby: string; psdkCli: string }> {
  const code =
    "require 'thor'; require 'psdk/cli/version'; print RUBY_VERSION, ' ', Psdk::Cli::VERSION";
  const { stdout } = await exec(ruby.bin, [...rubyLoadArgs(rt), '-e', code], {
    env: buildEnv(rt, ruby),
    timeout: 20000,
    windowsHide: true,
  });
  const [rubyVersion = '', psdkCli = ''] = stdout.trim().split(' ');
  return { ruby: rubyVersion, psdkCli };
}
