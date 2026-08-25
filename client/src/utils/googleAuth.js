export const isGoogleLoginConfigured = (clientId) => {
  const value = typeof clientId === 'string' ? clientId.trim() : '';
  return Boolean(value) && !value.includes('your-google-client-id');
};

export const getGoogleLoginError = (status) => {
  if (status === 403) {
    return "This Google account hasn't been granted access. Contact your admin.";
  }
  if (status === 503) {
    return 'Google sign-in is not configured on the server. Contact your admin.';
  }
  return 'Google sign-in failed. Please try again or use email/password.';
};

export const getGoogleButtonWidth = (viewportWidth) => {
  const width = Number.isFinite(viewportWidth) ? viewportWidth : 448;
  return Math.max(200, Math.min(368, width - 80));
};
