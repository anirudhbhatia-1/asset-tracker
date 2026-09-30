// Removes the records the e2e specs create (roles, employees, assets,
// categories) so the local dev database doesn't fill up with test data.
// Only ever touches a local database.
const path = require('path');
const dotenv = require(path.join(__dirname, '../server/node_modules/dotenv'));
const { Client } = require(path.join(__dirname, '../server/node_modules/pg'));

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

module.exports = async () => {
  const env = dotenv.parse(require('fs').readFileSync(path.join(__dirname, '../server/.env')));
  const url = env.DATABASE_URL;
  if (!url || !LOCAL_HOSTS.has(new URL(url).hostname)) {
    console.warn('[e2e teardown] DATABASE_URL is not local; leaving test data in place.');
    return;
  }
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('BEGIN');
    const { rows: people } = await client.query(`
      SELECT id FROM employees
      WHERE email ~ '^(auditor|scan_emp|nullrole)_[0-9]+@company\\.com$'`);
    const personIds = people.map((row) => row.id);
    const { rows: assets } = await client.query(`
      SELECT id FROM assets
      WHERE serial_number ~ '^(TEST-SN|E2E-ASSIGN)-[0-9]+$' OR name = 'Playwright Test Laptop'`);
    const assetIds = assets.map((row) => row.id);

    await client.query('DELETE FROM asset_history WHERE asset_id = ANY($1)', [assetIds]);
    await client.query('DELETE FROM assets WHERE id = ANY($1)', [assetIds]);
    await client.query('DELETE FROM sessions WHERE employee_id = ANY($1)', [personIds]);
    await client.query('UPDATE asset_history SET employee_id = NULL WHERE employee_id = ANY($1)', [personIds]);
    await client.query('DELETE FROM employees WHERE id = ANY($1)', [personIds]);
    await client.query(`
      DELETE FROM role_permissions WHERE role_id IN (
        SELECT id FROM roles WHERE name ~ '^(Auditor|ScanRole)_[0-9]+$')`);
    await client.query(`DELETE FROM roles WHERE name ~ '^(Auditor|ScanRole)_[0-9]+$'`);
    await client.query(`
      DELETE FROM categories c WHERE c.name ~ '^Test Category [0-9]+$'
        AND NOT EXISTS (SELECT 1 FROM assets a WHERE a.category_id = c.id)`);
    await client.query('COMMIT');
    console.log(`[e2e teardown] removed ${assetIds.length} assets and ${personIds.length} employees`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.warn('[e2e teardown] cleanup failed:', err.message);
  } finally {
    await client.end();
  }
};
