import { createWriteStream } from 'node:fs';
import { rename, rm } from 'node:fs/promises';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream } from 'node:stream/web';

export interface Progress {
  received: number;
  total: number; // 0 when the server does not send a size
}

/** Streams `url` to `dest` (via dest.part), reporting progress. */
export async function downloadFile(
  url: string,
  dest: string,
  onProgress?: (p: Progress) => void,
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  const res = await fetchFn(url, { redirect: 'follow' });
  if (!res.ok || !res.body)
    throw new Error(`Download failed (HTTP ${res.status}): ${url}`);
  const total = Number(res.headers.get('content-length')) || 0;
  let received = 0;
  const counter = new Transform({
    transform(chunk: Buffer, _enc, done) {
      received += chunk.length;
      onProgress?.({ received, total });
      done(null, chunk);
    },
  });
  const part = `${dest}.part`;
  try {
    await pipeline(
      Readable.fromWeb(res.body as ReadableStream),
      counter,
      createWriteStream(part),
    );
    await rename(part, dest);
  } catch (err) {
    await rm(part, { force: true });
    throw err;
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * On Windows an antivirus or the indexer briefly locks freshly extracted
 * files, so renaming the folder fails with EPERM/EBUSY: retry for a few seconds.
 */
export async function moveDir(src: string, dest: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(src, dest);
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code ?? '';
      if (attempt >= 10 || !['EPERM', 'EBUSY', 'EACCES'].includes(code))
        throw err;
      await wait(500);
    }
  }
}
