// Optional error reporting. Does nothing unless SENTRY_DSN is set; only
// 5xx errors are sent (see middleware/errorHandler.js). Nothing that could
// identify a person or carry a secret is ever sent: no request bodies,
// cookies, query strings, auth headers, user details or IP addresses, and
// no local variable values from stack frames. Collection is switched off
// in the SDK, and beforeSend strips anything that slips through anyway.
const buildInfo = require('./buildInfo');

let Sentry = null;

const SENSITIVE_KEY = /pass(word)?|token|secret|authori[sz]ation|cookie|credential|session|api[-_]?key/i;
const REDACTED = '[redacted]';
// Request headers worth keeping for debugging; everything else is dropped.
const SAFE_HEADERS = ['user-agent', 'content-type', 'content-length', 'accept', 'host'];

// Replaces the value of every key that looks like a secret, at any depth.
const scrubObject = (value, depth = 0) => {
  if (!value || typeof value !== 'object' || depth > 8) return value;
  if (Array.isArray(value)) return value.map((item) => scrubObject(item, depth + 1));
  const result = {};
  for (const [key, inner] of Object.entries(value)) {
    result[key] = SENSITIVE_KEY.test(key) ? REDACTED : scrubObject(inner, depth + 1);
  }
  return result;
};

// beforeSend / beforeSendTransaction: returns the event without request
// bodies, cookies, query strings, non-allowlisted headers or user details.
const scrubEvent = (event) => {
  if (!event || typeof event !== 'object') return event;
  if (event.request) {
    const request = { ...event.request };
    delete request.data;
    delete request.cookies;
    delete request.query_string;
    delete request.env;
    if (request.headers) {
      const headers = {};
      for (const [name, value] of Object.entries(request.headers)) {
        if (SAFE_HEADERS.includes(name.toLowerCase())) headers[name] = value;
      }
      request.headers = headers;
    }
    // The URL can carry a query string too.
    if (typeof request.url === 'string') request.url = request.url.split('?')[0];
    event.request = request;
  }
  delete event.user;
  if (event.extra) event.extra = scrubObject(event.extra);
  if (event.contexts) event.contexts = scrubObject(event.contexts);
  if (Array.isArray(event.breadcrumbs)) {
    event.breadcrumbs = event.breadcrumbs.map((crumb) => (crumb && crumb.data ? { ...crumb, data: scrubObject(crumb.data) } : crumb));
  }
  return event;
};

// What the SDK may collect at all.
const DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: { request: { allow: SAFE_HEADERS }, response: false },
  httpBodies: [],
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
};

const buildSentryOptions = (environment = process.env) => ({
  dsn: environment.SENTRY_DSN,
  environment: environment.NODE_ENV || 'development',
  release: buildInfo.commit,
  sendDefaultPii: false,
  dataCollection: DATA_COLLECTION,
  beforeSend: scrubEvent,
  // Performance tracing is off (no tracesSampleRate); if it is ever turned
  // on, transactions go through the same scrubber.
  traceLifecycle: 'static',
  beforeSendTransaction: scrubEvent,
});

// `extraOptions` is for tests (e.g. a capturing transport).
const initSentry = (environment = process.env, extraOptions = {}) => {
  if (!environment.SENTRY_DSN || Sentry) return Boolean(Sentry);
  try {
    // Loaded lazily so the API runs without the package installed.
    // eslint-disable-next-line global-require
    const sdk = require('@sentry/node');
    sdk.init({ ...buildSentryOptions(environment), ...extraOptions });
    Sentry = sdk;
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`Sentry is not enabled: ${err.message}`);
    return false;
  }
};

const captureException = (err, context = {}) => {
  if (!Sentry) return;
  try {
    Sentry.withScope((scope) => {
      if (context.method) scope.setTag('method', context.method);
      if (context.route) scope.setTag('route', context.route);
      Sentry.captureException(err);
    });
  } catch {
    // Reporting must never affect the response.
  }
};

const flushSentry = async (timeoutMs = 2000) => {
  if (!Sentry) return;
  try {
    await Sentry.flush(timeoutMs);
  } catch {
    // ignore
  }
};

module.exports = {
  initSentry, captureException, flushSentry, scrubEvent, buildSentryOptions, isEnabled: () => Boolean(Sentry),
};
