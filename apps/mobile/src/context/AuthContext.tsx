import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { usePostHog } from 'posthog-react-native';
import { getTokens, setTokens, clearTokens } from '../lib/storage';
import { registerClearAuth } from '../lib/authCallbacks';
import type { AuthTokens } from '@manamap/shared';

declare const atob: (data: string) => string;

function decodeJwtSub(accessToken: string): string | null {
  try {
    const payload = accessToken.split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    return (JSON.parse(json) as { sub?: string }).sub ?? null;
  } catch {
    return null;
  }
}

interface AuthState {
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (tokens: AuthTokens) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const posthog = usePostHog();
  const [state, setState] = useState<AuthState>({
    accessToken: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    getTokens().then((tokens) => {
      setState({
        accessToken: tokens?.accessToken ?? null,
        isAuthenticated: !!tokens?.accessToken,
        isLoading: false,
      });
      if (tokens?.accessToken) {
        const sub = decodeJwtSub(tokens.accessToken);
        if (sub) posthog.identify(sub);
      }
    });
  }, [posthog]);

  const signIn = useCallback(
    async (tokens: AuthTokens) => {
      await setTokens(tokens);
      setState({ accessToken: tokens.accessToken, isAuthenticated: true, isLoading: false });
      const sub = decodeJwtSub(tokens.accessToken);
      if (sub) posthog.identify(sub);
    },
    [posthog],
  );

  const signOut = useCallback(async () => {
    await clearTokens();
    setState({ accessToken: null, isAuthenticated: false, isLoading: false });
    posthog.reset();
  }, [posthog]);

  useEffect(() => {
    registerClearAuth(signOut);
    return () => {
      registerClearAuth(async () => {});
    };
  }, [signOut]);

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
