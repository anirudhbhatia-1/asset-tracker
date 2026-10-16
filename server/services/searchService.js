// Global search (the command palette): a few matches per kind of record,
// only for the kinds the user may read. One small query per group, run in
// parallel.
const { pool } = require('../db');
const { hasPermission } = require('../middleware/validateSession');
const { canSeeAllTickets } = require('./ticketService');

const { escapeLike } = require('../utils/like');

// '#123', '123' or 'TK-0123' name a ticket by id.
const ticketIdFrom = (q) => {
  const match = /^(?:#|tk-?)?\s*(\d{1,9})$/i.exec(q.trim());
  return match ? Number(match[1]) : null;
};

const searchAssets = async (pattern, q, limit) => {
  const { rows } = await pool.query(`
    SELECT a.id, a.name, a.serial_number, a.status, a.asset_type,
           c.name AS category_name, e.name AS assigned_to_name
    FROM assets a
    LEFT JOIN categories c ON c.id = a.category_id
    LEFT JOIN employees e ON e.id = a.assigned_to AND a.status = 'in-use'
    WHERE a.name ILIKE $1 OR a.serial_number ILIKE $1 OR a.model ILIKE $1 OR a.brand ILIKE $1
    ORDER BY (LOWER(a.serial_number) = LOWER($2)) DESC, (a.name ILIKE $3) DESC, a.name, a.id
    LIMIT $4
  `, [`%${pattern}%`, q, `${pattern}%`, limit]);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    serialNumber: row.serial_number,
    status: row.status,
    assetType: row.asset_type || 'company',
    categoryName: row.category_name || null,
    assignedToName: row.assigned_to_name || null,
  }));
};

const searchStock = async (pattern, limit) => {
  const { rows } = await pool.query(`
    SELECT s.id, s.name, s.location, s.total_quantity,
           s.total_quantity - COALESCE((SELECT SUM(h.quantity) FROM stock_holdings h WHERE h.stock_item_id = s.id), 0) AS in_stock
    FROM stock_items s
    WHERE s.deleted_at IS NULL AND s.name ILIKE $1
    ORDER BY (s.name ILIKE $2) DESC, s.name, s.location NULLS FIRST, s.id
    LIMIT $3
  `, [`%${pattern}%`, `${pattern}%`, limit]);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    location: row.location || null,
    inStock: Number(row.in_stock),
    totalQuantity: Number(row.total_quantity),
  }));
};

const searchEmployees = async (pattern, limit) => {
  const { rows } = await pool.query(`
    SELECT e.id, e.name, e.email, e.department, e.work_mode,
           (e.password_hash IS NOT NULL OR e.google_id IS NOT NULL OR e.role IS NOT NULL) AS has_login
    FROM employees e
    WHERE e.deleted_at IS NULL
      AND (e.name ILIKE $1 OR e.email ILIKE $1 OR e.department ILIKE $1)
    ORDER BY (e.name ILIKE $2) DESC, e.name, e.id
    LIMIT $3
  `, [`%${pattern}%`, `${pattern}%`, limit]);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    department: row.department || null,
    workMode: row.work_mode || 'office',
    hasLogin: Boolean(row.has_login),
    deleted: false,
  }));
};

const searchTickets = async (user, pattern, q, limit) => {
  const params = [`%${pattern}%`, ticketIdFrom(q), limit];
  // Same visibility as the ticket list and detail: non-resolvers see only
  // their own tickets.
  let visibility = '';
  if (!canSeeAllTickets(user)) {
    params.push(user.id);
    visibility = `AND t.employee_id = $${params.length}`;
  }
  const { rows } = await pool.query(`
    SELECT t.id, t.title, t.status, t.type, t.created_at, e.name AS employee_name
    FROM tickets t
    LEFT JOIN employees e ON e.id = t.employee_id
    WHERE (t.title ILIKE $1 OR t.id = $2::int) ${visibility}
    ORDER BY (t.id = $2::int) IS TRUE DESC, t.created_at DESC, t.id DESC
    LIMIT $3
  `, params);
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    type: row.type,
    employeeName: row.employee_name || null,
    createdAt: row.created_at,
  }));
};

const searchOnboarding = async (pattern, limit) => {
  const { rows } = await pool.query(`
    SELECT o.id, o.new_hire_name, o.joining_date, o.status
    FROM onboarding_requests o
    WHERE o.new_hire_name ILIKE $1 OR o.new_hire_email ILIKE $1
    ORDER BY (o.status IN ('completed', 'cancelled')), o.joining_date DESC NULLS LAST, o.id DESC
    LIMIT $2
  `, [`%${pattern}%`, limit]);
  return rows.map((row) => ({
    id: row.id,
    newHireName: row.new_hire_name,
    joiningDate: row.joining_date || null,
    status: row.status,
  }));
};

const searchOffboarding = async (pattern, limit) => {
  const { rows } = await pool.query(`
    SELECT o.id, e.name AS employee_name, o.last_working_date, o.status
    FROM offboarding_requests o
    JOIN employees e ON e.id = o.employee_id
    WHERE e.name ILIKE $1 OR e.email ILIKE $1
    ORDER BY (o.status IN ('pending', 'in_progress')) DESC, o.last_working_date DESC NULLS LAST, o.id DESC
    LIMIT $2
  `, [`%${pattern}%`, limit]);
  return rows.map((row) => ({
    id: row.id,
    employeeName: row.employee_name,
    lastWorkingDate: row.last_working_date || null,
    status: row.status,
  }));
};

/**
 * Searches every group the user may read. Groups the user can't read are
 * left out of the result entirely (no key), not returned empty.
 */
const search = async (user, q, limit) => {
  const pattern = escapeLike(q);
  const groups = {};
  if (hasPermission(user, 'assets:read')) {
    groups.assets = searchAssets(pattern, q, limit);
    groups.stock = searchStock(pattern, limit);
  }
  if (hasPermission(user, 'employees:read')) groups.employees = searchEmployees(pattern, limit);
  if (hasPermission(user, 'tickets:read')) groups.tickets = searchTickets(user, pattern, q, limit);
  if (hasPermission(user, 'onboarding:read')) groups.onboarding = searchOnboarding(pattern, limit);
  if (hasPermission(user, 'offboarding:read')) groups.offboarding = searchOffboarding(pattern, limit);

  const keys = Object.keys(groups);
  const results = await Promise.all(keys.map((key) => groups[key]));
  return Object.fromEntries(keys.map((key, i) => [key, results[i]]));
};

module.exports = { search, escapeLike, ticketIdFrom };
