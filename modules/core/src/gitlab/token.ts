import type { ProviderUser } from '../providers/types';
import { GitlabError, gitlabJson } from './client';
import { currentUser } from './discussions';

/** What a personal access token gives access to. */
export interface TokenInfo {
  user: ProviderUser;
  scopes: string[];
  expiresAt: number; // epoch ms, far future when it never expires
}

const NEVER = 8.64e15; // largest Date: no expiry date

/** Checks a pasted token: valid, and at least read_api. */
export async function inspectToken(
  token: string,
  fetchFn: typeof fetch = fetch,
): Promise<TokenInfo> {
  type Self = { scopes: string[]; expires_at: string | null; active: boolean };
  let self: Self;
  try {
    ({ data: self } = await gitlabJson<Self>('/personal_access_tokens/self', {
      token,
      fetchFn,
    }));
  } catch (err) {
    if (err instanceof GitlabError && [401, 403].includes(err.status))
      throw new Error('invalid-token', { cause: err });
    throw err;
  }
  if (!self.active) throw new Error('invalid-token');
  if (!self.scopes.some((s) => s === 'api' || s === 'read_api'))
    throw new Error('token-scope');
  const user = await currentUser({ token, fetchFn });
  // GitLab gives the last valid day: the token works until its end (UTC).
  const expiresAt = self.expires_at
    ? Date.parse(`${self.expires_at}T23:59:59Z`)
    : NEVER;
  return { user, scopes: self.scopes, expiresAt };
}

/** Comments and replies need the api scope. */
export const canWrite = (scope: string) => scope.split(/[\s,]+/).includes('api');
