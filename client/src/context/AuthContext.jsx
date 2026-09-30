import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { PASSWORD_CHANGE_REQUIRED_EVENT } from '../api/axiosInstance';
import toast from 'react-hot-toast';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = sessionStorage.getItem('token');
      const storedUser = sessionStorage.getItem('user');
      
      if (token) {
        if (storedUser) {
          try {
            setUser(JSON.parse(storedUser));
          } catch (err) {
            console.error("Failed to parse stored user", err);
          }
        }
        try {
          const res = await api.get('/auth/me');
          const freshUser = res.data?.data;
          if (freshUser) {
            setUser(freshUser);
            sessionStorage.setItem('user', JSON.stringify(freshUser));
          }
        } catch (err) {
          console.error("Failed to refresh session via /auth/me", err);
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  // The API refused a call until the password is changed: flag the user so
  // ProtectedRoute swaps in the change-password screen.
  useEffect(() => {
    const handlePasswordChangeRequired = () => {
      setUser(prev => (prev && !prev.mustChangePassword ? { ...prev, mustChangePassword: true } : prev));
    };
    window.addEventListener(PASSWORD_CHANGE_REQUIRED_EVENT, handlePasswordChangeRequired);
    return () => window.removeEventListener(PASSWORD_CHANGE_REQUIRED_EVENT, handlePasswordChangeRequired);
  }, []);

  const hasPermission = useCallback((permissionKey) => {
    if (!user) return false;
    if (user.role === 'director' || user.isDirector || (user.permissions && user.permissions.includes('*'))) {
      return true;
    }
    if (!user.permissions || !Array.isArray(user.permissions)) {
      return false;
    }
    return user.permissions.includes(permissionKey);
  }, [user]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password }, { skipAuthRedirect: true });
    const { token, user: userData } = res.data.data;

    sessionStorage.setItem('token', token);
    sessionStorage.setItem('user', JSON.stringify(userData));

    setUser(userData);
    toast.success('Logged in successfully');
    return true;
  };

  const loginWithToken = (token, userData) => {
    sessionStorage.setItem('token', token);
    sessionStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = async () => {
    try {
      if (sessionStorage.getItem('token')) {
        await api.post('/auth/logout');
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      setUser(null);
    }
  };

  const updateUser = (updater) => {
    setUser(prev => {
      const nextUser = typeof updater === 'function' ? updater(prev) : updater;
      if (nextUser) {
        sessionStorage.setItem('user', JSON.stringify(nextUser));
      } else {
        sessionStorage.removeItem('user');
      }
      return nextUser;
    });
  };

  // Re-reads the signed-in user (e.g. after their role's permissions were
  // edited) so permission checks reflect the change without signing out.
  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      const freshUser = res.data?.data;
      if (freshUser) {
        sessionStorage.setItem('user', JSON.stringify(freshUser));
        setUser(freshUser);
      }
      return freshUser || null;
    } catch (err) {
      console.error('Failed to refresh the current user', err);
      return null;
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser: updateUser, refreshUser, loading, login, logout, loginWithToken, hasPermission }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
