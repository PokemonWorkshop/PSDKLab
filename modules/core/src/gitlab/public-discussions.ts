import { PSDK_PROJECT } from '../constants';
import type { Discussion } from '../providers/types';
import { errorOf, GITLAB_URL } from './client';
import { toDiscussions, type GitlabDiscussion } from './mappers';

interface WebNote {
  id: number | string;
  note?: string; // Markdown source on the web endpoint
  body?: string;
  author: {
    id: number;
    username: string;
    name: string;
    avatar_url?: string | null;
    web_url?: string;
    path?: string;
  };
  created_at: string;
  updated_at?: string;
  system: boolean;
  resolvable?: boolean;
  resolved?: boolean;
  position?: { new_path?: string; new_line?: number | null } | null;
}

const MAX_PAGES = 10;

/** Same shape as the REST API, so the same mapper applies. */
function toApiShape(raw: { id: string; notes: WebNote[] }[]): GitlabDiscussion[] {
  return raw.map((d) => ({
    id: String(d.id),
    notes: d.notes.map((n) => ({
      ...n,
      id: Number(n.id),
      body: n.note ?? n.body ?? '',
      updated_at: n.updated_at ?? n.created_at,
      author: {
        ...n.author,
        web_url:
          n.author.web_url ??
          `${GITLAB_URL}${n.author.path ?? `/${n.author.username}`}`,
      },
    })),
  }));
}

/** MR threads without an account, from the JSON the MR page loads. */
export async function listPublicDiscussions(
  iid: number,
  fetchFn: typeof fetch = fetch,
  project: string = PSDK_PROJECT,
): Promise<Discussion[]> {
  const base = `${GITLAB_URL}/${project}/-/merge_requests/${iid}/discussions.json`;
  const all: { id: string; notes: WebNote[] }[] = [];
  let cursor: string | null = '';
  for (let i = 0; i < MAX_PAGES && cursor !== null; i++) {
    const url: string = cursor
      ? `${base}?cursor=${encodeURIComponent(cursor)}`
      : base;
    const res: Response = await fetchFn(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw errorOf(res);
    const page = (await res.json()) as unknown;
    if (!Array.isArray(page)) throw new Error('Unexpected discussions answer.');
    all.push(...(page as { id: string; notes: WebNote[] }[]));
    cursor = res.headers.get('x-next-page-cursor') || null;
  }
  return toDiscussions(toApiShape(all));
}
