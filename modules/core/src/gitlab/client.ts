/** gitlab.com: the instance of the PSDK preset. */
export const GITLAB_URL = 'https://gitlab.com';
export const GITLAB_API = `${GITLAB_URL}/api/v4`;

/** HTTP error from GitLab, `retryAfterSec` is set on 429 (rate limit). */
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
export function retryAfter(headers: Headers, now = Date.now()): number | null {
  const after = Number(headers.get('retry-after'));
  if (after > 0) return after;
  const reset = Number(headers.get('ratelimit-reset'));
  if (reset > 0) return Math.max(1, Math.ceil(reset - now / 1000));
  return null;
}

export const errorOf = (res: Response) =>
  new GitlabError(
    res.status,
    res.status === 429 ? retryAfter(res.headers) : null,
  );

export interface GitlabRequest {
  /** OAuth access token, anonymous when absent. */
  token?: string | null;
  method?: 'GET' | 'POST';
  body?: Record<string, unknown>;
  fetchFn?: typeof fetch;
}

/** One call to the REST API (path after /api/v4). */
export async function gitlabJson<T>(
  path: string,
  req: GitlabRequest = {},
): Promise<{ data: T; headers: Headers }> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (req.token) headers.Authorization = `Bearer ${req.token}`;
  if (req.body) headers['Content-Type'] = 'application/json';
  const res = await (req.fetchFn ?? fetch)(`${GITLAB_API}${path}`, {
    method: req.method ?? 'GET',
    headers,
    body: req.body ? JSON.stringify(req.body) : undefined,
  });
  if (!res.ok) throw errorOf(res);
  return { data: (await res.json()) as T, headers: res.headers };
}

/** /projects/<id or url-encoded path> */
export const projectPath = (project: string) =>
  `/projects/${encodeURIComponent(project)}`;
