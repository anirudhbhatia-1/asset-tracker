require('dotenv').config({ path: __dirname + '/.env' });
const { pool } = require('./db');

async function check() {
  try {
    const res = await pool.query(`
      SELECT 
        e.id AS emp_id,
        e.name AS emp_name,
        e.email AS emp_email,
        e.role AS emp_role,
        u.id AS user_id,
        u.email AS user_email,
        u.role AS user_role
      FROM employees e
      LEFT JOIN users u ON e.email = u.email
      ORDER BY e.id DESC
      LIMIT 20;
    `);
    console.table(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
check();
