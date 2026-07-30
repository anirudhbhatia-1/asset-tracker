import api from './axiosInstance';

export const getLocations = () => api.get('/locations');
export const createLocation = (data) => api.post('/locations', data);
export const updateLocationAddresses = (id, data) => api.put(`/locations/${id}/addresses`, data);
