export interface MergeRequest {
  iid: number;
  title: string;
  author: string;
  sourceBranch: string;
  sha: string;
  webUrl: string;
  updatedAt: string;
}

interface GitlabMr {
  iid: number;
  title: string;
  author: { username: string };
  source_branch: string;
  sha: string;
  web_url: string;
  updated_at: string;
}

const API = 'https://gitlab.com/api/v4';
export const PSDK_PROJECT = 'pokemonsdk/pokemonsdk';

/** HTTP error from the GitLab API; `retryAfterSec` is set on 429 (rate limit). */
export class GitlabError extends Error {
  constructor(
    readonly status: number,
    readonly retryAfterSec: number | null,
  ) {
    super(`GitLab API: HTTP ${status}`);
    this.name = 'GitlabError';
  }
}

/** Seconds to wait, from Retry-After or RateLimit-Reset (epoch seconds). */
function retryAfter(headers: Headers, now = Date.now()): number | null {
  const after = Number(headers.get('retry-after'));
  if (after > 0) return after;
  const reset = Number(headers.get('ratelimit-reset'));
  if (reset > 0) return Math.max(1, Math.ceil(reset - now / 1000));
  return null;
}

export async function listMergeRequests(
  project: string = PSDK_PROJECT,
  fetchFn: typeof fetch = fetch,
): Promise<MergeRequest[]> {
  const url = `${API}/projects/${encodeURIComponent(project)}/merge_requests?state=opened&per_page=50`;
  const res = await fetchFn(url);
  if (!res.ok)
    throw new GitlabError(
      res.status,
      res.status === 429 ? retryAfter(res.headers) : null,
    );
  const raw = (await res.json()) as GitlabMr[];
  return raw.map((mr) => ({
    iid: mr.iid,
    title: mr.title,
    author: mr.author.username,
    sourceBranch: mr.source_branch,
    sha: mr.sha,
    webUrl: mr.web_url,
    updatedAt: mr.updated_at,
  }));
}
