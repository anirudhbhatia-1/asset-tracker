const fs = require('fs');
const { Pool } = require('pg');
require('./loadEnv');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Ensure we're not exhausting connection limits from Supabase
  // Supabase free tier connection limit is typically 60 for the transaction pool,
  // but using session pooler we have more leeway. 10 is sensible for a local/node app.
  max: Number(process.env.DB_POOL_MAX) || 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Production connects to Supabase over SSL. With DATABASE_SSL_CA_FILE (the CA
// certificate from Supabase: Dashboard → Database → SSL) the server's
// certificate is verified; without it the connection is encrypted but the
// certificate is not checked.
const buildSslOptions = (environment = process.env, readFile = fs.readFileSync) => {
  if (environment.NODE_ENV !== 'production') return undefined;
  if (environment.DATABASE_SSL_CA_FILE) {
    return { rejectUnauthorized: true, ca: readFile(environment.DATABASE_SSL_CA_FILE, 'utf8') };
  }
  return { rejectUnauthorized: false };
};

const sslOptions = buildSslOptions();
if (sslOptions) {
  pool.options.ssl = sslOptions;
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
  buildSslOptions,
  pool,
  withTransaction,
  query: (text, params) => pool.query(text, params)
};
