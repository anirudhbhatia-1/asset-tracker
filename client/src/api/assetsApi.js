import api from './axiosInstance';

export const getAssets = (filters = {}) => api.get('/assets', { params: filters });
// In-stock company assets for hand-out pickers (ticket fulfilment,
// onboarding). Narrow rows: id, name, serialNumber, categoryId, categoryName.
export const getAvailableAssets = (categoryId) =>
  api.get('/assets/available', { params: categoryId ? { categoryId } : undefined });
export const getAsset = (id) => api.get(`/assets/${id}`);
// Tickets raised about the asset or fulfilled by handing it out (timeline).
export const getAssetTickets = (id) => api.get(`/assets/${id}/tickets`);
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
// Uniqueness check for the Add Asset form (assets:create, not rate-limited
// like the scanner lookup). Resolves to true/false.
export const checkSerialExists = async (serial) => {
  const res = await api.get('/assets/serial-exists', { params: { serial } });
  return Boolean(res.data?.data?.exists);
};
export const getChildAssets = (parentId) => api.get('/assets', { params: { parentId } });

export const exportAssetsExcel = () =>
  api.get('/assets/export', { responseType: 'blob' }); // blob for file download

// dryRun runs the whole import on the server and rolls it back, returning
// what would happen so the user can confirm before anything is saved.
export const importAssetsExcel = (file, { dryRun = false } = {}) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/assets/import', formData, {
    ...(dryRun ? { params: { dryRun: true } } : {}),
    // Imports perform several database operations per row and can legitimately
    // take longer than the shared 10-second API timeout. Let the browser set
    // the multipart boundary; manually setting Content-Type can omit it.
    timeout: 120000,
  });
};

// Bulk add from the CSV template. dryRun checks every row without saving.
export const importAssetsCsv = (file, { dryRun = false } = {}) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/assets/import-csv', formData, {
    params: dryRun ? { dryRun: true } : undefined,
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
