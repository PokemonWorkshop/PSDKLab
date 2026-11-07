import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MrCache } from './cache';

const mr = {
  iid: 1,
  title: 'Fix',
  author: { username: 'a' },
  source_branch: 'b',
  sha: 'abc1234',
  web_url: 'u',
  updated_at: 'd',
};

function fakeFetch(responses: Response[]) {
  let calls = 0;
  const fn = (async () =>
    responses[
      Math.min(calls++, responses.length - 1)
    ]) as unknown as typeof fetch;
  return { fn, calls: () => calls };
}

const ok = () => new Response(JSON.stringify([mr]), { status: 200 });
const limited = (retry = '30') =>
  new Response('', { status: 429, headers: { 'retry-after': retry } });
const file = () => join(mkdtempSync(join(tmpdir(), 'mrs-')), 'mrs.json');

describe('MrCache', () => {
  it('serves the list from cache while it is fresh, and merges concurrent calls', async () => {
    const f = fakeFetch([ok()]);
    const cache = new MrCache(file(), 60_000, f.fn);
    const [a, b] = await Promise.all([cache.get(), cache.get()]);
    await cache.get();
    expect(a.mrs[0].iid).toBe(1);
    expect(b).toBe(a);
    expect(f.calls()).toBe(1);
  });

  it('falls back to the last list on HTTP 429 and waits before asking again', async () => {
    let now = 0;
    const f = fakeFetch([ok(), limited('30')]);
    const cache = new MrCache(file(), 1000, f.fn, () => now);
    await cache.get();
    now = 5000;
    const second = await cache.get();
    expect(second.stale).toBe(true);
    expect(second.notice).toContain('30 s');
    now = 10_000;
    await cache.get();
    expect(f.calls()).toBe(2); // still blocked: GitLab not asked again
  });

  it('explains the rate limit when there is no list yet', async () => {
    const cache = new MrCache(file(), 1000, fakeFetch([limited('12')]).fn);
    await expect(cache.get()).rejects.toThrow('12 s');
  });

  it('reuses the list saved on disk by a previous run', async () => {
    const path = file();
    await new MrCache(path, 60_000, fakeFetch([ok()]).fn).get();
    const f = fakeFetch([limited()]);
    const list = await new MrCache(path, 60_000, f.fn).get();
    expect(list.mrs).toHaveLength(1);
    expect(f.calls()).toBe(0);
  });
});
