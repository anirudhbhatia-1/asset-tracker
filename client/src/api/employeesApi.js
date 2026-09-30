import api from './axiosInstance';

export const getEmployees = (filters = {}) => api.get('/employees', { params: filters });
export const getDepartments = () => api.get('/employees/departments');
export const getEmployee = (id) => api.get(`/employees/${id}`);
export const getEmployeeAssets = (id) => api.get(`/employees/${id}/assets`);
export const createEmployee = (payload) => api.post('/employees', payload);
export const updateEmployee = (id, payload) => api.patch(`/employees/${id}`, payload);
export const deleteEmployeeApi = (id) => api.delete(`/employees/${id}`);
export const restoreEmployee = (id) => api.patch(`/employees/${id}/restore`);
// Roles are picked by id when GET /roles loaded, or by name as a fallback.
// Send whichever the caller has so the server can resolve either.
export const rolePayload = (roleOrId) =>
  /^\d+$/.test(String(roleOrId)) ? { roleId: Number(roleOrId) } : { role: roleOrId };
export const getRoles = () => api.get('/roles');
export const updateEmployeeRole = (id, roleOrId) => api.patch(`/employees/${id}/role`, rolePayload(roleOrId));
export const updateEmployeeDetails = (id, data) => api.patch(`/employees/${id}`, data);
export const grantEmployeeAccess = (id, roleOrId) => api.post(`/employees/${id}/grant-access`, rolePayload(roleOrId));

// TESTING ONLY — remove when production Google Workspace flow is implemented
export const grantEmployeeGoogleAccess = (id) => api.post(`/employees/${id}/grant-google-access`);

export const getMyProfile = () => api.get('/employees/me');
export const updateMyProfile = (data) => api.patch('/employees/me', data);

