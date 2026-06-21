import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useState
} from 'react';

import { type AuthPayload, type AuthUser } from '../types.js';

const TOKEN_KEY = 'game_reservations_token';
const USER_KEY = 'game_reservations_user';

interface AuthContextValue {
  isAdmin: boolean;
  logout: () => void;
  setAuth: (payload: AuthPayload) => void;
  token: null | string;
  user: AuthUser | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [token, setToken] = useState<null | string>(() =>
    localStorage.getItem(TOKEN_KEY)
  );
  const [user, setUser] = useState<AuthUser | null>(readStoredUser);

  const setAuth = useCallback((payload: AuthPayload) => {
    localStorage.setItem(TOKEN_KEY, payload.token);
    localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
    setToken(payload.token);
    setUser(payload.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ isAdmin: user?.role === 'ADMIN', logout, setAuth, token, user }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function readStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);

    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return ctx;
}
