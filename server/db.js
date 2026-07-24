const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Ensure we're not exhausting connection limits from Supabase
  // Supabase free tier connection limit is typically 60 for the transaction pool,
  // but using session pooler we have more leeway. 10 is sensible for a local/node app.
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// If deploying to production or a remote Supabase DB, SSL is required for the Session Pooler
if (process.env.NODE_ENV === 'production') {
  pool.options.ssl = { rejectUnauthorized: false };
}

// Optional helper for running transactions simply
async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  withTransaction,
  query: (text, params) => pool.query(text, params)
};
