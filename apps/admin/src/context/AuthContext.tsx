import { createContext, useContext, useState, type ReactNode } from 'react';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

function parseJwt(token: string): JwtPayload | null {
  try {
    const part = token.split('.')[1];
    return JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))) as JwtPayload;
  } catch {
    return null;
  }
}

interface AuthState {
  accessToken: string | null;
  role: string | null;
  isAuthenticated: boolean;
  login: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(() =>
    localStorage.getItem('accessToken'),
  );

  const role = accessToken ? (parseJwt(accessToken)?.role ?? null) : null;

  function login(at: string, rt: string) {
    localStorage.setItem('accessToken', at);
    localStorage.setItem('refreshToken', rt);
    setAccessToken(at);
  }

  function logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setAccessToken(null);
  }

  return (
    <AuthContext.Provider
      value={{ accessToken, role, isAuthenticated: !!accessToken, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
