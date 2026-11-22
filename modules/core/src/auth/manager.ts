import { GitlabError } from '../gitlab/client';
import { currentUser } from '../gitlab/discussions';
import { canWrite, inspectToken } from '../gitlab/token';
import {
  authorizeRequest,
  exchangeCode,
  refreshTokens,
  revokeToken,
  type OAuthApp,
  type PkceRequest,
} from '../gitlab/oauth';
import type { AuthTokens, ProviderUser } from '../providers/types';

/** What is kept for a signed-in account. */
export interface StoredAuth {
  tokens: AuthTokens;
  verifier: string; // PKCE verifier of the sign-in, sent again on refresh ('' for a token)
  user: ProviderUser;
  method?: AuthMethod; // absent: OAuth (first stored format)
}

/** OAuth in the browser, or a personal access token pasted in the settings. */
export type AuthMethod = 'oauth' | 'token';

/** Where the platform keeps the account (Electron: safeStorage, encrypted). */
export interface TokenStore {
  /** false: kept in memory only, sign in again on the next start. */
  isPersistent(): Promise<boolean>;
  load(): Promise<StoredAuth | null>;
  save(auth: StoredAuth): Promise<void>;
  clear(): Promise<void>;
}

/** What the interface may know: never the tokens. */
export interface AuthStatus {
  configured: boolean; // an OAuth application ID is set (a token works without)
  user: ProviderUser | null;
  method: AuthMethod | null;
  canWrite: boolean; // the account's access allows commenting (api scope)
  persistent: boolean;
  scopes: string[]; // asked by the OAuth sign-in
}

const EXPIRY_MARGIN_MS = 60_000;

/** The tester's GitLab account. Tokens are refreshed on demand, no timer. */
export class AuthManager {
  private auth: StoredAuth | null | undefined; // undefined: not read yet
  private refreshing: Promise<string | null> | null = null;

  constructor(
    private readonly app: OAuthApp | null,
    private readonly store: TokenStore,
    private readonly fetchFn: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  async status(): Promise<AuthStatus> {
    const auth = await this.loaded();
    return {
      configured: this.app !== null,
      user: auth?.user ?? null,
      method: auth ? (auth.method ?? 'oauth') : null,
      canWrite: auth ? canWrite(auth.tokens.scope) : false,
      persistent: await this.store.isPersistent(),
      scopes: this.app?.scopes ?? [],
    };
  }

  /** A valid access token, or null when signed out (or the session ended on GitLab). */
  async accessToken(): Promise<string | null> {
    const auth = await this.loaded();
    if (!auth) return null;
    if (auth.tokens.expiresAt - EXPIRY_MARGIN_MS > this.now())
      return auth.tokens.accessToken;
    this.refreshing ??= this.refresh(auth).finally(
      () => (this.refreshing = null),
    );
    return this.refreshing;
  }

  /** First half of a sign-in: the page to open in the browser. */
  begin(): PkceRequest {
    if (!this.app) throw new Error('GitLab OAuth application not configured.');
    return authorizeRequest(this.app);
  }

  /** Second half: the code GitLab sent back to the callback. */
  async complete(
    req: PkceRequest,
    code: string,
    state: string,
  ): Promise<AuthStatus> {
    if (!this.app) throw new Error('GitLab OAuth application not configured.');
    if (state !== req.state) throw new Error('OAuth state mismatch.');
    const tokens = await exchangeCode(
      this.app,
      code,
      req.verifier,
      this.fetchFn,
      this.now(),
    );
    const user = await currentUser({
      token: tokens.accessToken,
      fetchFn: this.fetchFn,
    });
    this.auth = { tokens, verifier: req.verifier, user, method: 'oauth' };
    await this.store.save(this.auth);
    return this.status();
  }

  /** Signs in with a personal access token (no OAuth application needed). */
  async signInWithToken(token: string): Promise<AuthStatus> {
    const info = await inspectToken(token.trim(), this.fetchFn);
    this.auth = {
      tokens: {
        accessToken: token.trim(),
        refreshToken: null,
        expiresAt: info.expiresAt,
        scope: info.scopes.join(' '),
      },
      verifier: '',
      user: info.user,
      method: 'token',
    };
    await this.store.save(this.auth);
    return this.status();
  }

  /** Revokes OAuth tokens. A personal token is only forgotten here. */
  async signOut(): Promise<void> {
    const auth = await this.loaded();
    if (auth && this.app && (auth.method ?? 'oauth') === 'oauth') {
      await revokeToken(this.app, auth.tokens.accessToken, this.fetchFn);
      if (auth.tokens.refreshToken)
        await revokeToken(this.app, auth.tokens.refreshToken, this.fetchFn);
    }
    await this.forget();
  }

  /** GitLab answered 401 with our token: it was revoked or expired there. */
  async rejected(): Promise<void> {
    await this.forget();
  }

  private async refresh(auth: StoredAuth): Promise<string | null> {
    if (!auth.tokens.refreshToken || !this.app) {
      await this.forget();
      return null;
    }
    try {
      const tokens = await refreshTokens(
        this.app,
        auth.tokens.refreshToken,
        auth.verifier,
        this.fetchFn,
        this.now(),
      );
      this.auth = { ...auth, tokens };
      await this.store.save(this.auth);
      return tokens.accessToken;
    } catch (err) {
      // Refresh token refused: the account has to sign in again.
      if (err instanceof GitlabError && [400, 401].includes(err.status)) {
        await this.forget();
        return null;
      }
      throw err;
    }
  }

  private async loaded(): Promise<StoredAuth | null> {
    if (this.auth === undefined) this.auth = await this.store.load();
    return this.auth;
  }

  private async forget(): Promise<void> {
    this.auth = null;
    await this.store.clear();
  }
}
