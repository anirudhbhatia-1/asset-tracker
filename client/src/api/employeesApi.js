import api from './axiosInstance';

export const getEmployees = (filters = {}) => api.get('/employees', { params: filters });
export const getDepartments = () => api.get('/employees/departments');
export const getEmployeeAssets = (id) => api.get(`/employees/${id}/assets`);
export const createEmployee = (payload) => api.post('/employees', payload);
export const updateEmployee = (id, payload) => api.patch(`/employees/${id}`, payload);
export const deleteEmployeeApi = (id) => api.delete(`/employees/${id}`);
// Roles are picked by id when GET /roles loaded, or by name as a fallback.
// Send whichever the caller has so the server can resolve either.
export const rolePayload = (roleOrId) =>
  /^\d+$/.test(String(roleOrId)) ? { roleId: Number(roleOrId) } : { role: roleOrId };
export const getRoles = () => api.get('/roles');
export const updateEmployeeRole = (id, roleOrId) => api.patch(`/employees/${id}/role`, rolePayload(roleOrId));
export const updateEmployeeDetails = (id, data) => api.patch(`/employees/${id}`, data);
export const grantEmployeeAccess = (id, roleOrId) => api.post(`/employees/${id}/grant-access`, rolePayload(roleOrId));
// Issues a new temporary password (returned once as temporaryPassword) and
// signs the employee out; they must change it on next login.
export const resetEmployeePassword = (id) => api.post(`/employees/${id}/reset-password`);
// Removes the employee's login. 409 if it would remove the last Director.
export const revokeEmployeeAccess = (id) => api.post(`/employees/${id}/revoke-access`);
// Clears a sign-in lockout (too many failed attempts). Answers { data: employee }.
export const unlockEmployeeSignIn = (id) => api.post(`/employees/${id}/unlock`);

// TESTING ONLY — remove when production Google Workspace flow is implemented
export const grantEmployeeGoogleAccess = (id) => api.post(`/employees/${id}/grant-google-access`);

export const getMyProfile = () => api.get('/employees/me');
export const updateMyProfile = (data) => api.patch('/employees/me', data);

