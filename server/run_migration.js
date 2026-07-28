const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool } = require('./db');

async function migrate() {
  const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260727120000_merge_users_into_employees.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  
  try {
    console.log('Running migration...');
    await pool.query(sql);
    console.log('Migration successful!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await pool.end();
  }
}

migrate();
