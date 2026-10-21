import { createContext, useContext, useState, useEffect } from 'react';
import { AuthAPI, CartAPI, readStoredArray, readStoredJSON } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(() => readStoredJSON('ss_user', null));
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  const syncGuestCart = async () => {
    const guestItems = readStoredArray('ss_cart');
    if (!guestItems.length) return;
    await Promise.allSettled(
      guestItems.map(item => CartAPI.add(Number(item.id), Number(item.qty) || 1))
    );
    localStorage.removeItem('ss_cart');
  };

  // Always fetch fresh user data from DB on mount
  // This ensures role changes (e.g. collector → artist) are picked up immediately
  useEffect(() => {
    const refreshUser = () => {
      const token = localStorage.getItem('ss_token');
      if (!token) { setUser(null); setInitializing(false); return; }
      AuthAPI.getMe()
      .then(data => {
        if (data?.user) {
          setUser(data.user);
          localStorage.setItem('ss_user', JSON.stringify(data.user));
        }
      })
      .catch(() => setUser(null))
      .finally(() => setInitializing(false));
    };
    refreshUser();
    window.addEventListener('focus', refreshUser);
    return () => window.removeEventListener('focus', refreshUser);
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const data = await AuthAPI.login(email, password);
      await syncGuestCart();
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
      await syncGuestCart();
      setUser(data.user);
      return data;
    } finally {
      setLoading(false);
    }
  };

  const googleLogin = async (credential) => {
    setLoading(true);
    try {
      const data = await AuthAPI.googleLogin(credential);
      await syncGuestCart();
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
    <AuthContext.Provider value={{ user, loading, initializing, login, register, googleLogin, logout, updateUser, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
