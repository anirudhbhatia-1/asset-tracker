const { OAuth2Client } = require('google-auth-library');
const { pool } = require('../db');
const { createSessionForEmployee } = require('./authService');

const normalizeAllowedDomain = (value) => {
  if (typeof value !== 'string') return '';
  const domain = value.trim().toLowerCase().replace(/^@/, '');
  if (!domain || domain.length > 253 || !domain.includes('.')) return '';
  const labels = domain.split('.');
  if (labels.some((label) => (
    !label || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
  ))) return '';
  return domain;
};

const isGoogleAuthConfigured = (environment = process.env) => {
  const clientId = typeof environment.GOOGLE_CLIENT_ID === 'string'
    ? environment.GOOGLE_CLIENT_ID.trim()
    : '';
  if (!clientId || clientId.includes('your-google-client-id')) return false;

  if (environment.NODE_ENV === 'production') {
    const allowedDomain = normalizeAllowedDomain(environment.GOOGLE_ALLOWED_DOMAIN);
    const allowsExternalAccounts = environment.GOOGLE_ALLOW_EXTERNAL_ACCOUNTS === 'true';
    return Boolean(allowedDomain) || allowsExternalAccounts;
  }

  return true;
};

const validateGooglePayload = (payload, allowedDomain = process.env.GOOGLE_ALLOWED_DOMAIN) => {
  if (!payload?.email || payload.email_verified !== true) {
    const err = new Error('Google sign-in requires a verified email address');
    err.statusCode = 401;
    throw err;
  }

  const email = payload.email.trim().toLowerCase();
  const domain = normalizeAllowedDomain(allowedDomain);

  if (domain) {
    const emailDomain = email.split('@')[1];
    const hostedDomain = typeof payload.hd === 'string' ? payload.hd.toLowerCase() : '';
    if (emailDomain !== domain || hostedDomain !== domain) {
      const err = new Error(`Google account must belong to the ${domain} Workspace domain`);
      err.statusCode = 403;
      throw err;
    }
  }

  return email;
};
/**
 * Verifies a Google ID token using the official library.
 * Never decode and trust a token without this verification.
 * Returns the verified email string (lowercased).
 */
const verifyGoogleIdToken = async (idToken, dependencies = {}) => {
  const environment = dependencies.environment || process.env;
  if (!isGoogleAuthConfigured(environment)) {
    const err = new Error('Google sign-in is not configured on the server');
    err.statusCode = 503;
    throw err;
  }

  try {
    const client = dependencies.oauthClient || new OAuth2Client(environment.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
      idToken,
      audience: environment.GOOGLE_CLIENT_ID,
    });
    return validateGooglePayload(ticket.getPayload(), environment.GOOGLE_ALLOWED_DOMAIN);
  } catch (err) {
    if (err.statusCode) throw err;
    const authError = new Error('Invalid or expired Google credential');
    authError.statusCode = 401;
    throw authError;
  }
};
/**
 * Full Google login flow for pre-approved employees.
 * 1. Verifies the token
 * 2. Looks up the email in employees (must have a role = granted access)
 * 3. Creates a session and returns the token
 */
const loginWithGoogle = async (idToken, dependencies = {}) => {
  const verifyToken = dependencies.verifyToken || verifyGoogleIdToken;
  const databasePool = dependencies.pool || pool;
  const createSession = dependencies.createSession || createSessionForEmployee;
  const email = await verifyToken(idToken);
  // Only find employees that an admin has explicitly granted login access to
  // (role IS NOT NULL means they have been granted access)
  const { rows } = await databasePool.query(
    `SELECT id
     FROM employees
     WHERE LOWER(email) = $1
       AND deleted_at IS NULL
       AND role IS NOT NULL`,
    [email]
  );
  if (rows.length === 0) {
    const err = new Error(
      'Access not granted. Ask your admin to add this Google account to the system.'
    );
    err.statusCode = 403;
    throw err;
  }
  return createSession(rows[0].id);
};
module.exports = {
  normalizeAllowedDomain,
  isGoogleAuthConfigured,
  validateGooglePayload,
  verifyGoogleIdToken,
  loginWithGoogle,
};
