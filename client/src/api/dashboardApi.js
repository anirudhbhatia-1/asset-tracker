import api from './axiosInstance';

// "Needs attention" items for the signed-in user, already filtered by their
// permissions and sorted by the server: { items: [{ key, severity, title,
// count, link, entries: [{ label, sublabel, link }] }] }.
export const getAttention = () => api.get('/dashboard/attention').then((res) => res.data?.data || { items: [] });
