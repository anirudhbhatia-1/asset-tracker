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
    user: { id: user.id, email: user.email, role: user.role }
  };
};

const logout = async (token) => {
  if (token) {
    await db.pool.query('DELETE FROM sessions WHERE token = $1', [token]);
  }
};

module.exports = { login, logout };
