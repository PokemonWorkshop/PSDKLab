import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Where the app keeps its data, away from personal projects and Studio:
 *
 *   <userData>/psdk-cli/             PSDK_CLI_DIR: psdk-cli config, isolated from the maker's
 *   <userData>/cache/binaries/<v>/   PSDK binaries (Ruby, LiteRGSS…)
 *   <userData>/sessions/<id>/        session.lock.json, logs/, game/
 */
export interface DataLayout {
  psdkCliDir: string;
  cacheDir: string;
  sessionsDir: string;
}

export function dataLayout(userData: string): DataLayout {
  return {
    psdkCliDir: join(userData, 'psdk-cli'),
    cacheDir: join(userData, 'cache'),
    sessionsDir: join(userData, 'sessions'),
  };
}

export async function ensureDataLayout(layout: DataLayout): Promise<void> {
  await Promise.all(
    [layout.psdkCliDir, layout.cacheDir, layout.sessionsDir].map((d) =>
      mkdir(d, { recursive: true }),
    ),
  );
}
