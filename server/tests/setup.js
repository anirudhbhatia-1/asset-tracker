// Server tests insert and delete real rows. Refuse to run them against
// anything but a local database unless explicitly allowed.
import '../loadEnv';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

const url = process.env.DATABASE_URL || '';
let host = '';
try {
  host = new URL(url).hostname;
} catch {
  host = '';
}

if (url && !LOCAL_HOSTS.has(host) && process.env.ALLOW_REMOTE_DB_TESTS !== '1') {
  throw new Error(
    `Refusing to run tests against a non-local database (${host || 'unparseable DATABASE_URL'}). `
    + 'Point DATABASE_URL at the local dev database, or set ALLOW_REMOTE_DB_TESTS=1 if you really mean it.'
  );
}
