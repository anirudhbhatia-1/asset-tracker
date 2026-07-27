import api from './axiosInstance';

export const getEmployees = (filters = {}) => api.get('/employees', { params: filters });
export const getEmployee = (id) => api.get(`/employees/${id}`);
export const getEmployeeAssets = (id) => api.get(`/employees/${id}/assets`);
export const createEmployee = (payload) => api.post('/employees', payload);
export const updateEmployee = (id, payload) => api.put(`/employees/${id}`, payload);
export const deleteEmployeeApi = (id) => api.delete(`/employees/${id}`);
export const updateEmployeeRole = (id, role) => api.patch(`/employees/${id}/role`, { role });
export const grantEmployeeAccess = (id, role) => api.post(`/employees/${id}/grant-access`, { role });
