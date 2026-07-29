require('dotenv').config({ path: './.env' });
const { pool } = require('./db');

async function run() {
  const { rows } = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'asset_history'
  `);
  console.log('asset_history columns:', rows);
  pool.end();
}
run();
