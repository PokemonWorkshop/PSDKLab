import type { AuthStatus } from '@psdk-lab/core';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ipcMessage } from './machines/workflow';

interface AuthContextValue {
  status: AuthStatus | null; // null: not read yet
  signingIn: boolean;
  error: string | null; // code from the main process (cancelled, timeout…)
  /** OAuth in the browser when configured, else the settings (which say why). */
  signIn(): void;
  signInWithToken(token: string): Promise<boolean>;
  cancel(): void;
  signOut(): void;
  settingsOpen: boolean;
  openSettings(): void;
  closeSettings(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** The GitLab account, shared by the header, the settings and the discussions. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    void window.api.auth.status().then(setStatus);
    return window.api.auth.onChange(setStatus);
  }, []);

  const run = useCallback((call: () => Promise<AuthStatus>) => {
    setError(null);
    setSigningIn(true);
    return call()
      .then((s) => {
        setStatus(s);
        return true;
      })
      .catch((e: unknown) => {
        const code = ipcMessage(e);
        if (code !== 'cancelled') setError(code);
        return false;
      })
      .finally(() => setSigningIn(false));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      signingIn,
      error,
      signIn: () => {
        if (status?.configured) void run(() => window.api.auth.signIn());
        else setSettingsOpen(true);
      },
      signInWithToken: (token) => run(() => window.api.auth.signInWithToken(token)),
      cancel: () => void window.api.auth.cancel(),
      signOut: () => {
        setError(null);
        void window.api.auth.signOut().then(setStatus);
      },
      settingsOpen,
      openSettings: () => setSettingsOpen(true),
      closeSettings: () => setSettingsOpen(false),
    }),
    [status, signingIn, error, run, settingsOpen],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth outside AuthProvider');
  return value;
}

const KNOWN = ['timeout', 'access_denied', 'invalid-token', 'token-scope'] as const;

/** Error codes of the sign-in, as i18n keys (account.error.*). */
export function authErrorKey(code: string) {
  if (code.startsWith('port-in-use')) return 'account.error.port' as const;
  if (/not configured/.test(code)) return 'account.error.not-configured' as const;
  const k = KNOWN.find((c) => c === code);
  return k ? (`account.error.${k}` as const) : ('account.error.other' as const);
}
