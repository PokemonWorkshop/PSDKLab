import { join } from 'node:path';

export type ReleaseKind = 'demo' | 'binaries';

/** <userData>/cache/<kind>/<version>/ */
export function releaseCacheDir(
  cacheRoot: string,
  kind: ReleaseKind,
  version: string,
): string {
  return join(cacheRoot, kind, version);
}
