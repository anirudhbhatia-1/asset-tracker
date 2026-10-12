// Access audit log (table access_audit): who changed whose access, roles,
// passwords and lockouts, and who exported or imported data.
//
// record(executor, entry)
//   executor: a transaction client — the entry commits or rolls back with the
//   change it describes, and a failure aborts that change; or the pool (for
//   events recorded after the work is done) — a failure is logged and never
//   reaches the caller.
const { Pool } = require('pg');
const { pool } = require('../db');
const logger = require('../logger');
const { APP_TIMEZONE } = require('../utils/dates');

const TARGET_TYPES = new Set(['employee', 'role', 'system']);

const toJson = (value) => (value === undefined || value === null ? null : JSON.stringify(value));

const positiveIntOrNull = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
};

const isPool = (executor) => executor === pool || executor instanceof Pool;

const insertEntry = async (executor, entry) => {
  const {
    eventType, actor = null, targetType, targetId = null, targetName = null,
    oldValue = null, newValue = null, details = null,
  } = entry;
  if (!eventType) throw new Error('audit: eventType is required');
  if (!TARGET_TYPES.has(targetType)) throw new Error(`audit: invalid targetType ${targetType}`);
  const ip = entry.ip !== undefined ? entry.ip : (actor && actor.ip) || null;

  // actor_id goes through a lookup so an acting user without an employee row
  // (system jobs, scripts) is stored as NULL instead of breaking the FK.
  const { rows } = await executor.query(`
    INSERT INTO access_audit
      (event_type, actor_id, actor_name, target_type, target_id, target_name, old_value, new_value, details, ip)
    VALUES ($1, (SELECT id FROM employees WHERE id = $2), $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10)
    RETURNING id`, [
    eventType,
    positiveIntOrNull(actor && actor.id),
    actor ? (actor.name || actor.email || null) : 'System',
    targetType,
    positiveIntOrNull(targetId),
    targetName,
    toJson(oldValue),
    toJson(newValue),
    toJson(details),
    ip ? String(ip).slice(0, 100) : null,
  ]);
  return rows[0].id;
};

const record = async (executor, entry) => {
  const target = executor || pool;
  if (!isPool(target)) return insertEntry(target, entry);
  try {
    return await insertEntry(target, entry);
  } catch (err) {
    logger.error({ err, eventType: entry && entry.eventType }, '[audit] Could not record audit event');
    return null;
  }
};

// The request's client address travels with the acting user, without
// appearing in /api/auth/me or any other JSON that includes req.user.
const attachRequestIp = (user, ip) => {
  if (user && typeof user === 'object') {
    Object.defineProperty(user, 'ip', { value: ip || null, enumerable: false, configurable: true, writable: true });
  }
  return user;
};

const mapEntry = (row) => ({
  id: Number(row.id),
  eventType: row.event_type,
  actorId: row.actor_id,
  actorName: row.actor_name,
  targetType: row.target_type,
  targetId: row.target_id,
  targetName: row.target_name,
  oldValue: row.old_value,
  newValue: row.new_value,
  details: row.details,
  createdAt: row.created_at,
});

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

// Filters are pre-validated by the route. Newest first; `before` is the id
// of the last entry of the previous page.
// options.executor (default the pool) and options.timeZone are for tests.
const listEntries = async (filters = {}, { timeZone = APP_TIMEZONE, executor = pool } = {}) => {
  const conditions = [];
  const params = [];
  // `?` in the SQL fragment stands for this value (it may appear twice).
  const add = (sql, value) => {
    params.push(value);
    conditions.push(sql.replaceAll('?', `$${params.length}`));
  };
  const escapeLike = (text) => String(text).replace(/[\\%_]/g, '\\$&');

  if (filters.eventType) {
    // "employee." matches every employee event; "employee.role_changed"
    // matches exactly (and anything nested below it).
    // A comma-separated list matches any of its items.
    const types = String(filters.eventType).split(',').map((item) => item.trim()).filter(Boolean);
    const exact = types.filter((item) => !item.endsWith('.'));
    const prefixes = [...types.filter((item) => item.endsWith('.')), ...exact.map((item) => `${item}.`)];
    params.push(exact, prefixes);
    conditions.push(`(event_type = ANY($${params.length - 1}::text[])
      OR EXISTS (SELECT 1 FROM unnest($${params.length}::text[]) AS prefix WHERE starts_with(event_type, prefix)))`);
  }
  if (filters.actorId) add('actor_id = ?', Number(filters.actorId));
  if (filters.targetType) add('target_type = ?', filters.targetType);
  if (filters.targetId) add('target_id = ?', Number(filters.targetId));
  // Dates are whole calendar days in the company's time zone (APP_TIMEZONE),
  // whatever the database session's time zone is; `to` is inclusive.
  if (filters.from || filters.to) params.push(timeZone);
  const tzParam = `$${params.length}`;
  if (filters.from) add(`created_at >= ((?::date)::timestamp AT TIME ZONE ${tzParam})`, filters.from);
  if (filters.to) add(`created_at < ((?::date + 1)::timestamp AT TIME ZONE ${tzParam})`, filters.to);
  if (filters.q) add('(actor_name ILIKE ? OR target_name ILIKE ?)', `%${escapeLike(filters.q)}%`);
  if (filters.before) add('id < ?', Number(filters.before));

  const limit = Math.min(Math.max(Number(filters.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  params.push(limit + 1);
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await executor.query(
    `SELECT * FROM access_audit ${where} ORDER BY id DESC LIMIT $${params.length}`, params
  );

  const page = rows.slice(0, limit).map(mapEntry);
  return {
    data: page,
    nextCursor: rows.length > limit ? page[page.length - 1].id : null,
  };
};

module.exports = {
  record,
  listEntries,
  attachRequestIp,
  DEFAULT_LIMIT,
  MAX_LIMIT,
};
