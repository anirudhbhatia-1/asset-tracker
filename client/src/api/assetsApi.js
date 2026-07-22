import api from './axiosInstance';

export const getAssets = (filters = {}) => api.get('/assets', { params: filters });
export const getAsset = (id) => api.get(`/assets/${id}`);
export const getAssetHistory = (id) => api.get(`/assets/${id}/history`);
export const createAsset = (payload) => api.post('/assets', payload);
export const updateAsset = (id, payload) => api.put(`/assets/${id}`, payload);
export const deleteAssetApi = (id) => api.delete(`/assets/${id}`, { data: { confirm: true } });
export const assignAssetApi = (id, payload) => api.post(`/assets/${id}/assign`, payload);
export const returnAssetApi = (id, note) => api.post(`/assets/${id}/return`, { note });
export const retireAssetApi = (id, note) => api.post(`/assets/${id}/retire`, { note, confirm: true });
export const scanSerial = (serial) => api.get(`/serial/scan/${encodeURIComponent(serial)}`);
