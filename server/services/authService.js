const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../db');
const { getDefaultPermissionsForRole } = require('../middleware/validateSession');

const login = async (email, password) => {
  const { rows } = await db.pool.query(`
    SELECT e.id, e.name, e.email, e.password_hash, e.role, e.role_id, e.admin_type,
           r.name as role_name, r.is_director,
           ARRAY_AGG(p.key) FILTER (WHERE p.key IS NOT NULL) as permissions
    FROM employees e
    LEFT JOIN roles r ON e.role_id = r.id
    LEFT JOIN role_permissions rp ON r.id = rp.role_id
    LEFT JOIN permissions p ON rp.permission_id = p.id
    WHERE e.email = $1 AND e.password_hash IS NOT NULL AND e.deleted_at IS NULL
    GROUP BY e.id, r.id
  `, [email]);

  if (rows.length === 0) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }
  const user = rows[0];
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours
  await db.pool.query(
    'INSERT INTO sessions (token, employee_id, expires_at) VALUES ($1, $2, $3)',
    [token, user.id, expiresAt]
  );
  
  const isDirector = user.role === 'director' || Boolean(user.is_director);
  const userPermissions = isDirector
    ? ['*']
    : (Array.isArray(user.permissions) && user.permissions.length > 0 && user.permissions[0] !== null
        ? user.permissions
        : getDefaultPermissionsForRole(user.role));

  return {
    token,
    user: { 
      id: user.id, 
      name: user.name,
      email: user.email, 
      role: user.role, 
      roleId: user.role_id,
      roleName: user.role_name || user.role,
      isDirector, 
      permissions: userPermissions,
      adminType: user.admin_type 
    }
  };
};

const logout = async (token) => {
  if (token) {
    await db.pool.query('DELETE FROM sessions WHERE token = $1', [token]);
  }
};

const changePassword = async (userId, currentPassword, newPassword) => {
  const { rows } = await db.pool.query('SELECT id, password_hash FROM employees WHERE id = $1 AND password_hash IS NOT NULL', [userId]);
  if (rows.length === 0) {
    const err = new Error('User not found or no password set');
    err.statusCode = 401;
    throw err;
  }
  
  const user = rows[0];
  const match = await bcrypt.compare(currentPassword, user.password_hash);
  if (!match) {
    const err = new Error('Incorrect current password');
    err.statusCode = 401;
    throw err;
  }

  const saltRounds = 10;
  const newHash = await bcrypt.hash(newPassword, saltRounds);

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE employees SET password_hash = $1 WHERE id = $2', [newHash, userId]);
    await client.query('DELETE FROM sessions WHERE employee_id = $1', [userId]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { login, logout, changePassword };
