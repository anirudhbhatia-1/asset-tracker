import api from './axiosInstance';

// Global search (Ctrl+K palette). Answers { data: { assets?, stock?,
// employees?, tickets?, onboarding?, offboarding? } }; a group is present
// only when the user may read it.
export const globalSearch = (q, { limit } = {}) =>
  api.get('/search', { params: { q, ...(limit ? { limit } : {}) } }).then((res) => res.data?.data || {});
