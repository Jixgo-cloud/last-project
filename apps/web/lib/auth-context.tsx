'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { AuthUserResponse } from '@smartcareer/shared';
import { apiRequest } from './api';
import { useRouter } from 'next/navigation';

export type SessionUser = Omit<AuthUserResponse, 'token'>;

interface AuthContextType {
  user: SessionUser | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<SessionUser>;
  logout: () => void;
  setUser: React.Dispatch<React.SetStateAction<SessionUser | null>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const sessionVersion = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const version = sessionVersion.current;
    apiRequest<SessionUser>('/auth/me')
      .then(data => { if (!cancelled && version === sessionVersion.current) setUser(data); })
      .catch(() => { if (!cancelled && version === sessionVersion.current) setUser(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const login = async (email: string, pass: string) => {
    sessionVersion.current++;
    const data = await apiRequest<SessionUser>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: pass }),
    });
    setUser(data);
    return data;
  };

  const logout = async () => {
    sessionVersion.current++;
    await apiRequest('/auth/logout', { method: 'POST', body: '{}' });
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
