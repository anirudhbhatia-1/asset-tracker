// Optional error reporting with Sentry. Nothing is loaded or sent unless the
// build sets VITE_SENTRY_DSN; without it every function here is a no-op.

let sentry = null;

/** Sentry options from Vite's env (exported for tests). */
export const sentryOptions = (env = {}) => {
  const rate = Number.parseFloat(env.VITE_SENTRY_TRACES_SAMPLE_RATE);
  return {
    dsn: env.VITE_SENTRY_DSN,
    environment: env.MODE,
    release: env.VITE_GIT_COMMIT || undefined,
    // No IP addresses, cookies or user details; no session replay.
    sendDefaultPii: false,
    tracesSampleRate: Number.isFinite(rate) && rate >= 0 && rate <= 1 ? rate : 0,
  };
};

/** Loads and starts Sentry when a DSN is configured. Never throws. */
export const initMonitoring = async (env = import.meta.env) => {
  if (!env?.VITE_SENTRY_DSN || sentry) return false;
  try {
    const Sentry = await import('@sentry/react');
    const options = sentryOptions(env);
    Sentry.init({
      ...options,
      integrations: options.tracesSampleRate > 0 ? [Sentry.browserTracingIntegration()] : [],
    });
    sentry = Sentry;
    return true;
  } catch (err) {
    console.warn('Error reporting could not start', err);
    return false;
  }
};

/** Sends an error to Sentry (when enabled), with React's component stack. */
export const reportError = (error, { componentStack } = {}) => {
  if (!sentry) return;
  try {
    sentry.captureException(error, componentStack ? { contexts: { react: { componentStack } } } : undefined);
  } catch {
    // Reporting must never break the page.
  }
};
