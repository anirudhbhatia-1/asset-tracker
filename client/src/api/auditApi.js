import api from './axiosInstance';

// Access history (permission audit:read). Params: eventType (exact types or
// prefixes such as 'role.', comma-separated), actorId, targetType, targetId,
// from, to (YYYY-MM-DD), q, limit (≤200), before (cursor from nextCursor).
// Answers { data: [...], nextCursor } newest first.
export const getAuditEvents = (params = {}) => api.get('/audit', { params });
