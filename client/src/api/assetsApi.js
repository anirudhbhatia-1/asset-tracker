import api from './axiosInstance';

export const getAssets = (filters = {}) => api.get('/assets', { params: filters });
export const getAsset = (id) => api.get(`/assets/${id}`);
export const getAssetHistory = (id) => api.get(`/assets/${id}/history`);
export const createAsset = (payload) => api.post('/assets', payload);
// The API exposes partial asset updates as PATCH. Keeping this wrapper aligned
// prevents both the edit page and inline detail editor from receiving a 404.
export const updateAsset = (id, payload) => api.patch(`/assets/${id}`, payload);
export const deleteAssetApi = (id) => api.delete(`/assets/${id}`, { data: { confirm: true } });
export const assignAssetApi = (id, payload) => api.post(`/assets/${id}/assign`, payload);
export const returnAssetApi = (id, note) => api.post(`/assets/${id}/return`, { note });
export const retireAssetApi = (id, note) => api.post(`/assets/${id}/retire`, { note, confirm: true });
export const bulkAssignAssets = (employeeId, assetIds, note) =>
  api.post(`/employees/${employeeId}/assign-assets`, { assetIds, note });
export const scanSerial = (serial) => api.get(`/serial/scan/${encodeURIComponent(serial)}`);
export const getChildAssets = (parentId) => api.get('/assets', { params: { parentId } });

export const exportAssetsExcel = () =>
  api.get('/assets/export', { responseType: 'blob' }); // blob for file download

export const importAssetsExcel = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/assets/import', formData, {
    // Imports perform several database operations per row and can legitimately
    // take longer than the shared 10-second API timeout. Let the browser set
    // the multipart boundary; manually setting Content-Type can omit it.
    timeout: 120000,
  });
};

export const getImportErrorMessage = (error) => {
  if (error?.code === 'ECONNABORTED') {
    return 'Import timed out. Try a smaller file or contact your administrator.';
  }
  if (!error?.response) {
    return 'Import could not reach the server. Check your connection and try again.';
  }
  return error.response.data?.message || 'Import failed';
};
