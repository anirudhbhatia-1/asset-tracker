import axios from 'axios';

export const shouldRedirectForUnauthorized = (error) => (
  error.response?.status === 401 && !error.config?.skipAuthRedirect
);

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
    }
    console.error('API Error:', error.response?.data?.message || error.message);
    return Promise.reject(error);
  }
);

export default axiosInstance;
