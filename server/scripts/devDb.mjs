// Local development database: a real PostgreSQL 17 server (the same major
// version as production) run from the embedded-postgres npm package and
// stored in server/.devdb-pg, so the app connects to it exactly like Supabase
// and never touches production data.
//
//   npm run db          start (creates, migrates and seeds on first run)
//   npm run db:reset    wipe local data and start fresh
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import bcrypt from 'bcrypt';

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = path.resolve(serverDir, '../supabase/migrations');
const dataDir = path.join(serverDir, '.devdb-pg');
const port = Number(process.env.DEV_DB_PORT || 54322);
const credentials = { user: 'postgres', password: 'postgres' };

// Test logins only; every account uses the password below.
const TEST_PASSWORD = 'password';
const TEST_ACCOUNTS = [
  { name: 'Test Director', email: 'admin@company.com', roleId: 1, role: 'director', adminType: null },
  { name: 'Test IT Admin', email: 'itadmin@company.com', roleId: 2, role: 'admin', adminType: 'it' },
  { name: 'Test Hardware Admin', email: 'hardwareadmin@company.com', roleId: 2, role: 'admin', adminType: 'hardware' },
  { name: 'Test HR', email: 'hr@company.com', roleId: 3, role: 'hr', adminType: 'hr' },
  { name: 'Test Employee', email: 'employee@company.com', roleId: 4, role: 'employee', adminType: null },
];

const CATEGORIES = [
  ['Laptop', 'L', 'Indigo', 'MacBooks, ThinkPads and Workstations'],
  ['Monitor', 'M', 'Blue', 'External 4K and UltraWide monitors'],
  ['Keyboard & Mouse', 'K', 'Teal', 'Mechanical keyboards, ergonomics, trackpads'],
  ['Audio & Headset', 'A', 'Purple', 'Noise-canceling headphones, headsets, and microphones'],
  ['Adaptor', 'A', 'Blue', 'Chargers and power adaptors'],
  ['Laptop Stand', 'L', 'Indigo', 'Laptop stands and risers'],
  ['Mobile Phone', 'M', 'Purple', 'Company mobile phones'],
  ['Monitor Mount', 'M', 'Teal', 'Monitor arms and mounts'],
  ['USB Hub', 'U', 'Cyan', 'USB hubs and docks'],
];

// Refuse to start a second server on the same data directory.
const portInUse = await new Promise((resolve) => {
  const socket = net.connect({ port, host: '127.0.0.1' });
  socket.once('connect', () => { socket.destroy(); resolve(true); });
  socket.once('error', () => resolve(false));
});
if (portInUse) {
  console.log(`[devdb] Port ${port} is already in use - a local database (another \`npm run dev\`?) is probably running.`);
  console.log('[devdb] Not starting a second copy. Stop the other one first if the app cannot connect.');
  process.exit(0);
}

if (process.argv.includes('--reset')) {
  fs.rmSync(dataDir, { recursive: true, force: true });
  console.log('[devdb] Local database wiped');
}

const isNew = !fs.existsSync(path.join(dataDir, 'PG_VERSION'));
const postgres = new EmbeddedPostgres({
  databaseDir: dataDir,
  port,
  ...credentials,
  persistent: true,
  onLog: () => {},
  onError: (message) => console.error('[devdb]', String(message).trim()),
});

if (isNew) {
  // A half-created directory from an interrupted first run can't be reused.
  fs.rmSync(dataDir, { recursive: true, force: true });
  await postgres.initialise();
}
await postgres.start();

const client = new pg.Client({ host: '127.0.0.1', port, database: 'postgres', ...credentials });
await client.connect();

// Apply any migration not yet applied, in filename order, each in its own
// transaction (files that manage their own BEGIN/COMMIT run as they are).
const migrate = async () => {
  await client.query('CREATE TABLE IF NOT EXISTS _dev_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW())');
  const applied = new Set((await client.query('SELECT name FROM _dev_migrations')).rows.map((row) => row.name));
  const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const managesOwnTransaction = /^\s*BEGIN\s*;/im.test(sql);
    try {
      if (!managesOwnTransaction) await client.query('BEGIN');
      if (sql.trim()) await client.query(sql);
      await client.query('INSERT INTO _dev_migrations (name) VALUES ($1)', [file]);
      if (!managesOwnTransaction) await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error(`[devdb] Migration ${file} failed: ${err.message}`);
      throw err;
    }
    console.log(`[devdb] Applied ${file}`);
  }
};

const seed = async () => {
  for (const [name, badge, color, description] of CATEGORIES) {
    await client.query(
      `INSERT INTO categories (name, badge_char, color, description) VALUES ($1, $2, $3, $4)
       ON CONFLICT (name) DO NOTHING`,
      [name, badge, color, description]
    );
  }

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
  for (const account of TEST_ACCOUNTS) {
    await client.query(
      `INSERT INTO employees (name, email, password_hash, role, role_id, admin_type, department, location)
       VALUES ($1, $2, $3, $4, $5, $6, 'IT', 'Bangalore')
       ON CONFLICT (email) DO UPDATE SET
         name = EXCLUDED.name, password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
         role_id = EXCLUDED.role_id, admin_type = EXCLUDED.admin_type, deleted_at = NULL,
         must_change_password = false`,
      [account.name, account.email, passwordHash, account.role, account.roleId, account.adminType]
    );
  }
  console.log(`[devdb] Seeded categories and test accounts (password: "${TEST_PASSWORD}")`);
};

try {
  await migrate();
  if (isNew) await seed();
} finally {
  await client.end();
}
console.log(`[devdb] Local Postgres ready at postgresql://postgres:postgres@127.0.0.1:${port}/postgres`);

const shutdown = async () => {
  await postgres.stop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
