// ============================================================
// TESTING ONLY — Google ID Token Login Service
// ============================================================
// This service handles login via "Sign in with Google" for
// manually pre-approved accounts. It deliberately does NOT
// enforce any hosted-domain (hd) restriction.
//
// WHEN GOING TO PRODUCTION:
//   - DELETE this file entirely
//   - Replace with Google Workspace OAuth + hd check flow
//   - Only employees with your company domain should be allowed
// ============================================================
const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');
const { pool } = require('../db');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
/**
 * Verifies a Google ID token using the official library.
 * Never decode and trust a token without this verification.
 * Returns the verified email string (lowercased).
 */
const verifyGoogleIdToken = async (idToken) => {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload || !payload.email) {
    const err = new Error('Google token verification failed: no email in payload');
    err.statusCode = 400;
    throw err;
  }
  return payload.email.toLowerCase();
};
/**
 * Full Google testing login flow.
 * 1. Verifies the token
 * 2. Looks up the email in employees (must have a role = granted access)
 * 3. Creates a session and returns the token
 */
const loginWithGoogleTestingFlow = async (idToken) => {
  const email = await verifyGoogleIdToken(idToken);
  // Only find employees that an admin has explicitly granted login access to
  // (role IS NOT NULL means they have been granted access)
  const { rows } = await pool.query(
    `SELECT id, email, role, admin_type
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
  const employee = rows[0];
  // Create session — same pattern as authService.js:login
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours
  await pool.query(
    'INSERT INTO sessions (token, employee_id, expires_at) VALUES ($1, $2, $3)',
    [token, employee.id, expiresAt]
  );
  return {
    token,
    user: {
      id: employee.id,
      email: employee.email,
      role: employee.role,
      adminType: employee.admin_type,
    },
  };
};
module.exports = { verifyGoogleIdToken, loginWithGoogleTestingFlow };
