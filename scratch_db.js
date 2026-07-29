require('dotenv').config({ path: './server/.env' });
const { pool } = require('./server/db');

async function run() {
  const { rows: emps } = await pool.query("SELECT * FROM employees WHERE name = 'Rajan Sharma' OR role = 'admin'");
  console.log('Employees:', emps);
  
  const { rows: assets } = await pool.query("SELECT count(*) as count FROM asset_history WHERE performed_by = 'Rajan Sharma'");
  console.log('Asset history Rajan Sharma count:', assets);
  
  const { rows: tickets } = await pool.query("SELECT * FROM ticket_history LIMIT 3");
  console.log('Ticket history sample:', tickets);
  
  pool.end();
}
run();
