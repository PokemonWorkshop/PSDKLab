import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { MrCache } from './cache';
import { toMergeRequests } from './index';

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
    expect(second.staleReason).toEqual({ kind: 'rate-limit', retryInSec: 30 });
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

  it('asks GitLab again when the saved list is in an older format', async () => {
    const path = file();
    writeFileSync(path, JSON.stringify({ mrs: [{ iid: 9 }], fetchedAt: new Date().toISOString(), stale: false }));
    const f = fakeFetch([ok()]);
    const list = await new MrCache(path, 60_000, f.fn).get();
    expect(f.calls()).toBe(1);
    expect(list.mrs[0]).toMatchObject({ iid: 1, labels: [], description: '' });
  });
});

describe('toMergeRequests', () => {
  it('keeps labels and description, and leaves Draft MRs out', () => {
    const mrs = toMergeRequests([
      { ...mr, iid: 1, labels: ['Need to be tested'], description: '1. Run' },
      { ...mr, iid: 2, draft: true },
      { ...mr, iid: 3, work_in_progress: true },
      { ...mr, iid: 4, description: null },
    ]);
    expect(mrs.map((m) => m.iid)).toEqual([1, 4]);
    expect(mrs[0]).toMatchObject({ labels: ['Need to be tested'], description: '1. Run' });
    expect(mrs[1]).toMatchObject({ labels: [], description: '' });
  });
});
