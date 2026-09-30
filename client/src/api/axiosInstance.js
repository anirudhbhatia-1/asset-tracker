import axios from 'axios';

export const shouldRedirectForUnauthorized = (error) => (
  error.response?.status === 401 && !error.config?.skipAuthRedirect
);

// The server answers most calls with 403 PASSWORD_CHANGE_REQUIRED until a
// temporary or shared password is replaced.
export const PASSWORD_CHANGE_REQUIRED_EVENT = 'auth:password-change-required';

export const isPasswordChangeRequired = (error) => (
  error.response?.status === 403 && error.response?.data?.reason === 'PASSWORD_CHANGE_REQUIRED'
);

/**
 * Flags the stored user as mustChangePassword and tells AuthContext, which
 * then shows the change-password screen. No reload or redirect, so repeated
 * 403s from calls already in flight can't loop.
 */
export const flagPasswordChangeRequired = () => {
  try {
    const stored = JSON.parse(sessionStorage.getItem('user') || 'null');
    if (stored && !stored.mustChangePassword) {
      sessionStorage.setItem('user', JSON.stringify({ ...stored, mustChangePassword: true }));
    }
  } catch {
    // Unreadable stored user; AuthContext still updates its own copy.
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PASSWORD_CHANGE_REQUIRED_EVENT));
  }
};

// No default Content-Type: axios sets application/json for plain objects on its
// own, and a forced JSON header makes axios serialize FormData uploads to JSON,
// which drops the file (the server then responds "No file uploaded").
const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000,
});

// Request Interceptor
axiosInstance.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor
axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (shouldRedirectForUnauthorized(error)) {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      window.location.href = '/login';
    } else if (isPasswordChangeRequired(error)) {
      flagPasswordChangeRequired();
    }
    console.error('API Error:', error.response?.data?.message || error.message);
    return Promise.reject(error);
  }
);

export default axiosInstance;
