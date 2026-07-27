import api from './axiosInstance';

export const ticketsApi = {
  getAll: () => api.get('/tickets').then(res => res.data.data),
  
  create: (data) => api.post('/tickets', data).then(res => res.data.data),
  
  update: (id, data) => api.patch(`/tickets/${id}`, data).then(res => res.data.data),
};
