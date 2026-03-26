import { createContext, useContext, useState, useEffect } from 'react';
import { AuthAPI } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(() => JSON.parse(localStorage.getItem('ss_user') || 'null'));
  const [loading, setLoading] = useState(false);

  // Always fetch fresh user data from DB on mount
  // This ensures role changes (e.g. collector → artist) are picked up immediately
  useEffect(() => {
    const token = localStorage.getItem('ss_token');
    if (!token) return;
    AuthAPI.getMe()
      .then(data => {
        if (data?.user) {
          setUser(data.user);
          localStorage.setItem('ss_user', JSON.stringify(data.user));
        }
      })
      .catch(() => {}); // silently fail if backend is down
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const data = await AuthAPI.login(email, password);
      setUser(data.user);
      return data;
    } finally {
      setLoading(false);
    }
  };

  const register = async (name, email, password) => {
    setLoading(true);
    try {
      const data = await AuthAPI.register(name, email, password);
      setUser(data.user);
      return data;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    AuthAPI.logout();
    setUser(null);
  };

  const updateUser = (updates) => {
    const updated = { ...user, ...updates };
    setUser(updated);
    localStorage.setItem('ss_user', JSON.stringify(updated));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
