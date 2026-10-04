'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthUserResponse } from '@smartcareer/shared';
import { apiRequest } from './api';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: AuthUserResponse | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<AuthUserResponse>;
  register: (data: any) => Promise<AuthUserResponse>;
  logout: () => void;
  setUser: React.Dispatch<React.SetStateAction<AuthUserResponse | null>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUserResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('smartcareer_token');
    if (token) {
      apiRequest<AuthUserResponse>('/auth/me', {}, token)
        .then((data) => {
          setUser({ ...data, token });
        })
        .catch(() => {
          localStorage.removeItem('smartcareer_token');
          setUser(null);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, pass: string) => {
    const data = await apiRequest<AuthUserResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: pass }),
    });
    localStorage.setItem('smartcareer_token', data.token);
    setUser(data);
    return data;
  };

  const register = async (formData: any) => {
    const data = await apiRequest<AuthUserResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(formData),
    });
    localStorage.setItem('smartcareer_token', data.token);
    setUser(data);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('smartcareer_token');
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, setUser }}>
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
