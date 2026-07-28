import api from './axiosInstance';

export const ticketsApi = {
  getAll: (params) => api.get('/tickets', { params }).then(res => res.data.data),
  
  create: (data) => api.post('/tickets', data).then(res => res.data.data),
  
  update: (id, data) => api.patch(`/tickets/${id}`, data).then(res => res.data.data),
  
  getHistory: (id) => api.get(`/tickets/${id}/history`).then(res => res.data.data),
  
  transfer: (id, data) => api.patch(`/tickets/${id}/transfer`, data).then(res => res.data.data),
  
  confirm: (id, action) => api.patch(`/tickets/${id}/confirm`, { action }).then(res => res.data.data),
};
