require('dotenv').config({ path: './.env' });
const { pool } = require('./db');

async function migrate() {
  try {
    console.log('Adding actor_id to asset_history...');
    await pool.query(`
      ALTER TABLE asset_history 
      ADD COLUMN IF NOT EXISTS actor_id INTEGER REFERENCES employees(id) ON DELETE SET NULL;
    `);
    console.log('Migration successful.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    pool.end();
  }
}

migrate();
