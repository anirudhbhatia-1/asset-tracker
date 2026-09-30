// Local development database: an embedded Postgres (PGlite) stored in
// server/.devdb and served over the normal Postgres protocol, so the app
// connects to it exactly like Supabase and never touches production data.
//
//   npm run db          start (creates, migrates and seeds on first run)
//   npm run db:reset    wipe local data and start fresh
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import bcrypt from 'bcrypt';

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = path.resolve(serverDir, '../supabase/migrations');
const dataDir = path.join(serverDir, '.devdb');
const port = Number(process.env.DEV_DB_PORT || 54322);

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

if (process.argv.includes('--reset')) {
  fs.rmSync(dataDir, { recursive: true, force: true });
  console.log('[devdb] Local database wiped');
}

const isNew = !fs.existsSync(dataDir);
const db = await PGlite.create(dataDir);

// Apply any migration not yet applied, in filename order, so new files in
// supabase/migrations are picked up on the next start.
const migrate = async () => {
  await db.exec('CREATE TABLE IF NOT EXISTS _dev_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW())');
  const applied = new Set((await db.query('SELECT name FROM _dev_migrations')).rows.map((row) => row.name));
  const files = fs.readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql') && !file.includes('rollback'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    if (sql.trim()) await db.exec(sql);
    await db.query('INSERT INTO _dev_migrations (name) VALUES ($1)', [file]);
    console.log(`[devdb] Applied ${file}`);
  }
};

const seed = async () => {
  for (const [name, badge, color, description] of CATEGORIES) {
    await db.query(
      `INSERT INTO categories (name, badge_char, color, description) VALUES ($1, $2, $3, $4)
       ON CONFLICT (name) DO NOTHING`,
      [name, badge, color, description]
    );
  }

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
  for (const account of TEST_ACCOUNTS) {
    await db.query(
      `INSERT INTO employees (name, email, password_hash, role, role_id, admin_type, department, location)
       VALUES ($1, $2, $3, $4, $5, $6, 'IT', 'Bangalore')
       ON CONFLICT (email) DO UPDATE SET
         name = EXCLUDED.name, password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
         role_id = EXCLUDED.role_id, admin_type = EXCLUDED.admin_type, deleted_at = NULL`,
      [account.name, account.email, passwordHash, account.role, account.roleId, account.adminType]
    );
  }
  console.log(`[devdb] Seeded categories and test accounts (password: "${TEST_PASSWORD}")`);
};

await migrate();
if (isNew) await seed();

const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1', maxConnections: 10 });
await server.start();
console.log(`[devdb] Local Postgres ready at postgresql://postgres:postgres@127.0.0.1:${port}/postgres`);

const shutdown = async () => {
  await server.stop();
  await db.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
