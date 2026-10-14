import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  login: (username: string, token: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const DEFAULT_USER: User = {
  username: 'analyst',
  token: localStorage.getItem('token') || '',
};

const AuthContext = createContext<AuthContextType>({
  user: DEFAULT_USER,
  login: () => {},
  logout: () => {},
  isAuthenticated: true,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User>(() => {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username') || 'analyst';
    return { username, token: token || '' };
  });

  useEffect(() => {
    // Ensure token exists on mount
    const token = localStorage.getItem('token');
    if (!token) {
      // Trigger background login to retrieve token
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'analyst', password: 'password123' }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data?.access_token) {
            localStorage.setItem('token', data.access_token);
            localStorage.setItem('username', 'analyst');
            setUser({ username: 'analyst', token: data.access_token });
          }
        })
        .catch(() => {});
    }
  }, []);

  const login = (username: string, token: string) => {
    localStorage.setItem('token', token);
    localStorage.setItem('username', username);
    setUser({ username, token });
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setUser({ username: 'analyst', token: '' });
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: true }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
