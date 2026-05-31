import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface AuthState {
  accessToken: string | null;
  isAuthenticated: boolean;
  login: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(
    () => localStorage.getItem('accessToken'),
  );

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
    <AuthContext.Provider value={{ accessToken, isAuthenticated: !!accessToken, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
