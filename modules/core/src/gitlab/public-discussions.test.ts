import { describe, expect, it } from 'vitest';
import { listPublicDiscussions } from './public-discussions';

describe('public discussions (no account)', () => {
  it('reads the MR page JSON and maps it like the API', async () => {
    const urls: string[] = [];
    const fetchFn = (async (url: string) => {
      urls.push(url);
      const first = !url.includes('cursor=');
      const body = first
        ? [{ id: 'a', notes: [{ id: 1, note: 'Tested ✅', author: { id: 3, username: 'pal', name: 'Pal', path: '/pal', avatar_url: null }, created_at: '2026-11-01T10:00:00Z', system: false }] }]
        : [{ id: 'b', notes: [{ id: 2, note: 'merged', author: { id: 3, username: 'pal', name: 'Pal' }, created_at: '2026-11-02T10:00:00Z', system: true }] }];
      return new Response(JSON.stringify(body), { headers: first ? { 'x-next-page-cursor': 'c2' } : {} });
    }) as typeof fetch;
    const list = await listPublicDiscussions(42, fetchFn);
    expect(urls).toEqual([
      'https://gitlab.com/pokemonsdk/pokemonsdk/-/merge_requests/42/discussions.json',
      'https://gitlab.com/pokemonsdk/pokemonsdk/-/merge_requests/42/discussions.json?cursor=c2',
    ]);
    expect(list).toHaveLength(1);
    expect(list[0].notes[0]).toMatchObject({ body: 'Tested ✅', author: { username: 'pal', webUrl: 'https://gitlab.com/pal' } });
  });
});
