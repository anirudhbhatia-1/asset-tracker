import api from './axiosInstance';

export const onboardingApi = {
  getAll: () => api.get('/onboarding').then(res => res.data.data),
  
  getById: (id) => api.get(`/onboarding/${id}`).then(res => res.data.data),
  
  create: (data) => api.post('/onboarding', data).then(res => res.data.data),
  
  updateStatus: (id, status) => api.put(`/onboarding/${id}/status`, { status }).then(res => res.data.data),
  
  fulfillItem: (id, itemId, assetId) => api.patch(`/onboarding/${id}/items/${itemId}/fulfill`, { assetId }).then(res => res.data.data),
  
  getHrMetrics: () => api.get('/onboarding/hr-metrics').then(res => res.data.data)
};
