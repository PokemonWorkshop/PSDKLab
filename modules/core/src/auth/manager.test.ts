import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { OAuthApp } from '../gitlab/oauth';
import { AuthManager, type StoredAuth, type TokenStore } from './manager';

const app: OAuthApp = {
  clientId: 'app-id',
  redirectUri: 'http://127.0.0.1:41917/callback',
  scopes: ['api'],
};

function memoryStore(initial: StoredAuth | null = null) {
  const store = {
    isPersistent: async () => true,
    saved: initial,
    load: async () => store.saved,
    save: async (a: StoredAuth) => void (store.saved = a),
    clear: async () => void (store.saved = null),
  };
  return store satisfies TokenStore;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

const user = { id: 7, username: 'ota', name: 'Ota', web_url: 'https://gitlab.com/ota', avatar_url: '/uploads/a.png' };

describe('AuthManager', () => {
  it('signs in with PKCE and keeps the account, never the code', async () => {
    const calls: { url: string; body: string }[] = [];
    const fetchFn = (async (url: string, init?: RequestInit) => {
      calls.push({ url, body: String(init?.body ?? '') });
      return url.endsWith('/oauth/token')
        ? json({ access_token: 'A1', refresh_token: 'R1', expires_in: 7200, scope: 'api' })
        : json(user);
    }) as typeof fetch;
    const store = memoryStore();
    const auth = new AuthManager(app, store, fetchFn, () => 1000);

    const req = auth.begin();
    const url = new URL(req.url);
    const challenge = createHash('sha256').update(req.verifier).digest('base64url');
    expect(url.searchParams.get('code_challenge')).toBe(challenge);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('scope')).toBe('api');
    expect(req.url).not.toContain(req.verifier);

    await expect(auth.complete(req, 'code', 'forged')).rejects.toThrow(/state/);
    const status = await auth.complete(req, 'code', req.state);
    expect(status.user).toMatchObject({ username: 'ota', avatarUrl: 'https://gitlab.com/uploads/a.png' });
    expect(calls[0].body).toContain(`code_verifier=${req.verifier}`);
    expect(store.saved?.tokens).toMatchObject({ accessToken: 'A1', expiresAt: 1000 + 7_200_000 });
    expect(await auth.accessToken()).toBe('A1');
  });

  it('refreshes an expired token on demand, once for concurrent calls', async () => {
    let refreshes = 0;
    const fetchFn = (async () => {
      refreshes++;
      return json({ access_token: 'A2', refresh_token: 'R2', expires_in: 7200 });
    }) as unknown as typeof fetch;
    const store = memoryStore({
      tokens: { accessToken: 'A1', refreshToken: 'R1', expiresAt: 0, scope: 'api' },
      verifier: 'v',
      user: { id: '7', username: 'ota', name: 'Ota', avatarUrl: null, webUrl: '' },
    });
    const auth = new AuthManager(app, store, fetchFn, () => 10_000);
    const [a, b] = await Promise.all([auth.accessToken(), auth.accessToken()]);
    expect([a, b]).toEqual(['A2', 'A2']);
    expect(refreshes).toBe(1);
    expect(store.saved?.tokens.refreshToken).toBe('R2');
  });

  it('signs out when GitLab refuses the refresh token', async () => {
    const fetchFn = (async () => json({ error: 'invalid_grant' }, 400)) as unknown as typeof fetch;
    const store = memoryStore({
      tokens: { accessToken: 'A1', refreshToken: 'R1', expiresAt: 0, scope: 'api' },
      verifier: 'v',
      user: { id: '7', username: 'ota', name: 'Ota', avatarUrl: null, webUrl: '' },
    });
    const auth = new AuthManager(app, store, fetchFn, () => 10_000);
    expect(await auth.accessToken()).toBeNull();
    expect(store.saved).toBeNull();
    expect((await auth.status()).user).toBeNull();
  });

  it('signs in with a personal access token and keeps it until it expires', async () => {
    const fetchFn = (async (url: string) =>
      url.endsWith('/personal_access_tokens/self')
        ? json({ scopes: ['read_api'], expires_at: '2027-01-31', active: true })
        : json(user)) as typeof fetch;
    const store = memoryStore();
    const auth = new AuthManager(null, store, fetchFn, () => 0);
    const status = await auth.signInWithToken(' glpat-x ');
    expect(status).toMatchObject({ method: 'token', canWrite: false, user: { username: 'ota' } });
    expect(store.saved?.tokens).toMatchObject({ accessToken: 'glpat-x', refreshToken: null, expiresAt: Date.parse('2027-01-31T23:59:59Z') });
    expect(await auth.accessToken()).toBe('glpat-x');
  });

  it('refuses a token that cannot read the API', async () => {
    const scopes = (s: string[]) =>
      (async () => json({ scopes: s, expires_at: null, active: true })) as unknown as typeof fetch;
    await expect(new AuthManager(null, memoryStore(), scopes(['read_user'])).signInWithToken('t')).rejects.toThrow('token-scope');
    const invalid = (async () => json({ message: '401 Unauthorized' }, 401)) as unknown as typeof fetch;
    await expect(new AuthManager(null, memoryStore(), invalid).signInWithToken('t')).rejects.toThrow('invalid-token');
  });

  it('cannot sign in without an OAuth application', async () => {
    const auth = new AuthManager(null, memoryStore());
    expect((await auth.status()).configured).toBe(false);
    expect(() => auth.begin()).toThrow(/not configured/);
  });
});
