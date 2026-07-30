require('dotenv').config({ path: './server/.env' });
const { pool } = require('./server/db');

async function run() {
  console.log("--- 3. Tickets Statuses ---");
  const { rows: ticketStatuses } = await pool.query("SELECT DISTINCT status FROM tickets");
  console.log(ticketStatuses);

  console.log("\n--- 4. Onboarding Requests ---");
  // Find HR users
  const { rows: hrUsers } = await pool.query("SELECT id, email FROM employees WHERE role = 'hr'");
  for (const hr of hrUsers) {
    const { rows: reqs } = await pool.query("SELECT id, new_hire_name, status FROM onboarding_requests WHERE requested_by_id = $1", [hr.id]);
    console.log(`HR ${hr.email} requests:`, reqs);
  }

  console.log("\n--- 6. Repeated Assets ---");
  const { rows: repAssets } = await pool.query("SELECT e.email, a.name, count(*) as c FROM assets a JOIN employees e ON a.assigned_to_id = e.id WHERE a.name ILIKE '%Integration Test MacBook Pro%' GROUP BY e.email, a.name HAVING count(*) > 1");
  console.log("Repeated integration test assets:", repAssets);
  
  if (repAssets.length === 0) {
    const { rows: repAssetsAll } = await pool.query("SELECT e.email, a.name, a.status FROM assets a JOIN employees e ON a.assigned_to_id = e.id WHERE a.name ILIKE '%Integration Test MacBook Pro%'");
    console.log("All integration test assets:", repAssetsAll);
  }

  pool.end();
}
run();
