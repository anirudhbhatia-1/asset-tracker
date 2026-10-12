const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../db');
const { hashSessionToken } = require('./sessionToken');
const { expandPermissions, getDefaultPermissionsForRole } = require('../middleware/validateSession');
const logger = require('../logger');
const auditService = require('./auditService');
const { BCRYPT_COST, assertValidPassword, hashPassword } = require('./passwordPolicy');

// Compared against when an email has no account, so a login attempt takes
// the same time whether or not the email exists.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), BCRYPT_COST);

const buildSessionUser = (user) => {
  const isDirector = user.role === 'director' || Boolean(user.is_director);
  const permissions = isDirector
    ? ['*']
    : (user.role_id == null
        ? getDefaultPermissionsForRole(user.role)
        : (user.permissions || []).filter(Boolean));

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    roleId: user.role_id,
    roleName: user.role_name || user.role,
    isDirector,
    permissions: expandPermissions(permissions),
    adminType: user.admin_type,
    mustChangePassword: Boolean(user.must_change_password),
  };
};

const getSessionUser = async (employeeId) => {
  const { rows } = await db.pool.query(`
    SELECT e.id, e.name, e.email, e.role, e.role_id, e.admin_type, e.must_change_password,
           r.name as role_name, r.is_director,
           ARRAY_AGG(p.key) FILTER (WHERE p.key IS NOT NULL) as permissions
    FROM employees e
    LEFT JOIN roles r ON e.role_id = r.id
    LEFT JOIN role_permissions rp ON r.id = rp.role_id
    LEFT JOIN permissions p ON rp.permission_id = p.id
    WHERE e.id = $1 AND e.deleted_at IS NULL
    GROUP BY e.id, r.id
  `, [employeeId]);

  if (rows.length === 0) {
    const err = new Error('User not found or inactive');
    err.statusCode = 401;
    throw err;
  }

  return buildSessionUser(rows[0]);
};

const createSessionForEmployee = async (employeeId) => {
  const user = await getSessionUser(employeeId);
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);

  await db.pool.query(
    'INSERT INTO sessions (token, employee_id, expires_at) VALUES ($1, $2, $3)',
    [hashSessionToken(token), user.id, expiresAt]
  );

  return { token, user };
};

// "ravi.kumar@thinkvibes.com" -> "ra***@thinkvibes.com" for logs.
const maskEmail = (email) => {
  const [local = '', domain = ''] = String(email).trim().toLowerCase().split('@');
  return `${local.slice(0, 2)}***@${domain}`;
};

const failureReason = async (email) => {
  try {
    const { rows: [account] } = await db.pool.query(
      `SELECT deleted_at, password_hash IS NOT NULL AS has_password, google_id IS NOT NULL AS has_google, role
       FROM employees WHERE LOWER(email) = LOWER($1)`, [String(email).trim()]
    );
    if (!account) return 'no account with this email';
    if (account.deleted_at) return 'account removed from the directory';
    if (account.role || account.has_google) return 'no password set (signs in with Google only, or access was changed)';
    return 'no login access (never granted or revoked)';
  } catch {
    return 'unknown';
  }
};

// Lockout policy: MAX_FAILED_LOGINS wrong passwords within a rolling
// FAILURE_WINDOW_MINUTES lock password sign-in for LOCKOUT_MINUTES. Google
// sign-in ignores the lock; an administrator can lift it early.
const MAX_FAILED_LOGINS = 20;
const FAILURE_WINDOW_MINUTES = 60;
const LOCKOUT_MINUTES = 15;

const lockedError = (lockedUntil) => {
  const minutes = Math.max(1, Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 60000));
  const err = new Error(
    `This account is locked after too many failed sign-ins. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}, or ask an administrator to unlock it.`
  );
  err.statusCode = 423;
  err.reason = 'ACCOUNT_LOCKED';
  return err;
};

const invalidCredentialsError = () => {
  const err = new Error('Invalid email or password');
  err.statusCode = 401;
  return err;
};

// Counts this attempt before the password is checked, in one statement, so
// concurrent guesses can't all read the same count. The count restarts at 1
// when the previous counted attempt is older than the window. Returns the
// count, or null when the account is locked right now (nothing is counted).
const reserveAttempt = async (employeeId) => {
  const { rows: [row] } = await db.pool.query(`
    UPDATE employees
    SET failed_login_count = CASE
          WHEN last_failed_login_at IS NULL OR last_failed_login_at <= NOW() - make_interval(mins => $2) THEN 1
          ELSE failed_login_count + 1 END,
        last_failed_login_at = NOW()
    WHERE id = $1 AND (locked_until IS NULL OR locked_until <= NOW())
    RETURNING failed_login_count`,
  [employeeId, FAILURE_WINDOW_MINUTES]);
  return row ? row.failed_login_count : null;
};

// After a wrong password whose reserved count reached the limit: lock the
// account (if it isn't locked already). Only the request that actually sets
// the lock records account.locked, so a burst of guesses produces one entry.
const lockAfterFailures = async (employee, attempts, ip) => {
  const { rows: [row] } = await db.pool.query(`
    UPDATE employees
    SET locked_until = NOW() + make_interval(mins => $2), failed_login_count = 0, last_failed_login_at = NULL
    WHERE id = $1 AND (locked_until IS NULL OR locked_until <= NOW())
    RETURNING locked_until`,
  [employee.id, LOCKOUT_MINUTES]);
  if (!row) return null;
  logger.warn(`[auth] Account ${maskEmail(employee.email)} locked for ${LOCKOUT_MINUTES} minutes after ${attempts} failed sign-ins within ${FAILURE_WINDOW_MINUTES} minutes`);
  await auditService.record(db.pool, {
    eventType: 'account.locked',
    actor: null,
    targetType: 'employee',
    targetId: employee.id,
    targetName: employee.name,
    newValue: { lockedUntil: row.locked_until },
    details: {
      ip: ip || null, failedAttempts: attempts, windowMinutes: FAILURE_WINDOW_MINUTES, lockMinutes: LOCKOUT_MINUTES,
    },
    ip: ip || null,
  });
  return row.locked_until;
};

const currentLock = async (employeeId) => {
  const { rows: [row] } = await db.pool.query(
    'SELECT CASE WHEN locked_until > NOW() THEN locked_until END AS locked_until FROM employees WHERE id = $1',
    [employeeId],
  );
  return row ? row.locked_until : null;
};

// Answers never reveal whether an account exists or is locked to someone who
// doesn't know its password: unknown email, wrong password and wrong password
// on a locked account all get the same 401 (and routes/auth.js pads them to
// the same duration). Only the right password on a locked account gets 423.
const login = async (email, password, { ip } = {}) => {
  const { rows } = await db.pool.query(`
    SELECT e.id, e.name, e.email, e.password_hash
    FROM employees e
    WHERE LOWER(e.email) = LOWER($1) AND e.password_hash IS NOT NULL AND e.deleted_at IS NULL
  `, [String(email).trim()]);

  const employee = rows[0];
  if (!employee) {
    await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
    // The person signing in gets one generic answer; the server log says
    // why, for whoever has to answer "my password is right but it won't
    // let me in".
    logger.warn(`[auth] Sign-in failed for ${maskEmail(email)}: ${await failureReason(email)}`);
    throw invalidCredentialsError();
  }

  const attempts = await reserveAttempt(employee.id);
  const match = await bcrypt.compare(password, employee.password_hash);

  if (attempts === null) {
    // Locked: the attempt is not counted. bcrypt still ran, so the answer
    // takes as long as any other.
    logger.warn(`[auth] Sign-in refused for ${maskEmail(email)}: account locked${match ? ' (correct password)' : ''}`);
    if (!match) throw invalidCredentialsError();
    const lockedUntil = await currentLock(employee.id);
    if (lockedUntil) throw lockedError(lockedUntil);
    // The lock expired in the meantime: the right password signs in.
  } else if (!match) {
    logger.warn(`[auth] Sign-in failed for ${maskEmail(email)}: wrong password (${attempts} of ${MAX_FAILED_LOGINS} within ${FAILURE_WINDOW_MINUTES} minutes)`);
    if (attempts >= MAX_FAILED_LOGINS) await lockAfterFailures(employee, attempts, ip);
    // Even the attempt that locks the account gets the generic answer.
    throw invalidCredentialsError();
  }

  // Success clears the failure count, unless a concurrent burst of guesses
  // locked the account meanwhile: a correct guess never lifts an active
  // lock. A hash made with a lower cost than today's is upgraded while the
  // plain password is at hand.
  let upgradedHash = null;
  try {
    if (bcrypt.getRounds(employee.password_hash) < BCRYPT_COST) {
      upgradedHash = await hashPassword(password);
    }
  } catch {
    upgradedHash = null;
  }
  const { rowCount } = await db.pool.query(`
    UPDATE employees
    SET failed_login_count = 0, last_failed_login_at = NULL, locked_until = NULL,
        password_hash = COALESCE($2, password_hash)
    WHERE id = $1 AND (locked_until IS NULL OR locked_until <= NOW())`,
  [employee.id, upgradedHash]);
  if (rowCount === 0) {
    logger.warn(`[auth] Sign-in refused for ${maskEmail(email)}: account locked (correct password)`);
    throw lockedError((await currentLock(employee.id)) || new Date(Date.now() + LOCKOUT_MINUTES * 60000));
  }

  // Housekeeping: expired sessions are otherwise never removed.
  await db.pool.query('DELETE FROM sessions WHERE expires_at < NOW()');
  return createSessionForEmployee(employee.id);
};

const logout = async (token) => {
  if (token) {
    await db.pool.query('DELETE FROM sessions WHERE token = $1', [hashSessionToken(token)]);
  }
};

const changePassword = async (userId, currentPassword, newPassword, { ip } = {}) => {
  const { rows } = await db.pool.query(
    'SELECT id, name, email, password_hash FROM employees WHERE id = $1 AND password_hash IS NOT NULL', [userId]
  );
  if (rows.length === 0) {
    // 400, not 401: the session is valid, and the client treats 401 as
    // "signed out".
    const err = new Error('This account has no password set');
    err.statusCode = 400;
    throw err;
  }
  
  const user = rows[0];
  const match = await bcrypt.compare(currentPassword, user.password_hash);
  if (!match) {
    const err = new Error('Incorrect current password');
    err.statusCode = 400;
    throw err;
  }

  if (await bcrypt.compare(newPassword, user.password_hash)) {
    const err = new Error('The new password must be different from the current one');
    err.statusCode = 400;
    throw err;
  }

  assertValidPassword(newPassword, { email: user.email, name: user.name });
  const newHash = await hashPassword(newPassword);

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'UPDATE employees SET password_hash = $1, must_change_password = false, failed_login_count = 0, last_failed_login_at = NULL, locked_until = NULL WHERE id = $2',
      [newHash, userId]
    );
    await client.query('DELETE FROM sessions WHERE employee_id = $1', [userId]);
    await auditService.record(client, {
      eventType: 'password.changed',
      actor: { id: user.id, name: user.name },
      targetType: 'employee',
      targetId: user.id,
      targetName: user.name,
      details: { selfService: true },
      ip: ip || null,
    });
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  login, logout, changePassword, createSessionForEmployee, MAX_FAILED_LOGINS, FAILURE_WINDOW_MINUTES, LOCKOUT_MINUTES,
};
