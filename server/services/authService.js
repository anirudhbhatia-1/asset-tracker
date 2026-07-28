const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../db');

const login = async (email, password) => {
  const { rows } = await db.pool.query('SELECT * FROM employees WHERE email = $1 AND password_hash IS NOT NULL', [email]);
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
  return {
    token,
    user: { id: user.id, email: user.email, role: user.role, adminType: user.admin_type }
  };
};

const logout = async (token) => {
  if (token) {
    await db.pool.query('DELETE FROM sessions WHERE token = $1', [token]);
  }
};

const changePassword = async (userId, currentPassword, newPassword) => {
  const { rows } = await db.pool.query('SELECT * FROM employees WHERE id = $1 AND password_hash IS NOT NULL', [userId]);
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

  // Hash new password and update
  const saltRounds = 10;
  const newHash = await bcrypt.hash(newPassword, saltRounds);

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    
    // Update password
    await client.query('UPDATE employees SET password_hash = $1 WHERE id = $2', [newHash, userId]);
    
    // Invalidate all sessions for this user to force re-login
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
