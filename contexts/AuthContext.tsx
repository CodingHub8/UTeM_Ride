import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

export type UserRole = 'passenger' | 'driver';
export type Gender = 'Male' | 'Female' | 'Other';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  gender: Gender;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  role: UserRole;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, phone: string, gender: Gender, password: string) => Promise<void>;
  logout: () => void;
  switchRole: () => void;
  setRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>('passenger');

  const login = useCallback(async (_email: string, _password: string) => {
    // TODO: Replace with real backend auth
    setUser({
      id: '1',
      name: 'Test User',
      email: _email,
      phone: '+60123456789',
      role,
      gender: 'Male',
    });
  }, [role]);

  const register = useCallback(async (name: string, email: string, phone: string, gender: Gender, _password: string) => {
    // TODO: Replace with real backend auth
    setUser({
      id: '1',
      name,
      email,
      phone,
      role,
      gender,
    });
  }, [role]);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  const switchRole = useCallback(() => {
    setRole((prev) => {
      const newRole = prev === 'passenger' ? 'driver' : 'passenger';
      if (user) {
        setUser({ ...user, role: newRole });
      }
      return newRole;
    });
  }, [user]);

  const value = useMemo(
    () => ({ user, isAuthenticated: !!user, role, login, register, logout, switchRole, setRole }),
    [user, role, login, register, logout, switchRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
