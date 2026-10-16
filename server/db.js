const fs = require('fs');
const { Client, Pool, types } = require('pg');

// Return DATE columns (e.g. warranty_expiry_date, joining_date) exactly as
// stored ('YYYY-MM-DD'). The default parser builds a local-midnight JS Date,
// which serialises to the previous day in IST and made dates drift back a
// day on every save.
const PG_DATE_OID = 1082;
types.setTypeParser(PG_DATE_OID, (value) => value);
require('./loadEnv');

// A runaway query is cancelled by the server instead of holding a
// connection (and a request) forever. Set with SET right after connecting,
// before the pool hands the connection out, rather than as a startup
// parameter, which some poolers refuse.
const STATEMENT_TIMEOUT_MS = Math.max(1, Math.floor(Number(process.env.DB_STATEMENT_TIMEOUT_MS) || 30000));
class TimeoutClient extends Client {
  connect(callback) {
    const ready = super.connect().then(() => super.query(`SET statement_timeout = ${STATEMENT_TIMEOUT_MS}`)).then(() => undefined);
    if (typeof callback === 'function') {
      ready.then(() => callback(null), (err) => callback(err));
      return undefined;
    }
    return ready;
  }
}

const pool = new Pool({
  Client: TimeoutClient,
  connectionString: process.env.DATABASE_URL,
  // Ensure we're not exhausting connection limits from Supabase
  // Supabase free tier connection limit is typically 60 for the transaction pool,
  // but using session pooler we have more leeway. 10 is sensible for a local/node app.
  max: Number(process.env.DB_POOL_MAX) || 10,
  idleTimeoutMillis: 30000,
  // How long to wait for a connection (pool slot or new socket) before the
  // query fails. 2 s was too short for a cold Supabase pooler.
  connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS) || 10000,
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

// Without a CA file, production traffic is encrypted but anyone able to
// intercept it could pose as the database. Warn loudly; with
// DATABASE_SSL_REQUIRE_CA=true, refuse to start instead.
const getSslCaProblem = (environment = process.env) => {
  if (environment.NODE_ENV !== 'production' || environment.DATABASE_SSL_CA_FILE) return null;
  return {
    fatal: environment.DATABASE_SSL_REQUIRE_CA === 'true',
    message: 'DATABASE_SSL_CA_FILE is not set: the database connection is encrypted, but the server identity is NOT verified. '
      + 'Set DATABASE_SSL_CA_FILE to the CA certificate from Supabase (Dashboard → Database → SSL).',
  };
};

const sslCaProblem = getSslCaProblem();
if (sslCaProblem) {
  if (sslCaProblem.fatal) {
    throw new Error(`Refusing to start (DATABASE_SSL_REQUIRE_CA=true): ${sslCaProblem.message}`);
  }
  require('./logger').warn(`WARNING: ${sslCaProblem.message}`);
}

// A pooled connection that drops while idle (pooler recycle, network blip,
// database restart) is reported here; without a listener Node would treat it
// as an unhandled error and stop the API. The pool replaces the connection.
pool.on('error', (err) => {
  require('./logger').error({ err: err.message }, 'Database connection lost; the pool will reconnect');
});

const sslOptions = buildSslOptions();
if (sslOptions) {
  pool.options.ssl = sslOptions;
}

// Optional helper for running transactions simply
async function withTransaction(callback) {
  const client = await pool.connect();
  let result;
  try {
    await client.query('BEGIN');
    result = await callback(client);
    await client.query('COMMIT');
  } catch (error) {
    // If the connection itself died, ROLLBACK fails too: keep the original
    // error and throw the broken connection away instead of reusing it.
    let broken;
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      broken = rollbackError;
    }
    client.release(broken);
    throw error;
  }
  client.release();
  return result;
}

// For health checks: resolves when the database answers `SELECT 1`, rejects
// after `timeoutMs` otherwise (including while waiting for a connection), so
// monitors get a quick answer when the database is down.
const HEALTH_TIMEOUT_MS = 2000;
const pingDatabase = (timeoutMs = HEALTH_TIMEOUT_MS, executor = pool) => {
  let timer;
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`Database did not answer within ${timeoutMs} ms`)), timeoutMs);
  });
  const query = executor.query({ text: 'SELECT 1', query_timeout: timeoutMs });
  // The losing promise must not become an unhandled rejection.
  query.catch(() => {});
  return Promise.race([query, timeout]).finally(() => clearTimeout(timer));
};

module.exports = {
  HEALTH_TIMEOUT_MS,
  STATEMENT_TIMEOUT_MS,
  pingDatabase,
  buildSslOptions,
  getSslCaProblem,
  pool,
  withTransaction,
  query: (text, params) => pool.query(text, params)
};
