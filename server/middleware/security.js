// HTTP security headers (helmet) and the API-wide rate limit.
const helmet = require('helmet');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

const GOOGLE_ACCOUNTS = 'https://accounts.google.com';

// The client has no inline scripts (the early theme script is the file
// /theme-init.js), so 'self' covers it. CSP_SCRIPT_HASHES (comma-separated
// 'sha256-…' values) can allow an inline script if one is ever added.

const extraScriptHashes = (environment) => (environment.CSP_SCRIPT_HASHES || '')
  .split(',')
  .map((value) => value.trim().replace(/^'|'$/g, ''))
  .filter((value) => /^sha(256|384|512)-[A-Za-z0-9+/=]+$/.test(value))
  .map((value) => `'${value}'`);

// The API answers with JSON, where a CSP does little; it matters if Express
// ever serves the built client. Allows what the client loads: its own files,
// Google Identity Services (script, iframe, styles), Google Fonts, avatars
// from any https host.
const buildContentSecurityPolicy = (environment = process.env) => ({
  useDefaults: false,
  directives: {
    defaultSrc: ["'self'"],
    baseUri: ["'self'"],
    objectSrc: ["'none'"],
    frameAncestors: ["'none'"],
    formAction: ["'self'"],
    scriptSrc: ["'self'", `${GOOGLE_ACCOUNTS}/gsi/client`, ...extraScriptHashes(environment)],
    scriptSrcAttr: ["'none'"],
    // Inline style attributes (React style props, Google's button) need
    // 'unsafe-inline'.
    styleSrc: ["'self'", "'unsafe-inline'", `${GOOGLE_ACCOUNTS}/gsi/style`, 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
    imgSrc: ["'self'", 'data:', 'https:'],
    connectSrc: ["'self'", GOOGLE_ACCOUNTS],
    frameSrc: [GOOGLE_ACCOUNTS],
    ...(environment.NODE_ENV === 'production' ? { upgradeInsecureRequests: [] } : {}),
  },
});

const securityHeaders = (environment = process.env) => helmet({
  contentSecurityPolicy: buildContentSecurityPolicy(environment),
  // Google sign-in opens a popup that must be able to report back.
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  // HSTS only where the site is actually served over HTTPS.
  strictTransportSecurity: environment.NODE_ENV === 'production'
    ? { maxAge: 180 * 24 * 60 * 60, includeSubDomains: true }
    : false,
});

// Signed-in requests are counted per session, so an office sharing one IP
// address (or a proxy without TRUST_PROXY_HOPS) doesn't share one budget;
// requests without a session are counted per IP. Health checks are exempt
// so monitors never trip it. Login and scanner keep their own stricter limits.
const sessionOrIpKey = (req) => {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ') && header.length > 20) {
    return `session:${crypto.createHash('sha256').update(header.slice(7)).digest('hex').slice(0, 32)}`;
  }
  return `ip:${ipKeyGenerator(req.ip || '')}`;
};

const isHealthCheck = (req) => req.path === '/health' || req.originalUrl.startsWith('/api/health');

const createApiLimiter = (overrides = {}, environment = process.env) => rateLimit({
  windowMs: 60 * 1000,
  // Per session: generous for fast clicking, background refreshes and
  // prefetching; per IP (no session): tighter.
  limit: (req) => (sessionOrIpKey(req).startsWith('session:')
    ? Number(environment.API_RATE_LIMIT_PER_MINUTE) || 600
    : Number(environment.API_RATE_LIMIT_ANON_PER_MINUTE) || 300),
  keyGenerator: sessionOrIpKey,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: isHealthCheck,
  message: { error: true, message: 'Too many requests. Please slow down and try again in a minute.', code: 429 },
  ...overrides,
});

// A ceiling per client IP over ALL /api requests, whatever session they
// claim: without it, sending a different made-up Bearer token on every
// request would get a fresh per-session budget each time. Generous enough
// for an office of people sharing one address.
const createApiIpLimiter = (overrides = {}, environment = process.env) => rateLimit({
  windowMs: 60 * 1000,
  limit: Number(environment.API_RATE_LIMIT_IP_PER_MINUTE) || 1200,
  keyGenerator: (req) => `ip:${ipKeyGenerator(req.ip || '')}`,
  // The per-session limiter after this one sends the RateLimit headers.
  standardHeaders: false,
  legacyHeaders: false,
  skip: isHealthCheck,
  message: { error: true, message: 'Too many requests from your network. Please try again in a minute.', code: 429 },
  ...overrides,
});

module.exports = {
  buildContentSecurityPolicy,
  securityHeaders,
  createApiLimiter,
  createApiIpLimiter,
};
