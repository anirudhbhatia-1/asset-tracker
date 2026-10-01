import api from './axiosInstance';

export const offboardingApi = {
  // filters: { status?: 'open'|'pending'|'in_progress'|'completed'|'cancelled', employeeId? }
  getAll: (filters = {}) => api.get('/offboarding', { params: filters }).then(res => res.data.data),

  // Includes the asset checklist (items), synced with what the employee holds.
  getById: (id) => api.get(`/offboarding/${id}`).then(res => res.data.data),

  create: (data) => api.post('/offboarding', data).then(res => res.data.data),

  updateRequest: (id, data) => api.put(`/offboarding/${id}`, data).then(res => res.data.data),

  // data: { outcome: 'returned'|'missing', condition?: 'good'|'damaged', notes? }
  resolveItem: (id, itemId, data) => api.patch(`/offboarding/${id}/items/${itemId}`, data).then(res => res.data.data),

  // data: { revokeAccess?, deactivateEmployee? }
  complete: (id, data = {}) => api.post(`/offboarding/${id}/complete`, data).then(res => res.data.data),

  cancel: (id) => api.post(`/offboarding/${id}/cancel`).then(res => res.data.data),
};
