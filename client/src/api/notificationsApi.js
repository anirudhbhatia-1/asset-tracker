import api from './axiosInstance';
export const getNotifications = () => api.get('/notifications');
