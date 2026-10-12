// What to tell someone whose sign-in failed. Only the server's own answer
// can say the email or password is wrong; when the request never got an
// answer (offline, timeout, server restarting) that is a different problem,
// and blaming the password sends people chasing the wrong thing.
export const loginErrorMessage = (err) => {
  const response = err?.response;
  if (!response) {
    if (err?.code === 'ECONNABORTED' || /timeout/i.test(err?.message || '')) {
      return 'The server took too long to answer. Please try again in a moment.';
    }
    return "Can't reach the server. Check your internet connection and try again.";
  }
  const serverMessage = typeof response.data?.message === 'string' ? response.data.message : '';
  // Locked after too many failed sign-ins: the server says for how long.
  if (response.status === 423) {
    return serverMessage || 'This account is locked after too many failed sign-ins. Try again later, or ask an administrator to unlock it.';
  }
  if (response.status === 429) return serverMessage || 'Too many attempts. Please wait a few minutes and try again.';
  if (response.status >= 500) {
    return 'The server had a problem signing you in (it may be restarting). Please try again in a moment.';
  }
  return serverMessage || 'Sign-in failed. Please try again.';
};

// Worth one automatic retry only when the request clearly never reached the
// app: the connection failed outright, or the gateway says the app is down
// (502) or starting (503). A timeout (or 504) is NOT retried — the first
// attempt may still be running on the server, and retrying it would count a
// wrong password twice toward the account lockout. A real answer such as
// "wrong password", "account locked" (423) or "too many attempts" is never
// retried.
export const isRetryableLoginError = (err) => {
  if (!err?.response) return err?.code === 'ERR_NETWORK';
  return err.response.status === 502 || err.response.status === 503;
};
