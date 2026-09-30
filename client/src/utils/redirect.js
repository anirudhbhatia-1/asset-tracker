/**
 * Where to go after signing in: the page ProtectedRoute bounced the user
 * from, with its query string and hash (e.g. /tickets?ticket=12), else "/".
 * Only same-app paths are accepted, and never /login itself.
 */
export const getPostLoginPath = (from) => {
  const path = typeof from === 'string'
    ? from
    : `${from?.pathname || ''}${from?.search || ''}${from?.hash || ''}`;
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/login')) return '/';
  return path;
};
