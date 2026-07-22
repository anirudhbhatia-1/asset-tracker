import api from './axiosInstance';

export const getHistory = (limit = 20) => api.get('/history', { params: { limit } });
