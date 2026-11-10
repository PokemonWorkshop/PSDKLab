import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// Build-time copy used by runtimes/prepare.mjs: both must stay identical.
import * as atBuild from '../../../../runtimes/lib/env.mjs';
import { psdkRuby } from '../releases/ruby';
import { buildEnv, gitEnv, gitPath } from './env';
import { gitBin, rubyLoadArgs, runtimesAt } from './layout';

const rt = runtimesAt('/app/runtimes', '/data/psdk-cli');
const base = {
  Path: '/usr/bin',
  HOME: '/home/u',
  GEM_HOME: '/home/u/.gem',
  RUBYOPT: '-rbundler/setup',
  RUBYLIB: '/x',
  BUNDLE_GEMFILE: '/proj/Gemfile',
};

describe('buildEnv', () => {
  for (const platform of ['win32', 'linux'] as const) {
    it(`drops the machine's Ruby setup (${platform})`, () => {
      const env = buildEnv(rt, null, base, platform);
      expect(env.PSDK_CLI_DIR).toBe('/data/psdk-cli');
      expect(env.GEM_HOME).toBeUndefined();
      expect(env.RUBYOPT).toBeUndefined();
      expect(env.RUBYLIB).toBeUndefined();
      expect(env.BUNDLE_GEMFILE).toBeUndefined();
      expect(env.HOME).toBe('/home/u');
    });

    it(`puts the PSDK Ruby, then Git, first in a single PATH key (${platform})`, () => {
      const ruby = psdkRuby('/cache/binaries/1.1.1', platform);
      const env = buildEnv(rt, ruby, base, platform);
      expect(Object.keys(env).filter((k) => /^path$/i.test(k))).toEqual([
        'PATH',
      ]);
      const parts = env.PATH!.split(platform === 'win32' ? ';' : ':');
      expect(parts[0]).toBe(ruby.path[0]);
      expect(parts[1]).toBe(gitPath(rt.gitDir, platform)[0]);
      expect(parts.at(-1)).toBe('/usr/bin');
    });

    it(`matches the build-time Git environment (${platform})`, () => {
      expect(atBuild.gitEnv(rt.gitDir, platform)).toEqual(
        gitEnv(rt.gitDir, platform),
      );
      expect(atBuild.gitPath(rt.gitDir, platform)).toEqual(
        gitPath(rt.gitDir, platform),
      );
    });
  }

  it('uses the Linux PSDK Ruby setup (ruby-dist/setup.sh)', () => {
    const env = buildEnv(rt, psdkRuby('/b', 'linux'), base, 'linux');
    expect(env.RUBYOPT).toBe('--encoding utf-8:utf-8 -rclean_load_path');
    expect(env.RUBYLIB).toContain(join('/b', 'ruby-dist', 'lib', 'ruby'));
    expect(env.LD_LIBRARY_PATH).toContain(join('/b', 'ruby-dist', 'lib'));
  });

  it('points to the bundled files', () => {
    expect(gitBin(rt, 'win32')).toBe(
      join('/app/runtimes', 'git', 'cmd', 'git.exe'),
    );
    expect(rubyLoadArgs(rt)).toEqual([
      '-I',
      join('/app/runtimes', 'thor', 'lib'),
      '-I',
      join('/app/runtimes', 'psdk-cli', 'lib'),
    ]);
    expect(psdkRuby('/b', 'win32').bin).toBe(join('/b', 'ruby.exe'));
  });
});
