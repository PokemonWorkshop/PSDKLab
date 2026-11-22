import { describe, expect, it } from 'vitest';
import { listDiscussions, replyToDiscussion } from './discussions';

const author = { id: 1, username: 'ota', name: 'Ota', web_url: 'https://gitlab.com/ota' };
const note = (id: number, extra: object = {}) => ({
  id,
  body: `note ${id}`,
  author,
  created_at: '2026-11-01T10:00:00Z',
  updated_at: '2026-11-01T10:00:00Z',
  system: false,
  ...extra,
});

describe('GitLab discussions', () => {
  it('reads every page and keeps people’s comments only', async () => {
    const urls: string[] = [];
    const pages: Record<string, object[]> = {
      '1': [
        { id: 'a', notes: [note(1, { system: true, body: 'added 1 commit' })] },
        { id: 'b', notes: [note(2, { resolvable: true, resolved: true, position: { new_path: 'scripts/a.rb', new_line: 12 } })] },
      ],
      '2': [{ id: 'c', notes: [note(3), note(4)] }],
    };
    const fetchFn = (async (url: string, init?: RequestInit) => {
      urls.push(url);
      expect(new Headers(init?.headers).get('authorization')).toBeNull();
      const page = new URL(url).searchParams.get('page')!;
      return new Response(JSON.stringify(pages[page]), {
        headers: { 'x-next-page': page === '1' ? '2' : '' },
      });
    }) as typeof fetch;

    const list = await listDiscussions(42, { fetchFn });
    expect(urls[0]).toContain('/projects/pokemonsdk%2Fpokemonsdk/merge_requests/42/discussions');
    expect(list.map((d) => d.id)).toEqual(['b', 'c']);
    expect(list[0]).toMatchObject({ resolvable: true, resolved: true });
    expect(list[0].notes[0].onCode).toEqual({ path: 'scripts/a.rb', line: 12 });
    expect(list[1].notes.map((n) => n.body)).toEqual(['note 3', 'note 4']);
  });

  it('replies with the account token', async () => {
    let seen: { url: string; auth: string | null; body: string } | null = null;
    const fetchFn = (async (url: string, init?: RequestInit) => {
      seen = { url, auth: new Headers(init?.headers).get('authorization'), body: String(init?.body) };
      return new Response('{}', { status: 201 });
    }) as typeof fetch;
    await replyToDiscussion(42, 'abc', 'Tested on Linux ✅', { token: 'T', fetchFn });
    expect(seen).toEqual({
      url: 'https://gitlab.com/api/v4/projects/pokemonsdk%2Fpokemonsdk/merge_requests/42/discussions/abc/notes',
      auth: 'Bearer T',
      body: JSON.stringify({ body: 'Tested on Linux ✅' }),
    });
  });
});
