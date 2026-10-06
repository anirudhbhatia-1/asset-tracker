import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api, { PASSWORD_CHANGE_REQUIRED_EVENT } from '../api/axiosInstance';
import { clearQueryCache, invalidateAfterMutation } from '../utils/queryCache';
import { prefetchWhenIdle } from '../utils/routePrefetch';

const AuthContext = createContext();

// Every successful change (POST/PUT/PATCH/DELETE), from any page, marks the
// cached lists it can affect out of date, so no list shows old data after a
// save (see utils/queryCache). Registered once, even across hot reloads.
if (!api.defaults.invalidatesQueryCache) {
  api.defaults.invalidatesQueryCache = true;
  api.interceptors.response.use((response) => {
    invalidateAfterMutation(response.config?.method, response.config?.url);
    return response;
  });
}

const readStoredUser = () => {
  try {
    if (!sessionStorage.getItem('token')) return null;
    return JSON.parse(sessionStorage.getItem('user') || 'null');
  } catch (err) {
    console.error('Failed to parse stored user', err);
    return null;
  }
};

// What decides which data a user may see; a change drops cached lists.
// Directors can do everything however the server spells it (sign-in says
// ['*'], /auth/me lists keys), and permission order doesn't matter.
const accessSignature = (u) => {
  if (!u) return '';
  const director = Boolean(u.isDirector || u.role === 'director');
  const permissions = director ? ['*'] : [...(u.permissions || [])].sort();
  return JSON.stringify([u.id, u.role, u.roleName, u.adminType, director, permissions]);
};

// Pages the user is likely to open next, downloaded while the browser is idle.
const likelyPages = (u, can) => [
  '/',
  can('assets:read') && '/inventory',
  can('tickets:read') && '/tickets',
  can('employees:read') && '/employees',
  can('onboarding:read') && '/onboarding',
  can('offboarding:read') && '/offboarding',
].filter(Boolean);

const userHasPermission = (user, permissionKey) => {
  if (!user) return false;
  if (user.role === 'director' || user.isDirector || (user.permissions && user.permissions.includes('*'))) {
    return true;
  }
  if (!user.permissions || !Array.isArray(user.permissions)) {
    return false;
  }
  return user.permissions.includes(permissionKey);
};

export const AuthProvider = ({ children }) => {
  // A stored session renders straight away; /auth/me re-checks it in the
  // background. Only a token without a stored user waits for the server.
  const [user, setUserState] = useState(readStoredUser);
  const [loading, setLoading] = useState(() => Boolean(sessionStorage.getItem('token')) && !readStoredUser());

  // Cached lists belong to the user who loaded them: forget them before
  // another user (or the same user with other permissions) is shown.
  // (Cleared here, before the new user renders, so no page reads a list
  // that was loaded for someone else.)
  const userRef = useRef(user);
  const setUser = useCallback((next) => {
    const prev = userRef.current;
    const nextUser = typeof next === 'function' ? next(prev) : next;
    // Same session, changed access: reload what's on screen for the new
    // access. Sign-out or another user: just forget.
    if (accessSignature(prev) !== accessSignature(nextUser)) {
      clearQueryCache({ reloadMounted: Boolean(prev && nextUser && prev.id === nextUser.id) });
    }
    userRef.current = nextUser;
    setUserState(nextUser);
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      if (!sessionStorage.getItem('token')) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.get('/auth/me');
        const freshUser = res.data?.data;
        if (freshUser) {
          sessionStorage.setItem('user', JSON.stringify(freshUser));
          setUser(freshUser);
        }
      } catch (err) {
        console.error("Failed to refresh session via /auth/me", err);
        // A 401 signs out (the API client also sends the browser to /login).
        if (err.response?.status === 401) {
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('user');
          setUser(null);
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, [setUser]);

  // Warm the pages this user can open once they are signed in.
  const userId = user?.id;
  const userPermissions = JSON.stringify(user?.permissions || []);
  useEffect(() => {
    if (!user || user.mustChangePassword) return;
    prefetchWhenIdle(likelyPages(user, (key) => userHasPermission(user, key)));
    // Only when the user or their permissions change.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, userPermissions, user?.mustChangePassword]);

  // The API refused a call until the password is changed: flag the user so
  // ProtectedRoute swaps in the change-password screen.
  useEffect(() => {
    const handlePasswordChangeRequired = () => {
      setUser(prev => (prev && !prev.mustChangePassword ? { ...prev, mustChangePassword: true } : prev));
    };
    window.addEventListener(PASSWORD_CHANGE_REQUIRED_EVENT, handlePasswordChangeRequired);
    return () => window.removeEventListener(PASSWORD_CHANGE_REQUIRED_EVENT, handlePasswordChangeRequired);
  }, [setUser]);

  const hasPermission = useCallback((permissionKey) => userHasPermission(user, permissionKey), [user]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password }, { skipAuthRedirect: true });
    const { token, user: userData } = res.data.data;

    sessionStorage.setItem('token', token);
    sessionStorage.setItem('user', JSON.stringify(userData));

    // No success toast: landing on the dashboard is confirmation enough.
    setUser(userData);
    return true;
  };

  const loginWithToken = (token, userData) => {
    sessionStorage.setItem('token', token);
    sessionStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = async () => {
    // Nothing loaded for this user may show for the next one.
    clearQueryCache();
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
  }, [setUser]);

  return (
    <AuthContext.Provider value={{ user, setUser: updateUser, refreshUser, loading, login, logout, loginWithToken, hasPermission }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

// oxlint-disable-next-line react/only-export-components -- hook lives beside its provider
export const useAuth = () => useContext(AuthContext);
