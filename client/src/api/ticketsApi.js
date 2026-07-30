import api from './axiosInstance';

export const ticketsApi = {
  getAll: (params) => api.get('/tickets', { params }).then(res => res.data.data),
  
  create: (data) => api.post('/tickets', data).then(res => res.data.data),
  
  update: (id, data) => api.patch(`/tickets/${id}`, data).then(res => res.data.data),
  
  getHistory: (id) => api.get(`/tickets/${id}/history`).then(res => res.data.data),
  
  transfer: (id, data) => api.patch(`/tickets/${id}/transfer`, data).then(res => res.data.data),
  
  confirmClose: (id) => api.patch(`/tickets/${id}/confirm-close`).then(res => res.data.data),
  
  reopen: (id, note) => api.patch(`/tickets/${id}/reopen`, { note }).then(res => res.data.data),
};
