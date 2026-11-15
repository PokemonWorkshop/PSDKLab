import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { psdkRuby } from './ruby';

describe('MacOS archive Ruby', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  function archive(version: string, arch: string) {
    const dir = mkdtempSync(join(tmpdir(), 'psdk lab é '));
    dirs.push(dir);
    mkdirSync(join(dir, 'ruby-dist', 'lib', 'ruby', version, arch), { recursive: true });
    return dir;
  }

  it('reproduces the setup.sh shipped in MacOS.7z 1.1.1', () => {
    const dir = archive('3.2.0', 'arm64-darwin23');
    const root = join(dir, 'ruby-dist');
    const lib = join(root, 'lib');
    expect(psdkRuby(dir, 'darwin')).toEqual({
      bin: join(root, 'bin', 'ruby'),
      path: [join(root, 'bin')],
      env: {
        DYLD_LIBRARY_PATH: lib,
        LD_LIBRARY_PATH: [join(root, 'bin'), lib, join(root, 'openssl', 'lib')].join(':'),
        RUBYLIB: [
          'site_ruby/3.2.0',
          'site_ruby/3.2.0/arm64-darwin23',
          'site_ruby',
          'vendor_ruby/3.2.0',
          'vendor_ruby/3.2.0/arm64-darwin23',
          'vendor_ruby',
          '3.2.0',
          '3.2.0/arm64-darwin23',
        ].map((p) => join(lib, 'ruby', p)).join(':'),
        RUBYOPT: '--encoding utf-8:utf-8 -rclean_load_path',
      },
    });
  });

  it('discovers the archive ABI instead of using the host architecture or OS version', () => {
    const dir = archive('3.4.0', 'x86_64-darwin24');
    const paths = psdkRuby(dir, 'darwin').env.RUBYLIB.split(':');
    expect(paths.at(-1)).toBe(join(dir, 'ruby-dist', 'lib', 'ruby', '3.4.0', 'x86_64-darwin24'));
    expect(paths.some((p) => p.includes('arm64-darwin23'))).toBe(false);
  });
});
