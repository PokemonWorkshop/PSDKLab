export interface MergeRequest {
  iid: number;
  title: string;
  author: string;
  sourceBranch: string;
  sha: string;
  webUrl: string;
  updatedAt: string;
  labels: string[];
  description: string; // Markdown written by the author (test instructions…)
}

interface GitlabMr {
  iid: number;
  title: string;
  author: { username: string };
  source_branch: string;
  sha: string;
  web_url: string;
  updated_at: string;
  labels?: string[];
  description?: string | null;
  draft?: boolean;
  work_in_progress?: boolean; // older name of draft
}

const API = 'https://gitlab.com/api/v4';
import { PSDK_PROJECT } from '../constants';
export { PSDK_PROJECT, TEST_LABEL } from '../constants';

/** Open MRs without the Draft ones (not ready to be tested). */
export function toMergeRequests(raw: GitlabMr[]): MergeRequest[] {
  return raw
    .filter((mr) => !(mr.draft ?? mr.work_in_progress ?? false))
    .map((mr) => ({
      iid: mr.iid,
      title: mr.title,
      author: mr.author.username,
      sourceBranch: mr.source_branch,
      sha: mr.sha,
      webUrl: mr.web_url,
      updatedAt: mr.updated_at,
      labels: mr.labels ?? [],
      description: mr.description ?? '',
    }));
}

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
  return toMergeRequests((await res.json()) as GitlabMr[]);
}
