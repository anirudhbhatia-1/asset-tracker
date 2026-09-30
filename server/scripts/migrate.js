#!/usr/bin/env node
// Tracks and applies supabase/migrations/*.sql against a database, recording
// each applied file in `app_migrations` so nothing is ever run twice.
//
//   npm run migrate:status                         what is applied / pending
//   npm run migrate:apply                          apply pending (local DB)
//   node scripts/migrate.js apply --env-file .env.supabase.local --yes
//   node scripts/migrate.js baseline --through <file> --env-file <file> --yes
//        record files up to and including <file> as already applied, without
//        running them (for databases migrated by hand before this tool)
//
// Targets DATABASE_URL from server/.env unless --env-file points elsewhere.
// Non-local databases require --yes. Rollback scripts live in
// supabase/rollbacks/ and are never applied by this tool.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');
const { Client } = require('pg');

const MIGRATIONS_DIR = path.resolve(__dirname, '../../supabase/migrations');
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

const args = process.argv.slice(2);
const command = args[0];
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const confirmed = args.includes('--yes');

const loadDatabaseUrl = () => {
  const envFile = option('--env-file');
  if (envFile) {
    return dotenv.parse(fs.readFileSync(path.resolve(process.cwd(), envFile))).DATABASE_URL;
  }
  require('../loadEnv');
  return process.env.DATABASE_URL;
};

const listMigrationFiles = () => fs.readdirSync(MIGRATIONS_DIR)
  .filter((file) => /^\d{14}_.+\.sql$/.test(file))
  .sort();

const checksum = (sql) => crypto.createHash('sha256').update(sql).digest('hex');

const main = async () => {
  if (!['status', 'apply', 'baseline'].includes(command)) {
    console.log('Usage: migrate.js <status|apply|baseline> [--env-file <file>] [--through <migration file>] [--yes]');
    process.exit(1);
  }

  const databaseUrl = loadDatabaseUrl();
  if (!databaseUrl) throw new Error('DATABASE_URL is not set');
  const { hostname } = new URL(databaseUrl);
  const isLocal = LOCAL_HOSTS.has(hostname);
  console.log(`Database: ${hostname}${isLocal ? ' (local)' : ' (REMOTE)'}`);

  const client = new Client({
    connectionString: databaseUrl,
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    // `status` is read-only: it never creates the tracking table.
    const tableExists = Boolean((await client.query("SELECT to_regclass('public.app_migrations') AS t")).rows[0].t);
    if (!tableExists && command !== 'status') {
      await client.query(`
        CREATE TABLE app_migrations (
          name TEXT PRIMARY KEY,
          checksum TEXT,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          baselined BOOLEAN NOT NULL DEFAULT false
        )`);
    }
    if (!tableExists && command === 'status') {
      console.log('No app_migrations table yet: nothing is recorded. Use `baseline` to record what is already applied.\n');
    }
    const applied = new Map(tableExists || command !== 'status'
      ? (await client.query('SELECT name, checksum, baselined FROM app_migrations')).rows.map((row) => [row.name, row])
      : []);
    const files = listMigrationFiles();
    const pending = files.filter((file) => !applied.has(file));

    if (command === 'status') {
      for (const file of files) {
        const row = applied.get(file);
        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
        const changed = row && row.checksum && row.checksum !== checksum(sql) ? '  (file changed since applied)' : '';
        console.log(`${row ? (row.baselined ? 'baselined' : 'applied  ') : 'PENDING  '}  ${file}${changed}`);
      }
      console.log(`\n${pending.length} pending migration(s).`);
      return;
    }

    if (!isLocal && !confirmed) {
      throw new Error('Refusing to change a remote database without --yes. Take a backup first.');
    }

    if (command === 'baseline') {
      const through = option('--through');
      if (!through || !files.includes(through)) throw new Error('baseline needs --through <existing migration file name>');
      const toMark = files.filter((file) => file <= through && !applied.has(file));
      for (const file of toMark) {
        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
        await client.query('INSERT INTO app_migrations (name, checksum, baselined) VALUES ($1, $2, true)', [file, checksum(sql)]);
        console.log(`baselined  ${file}`);
      }
      console.log(`\nRecorded ${toMark.length} migration(s) as already applied.`);
      return;
    }

    // apply
    if (pending.length === 0) {
      console.log('Nothing to apply.');
      return;
    }
    for (const file of pending) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      const managesOwnTransaction = /^\s*BEGIN\s*;/im.test(sql);
      try {
        if (!managesOwnTransaction) await client.query('BEGIN');
        if (sql.trim()) await client.query(sql);
        await client.query('INSERT INTO app_migrations (name, checksum) VALUES ($1, $2)', [file, checksum(sql)]);
        if (!managesOwnTransaction) await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw new Error(`${file} failed and was rolled back: ${err.message}`);
      }
      console.log(`applied    ${file}`);
    }
    console.log(`\nApplied ${pending.length} migration(s).`);
  } finally {
    await client.end();
  }
};

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
