import api from './axiosInstance';

// Bulk items without serial numbers (bags, cables, mouse pads), kept as a
// count. Every call resolves to the response's `data`.
export const stockApi = {
  // filters: { categoryId?, location?, q? }
  getAll: (filters = {}) => api.get('/stock', { params: filters }).then(res => res.data.data),

  // Item with holders [] and history [] (newest first).
  getById: (id) => api.get(`/stock/${id}`).then(res => res.data.data),

  // data: { name, categoryId?, location?, quantity, costCents?, lowStockThreshold?, notes? }
  create: (data) => api.post('/stock', data).then(res => res.data.data),

  // Details only; quantities change through adjust / assign / return / writeOff.
  update: (id, data) => api.patch(`/stock/${id}`, data).then(res => res.data.data),

  // data: { change: +N delivery | -N removed from shelf, note? }
  adjust: (id, data) => api.post(`/stock/${id}/adjust`, data).then(res => res.data.data),

  // data: { employeeId, quantity, note?, assignedDate? }
  assign: (id, data) => api.post(`/stock/${id}/assign`, data).then(res => res.data.data),

  // data: { employeeId, quantity, note? } — back on the shelf
  returnStock: (id, data) => api.post(`/stock/${id}/return`, data).then(res => res.data.data),

  // data: { employeeId, quantity, note? } — lost or broken; the total drops
  writeOff: (id, data) => api.post(`/stock/${id}/write-off`, data).then(res => res.data.data),

  remove: (id) => api.delete(`/stock/${id}`).then(res => res.data.data),

  // [{ stockItemId, name, location, categoryName, quantity, firstAssignedAt, lastAssignedAt }]
  getMine: () => api.get('/stock/mine').then(res => res.data.data),
  getHoldings: (employeeId) => api.get(`/stock/holdings/${employeeId}`).then(res => res.data.data),
};
