import { createHash, randomBytes } from 'node:crypto';
import type { AuthTokens } from '../providers/types';
import { errorOf, GITLAB_URL } from './client';

/** Public OAuth application (PKCE): no secret shipped with the app. */
export interface OAuthApp {
  clientId: string;
  redirectUri: string;
  scopes: string[];
}

/** `api` is needed to comment and reply, `read_api` is read-only. */
export const GITLAB_SCOPES = ['api'];

/** One sign-in attempt: the URL to open, and what is needed to finish it. */
export interface PkceRequest {
  url: string;
  state: string; // checked on the callback (CSRF)
  verifier: string; // PKCE secret of this attempt, never sent to the browser
}

const b64url = (b: Buffer) => b.toString('base64url');

export function authorizeRequest(app: OAuthApp): PkceRequest {
  const verifier = b64url(randomBytes(48));
  const challenge = b64url(createHash('sha256').update(verifier).digest());
  const state = b64url(randomBytes(16));
  const query = new URLSearchParams({
    client_id: app.clientId,
    redirect_uri: app.redirectUri,
    response_type: 'code',
    state,
    scope: app.scopes.join(' '),
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  return { url: `${GITLAB_URL}/oauth/authorize?${query}`, state, verifier };
}

interface TokenAnswer {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}

async function tokenCall(
  params: Record<string, string>,
  fetchFn: typeof fetch,
  now: number,
): Promise<AuthTokens> {
  const res = await fetchFn(`${GITLAB_URL}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams(params),
  });
  if (!res.ok) throw errorOf(res);
  const t = (await res.json()) as TokenAnswer;
  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token ?? null,
    // Local clock: GitLab's created_at can be skewed from this computer.
    expiresAt: now + (t.expires_in ?? 7200) * 1000,
    scope: t.scope ?? '',
  };
}

/** Code received on the callback → tokens. */
export function exchangeCode(
  app: OAuthApp,
  code: string,
  verifier: string,
  fetchFn: typeof fetch = fetch,
  now = Date.now(),
): Promise<AuthTokens> {
  return tokenCall(
    {
      client_id: app.clientId,
      code,
      grant_type: 'authorization_code',
      redirect_uri: app.redirectUri,
      code_verifier: verifier,
    },
    fetchFn,
    now,
  );
}

/** New tokens from the refresh token (GitLab rotates it: keep the new one). */
export function refreshTokens(
  app: OAuthApp,
  refreshToken: string,
  verifier: string,
  fetchFn: typeof fetch = fetch,
  now = Date.now(),
): Promise<AuthTokens> {
  return tokenCall(
    {
      client_id: app.clientId,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      redirect_uri: app.redirectUri,
      code_verifier: verifier,
    },
    fetchFn,
    now,
  );
}

/** Best effort: signing out works offline too. */
export async function revokeToken(
  app: OAuthApp,
  token: string,
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  try {
    await fetchFn(`${GITLAB_URL}/oauth/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: app.clientId, token }),
    });
  } catch {
    // Offline: the token expires on its own.
  }
}
