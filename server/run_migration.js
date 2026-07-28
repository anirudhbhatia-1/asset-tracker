const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool } = require('./db');

async function migrate() {
  const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260728100000_add_warranty_to_assets.sql');
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
