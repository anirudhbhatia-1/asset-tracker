const { pool } = require('../db');

const validateSession = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: true, message: 'Unauthorized - No token provided', code: 401 });
    }

    const token = authHeader.split(' ')[1];
    
    const { rows } = await pool.query(
      `SELECT s.user_id, u.role, u.employee_id, s.expires_at 
       FROM sessions s 
       JOIN users u ON s.user_id = u.id 
       WHERE s.token = $1`,
      [token]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: true, message: 'Unauthorized - Invalid token', code: 401 });
    }

    const session = rows[0];
    if (new Date(session.expires_at) < new Date()) {
      await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
      return res.status(401).json({ error: true, message: 'Unauthorized - Token expired', code: 401 });
    }

    req.user = {
      id: session.user_id,
      role: session.role,
      employeeId: session.employee_id
    };

    next();
  } catch (err) {
    next(err);
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: true, message: 'Unauthorized', code: 401 });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: true, message: 'Forbidden - Insufficient permissions', code: 403 });
    }
    next();
  };
};

module.exports = { validateSession, requireRole };
