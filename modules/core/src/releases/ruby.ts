import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** The Ruby shipped in the PSDK binaries, with what it needs to run. */
export interface PsdkRuby {
  bin: string;
  path: string[];
  env: Record<string, string>;
}

/** Windows.7z: ruby.exe, its DLLs and lib/ sit at the root (Ruby 3.0). */
function windowsRuby(dir: string): PsdkRuby {
  return { bin: join(dir, 'ruby.exe'), path: [dir], env: {} };
}

/**
 * Linux.7z: everything is under ruby-dist/ (Ruby 3.3). The variables below
 * reproduce ruby-dist/setup.sh, with absolute paths instead of $(pwd).
 */
function linuxRuby(dir: string): PsdkRuby {
  const root = join(dir, 'ruby-dist');
  const rubyLib = join(root, 'lib', 'ruby');
  const version = existsSync(rubyLib)
    ? readdirSync(rubyLib).find((d) => /^\d+\.\d+\.\d+$/.test(d))
    : undefined;
  const v = version ?? '3.3.0';
  const arch = 'x86_64-linux';
  const lib = (...p: string[]) => join(rubyLib, ...p);
  return {
    bin: join(root, 'bin', 'ruby'),
    path: [join(root, 'bin')],
    env: {
      LD_LIBRARY_PATH: [join(root, 'bin'), join(root, 'lib')].join(':'),
      RUBYLIB: [
        lib('site_ruby', v),
        lib('site_ruby', v, arch),
        lib('site_ruby'),
        lib('vendor_ruby', v),
        lib('vendor_ruby', v, arch),
        lib('vendor_ruby'),
        lib(v),
        lib(v, arch),
      ].join(':'),
      RUBYOPT: '--encoding utf-8:utf-8 -rclean_load_path',
    },
  };
}

/** Ruby of the PSDK binaries extracted in `dir` (cache/binaries/<version>). */
export function psdkRuby(dir: string, platform = process.platform): PsdkRuby {
  return platform === 'win32' ? windowsRuby(dir) : linuxRuby(dir);
}
