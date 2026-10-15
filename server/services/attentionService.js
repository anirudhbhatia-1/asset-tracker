// "Needs attention" on the dashboard: short lists of things someone should
// act on, only those the signed-in user may act on or see. A handful of small
// queries, run in parallel.
const { pool } = require('../db');
const { hasPermission } = require('../middleware/validateSession');
const { todayISO, APP_TIMEZONE } = require('../utils/dates');

const MAX_ENTRIES = 5;
const SEVERITY_RANK = { high: 0, medium: 1, low: 2 };

// Warranty window for the dashboard card.
// Same window as Inventory's "Expiring soon" warranty filter (assetService
// getAssets: 60 days), so the card's count matches the list it links to.
const WARRANTY_DAYS = 60;
// The Inventory page's existing Warranty filter value (filterOptions.js).
const WARRANTY_FILTER_LINK = '/inventory?warranty=expiring-soon';

const plural = (n, one, many) => (n === 1 ? one : many);

const addDays = (iso, days) => {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

// 'YYYY-MM-DD' → '12 Oct 2026'.
const formatDate = (iso) => (iso
  ? new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  : 'no date');

// Timestamp → '14:05, 8 Oct' in the company timezone.
const formatTime = (value) => {
  const date = new Date(value);
  const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: APP_TIMEZONE });
  const day = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: APP_TIMEZONE });
  return `${time}, ${day}`;
};

const daysAgo = (days) => {
  if (days <= 0) return 'today';
  return `${days} ${plural(days, 'day', 'days')} ago`;
};

const ticketsQueue = async (user) => {
  const isDirector = user.role === 'director' || user.isDirector;
  if (!isDirector && !user.adminType) return null;
  const params = [];
  let queue = '';
  if (!isDirector) {
    params.push(user.adminType);
    queue = `AND t.current_admin_type = $${params.length}`;
  }
  const { rows } = await pool.query(`
    SELECT t.id, t.title, t.priority, e.name AS employee_name,
           FLOOR(EXTRACT(EPOCH FROM (NOW() - t.created_at)) / 86400)::int AS age_days,
           COUNT(*) OVER ()::int AS total,
           BOOL_OR(t.created_at < NOW() - INTERVAL '3 days' OR t.priority IN ('urgent', 'high')) OVER () AS needs_action
    FROM tickets t
    LEFT JOIN employees e ON e.id = t.employee_id
    WHERE t.status IN ('open', 'in_progress') ${queue}
    -- Most pressing first: urgent, high, then oldest.
    ORDER BY CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
             t.created_at ASC, t.id ASC
    LIMIT ${MAX_ENTRIES}
  `, params);
  if (rows.length === 0) return null;
  const count = rows[0].total;
  // High when anything is urgent/high priority or older than 3 days.
  return {
    key: 'tickets_queue',
    severity: rows[0].needs_action ? 'high' : 'medium',
    title: isDirector
      ? `${count} open ${plural(count, 'ticket', 'tickets')}`
      : `${count} ${plural(count, 'ticket', 'tickets')} waiting in your queue`,
    count,
    link: '/tickets',
    entries: rows.map((row) => ({
      label: row.title,
      sublabel: `${row.priority === 'urgent' || row.priority === 'high' ? `${row.priority === 'urgent' ? 'Urgent' : 'High'} · ` : ''}Raised by ${row.employee_name || 'unknown'} · ${daysAgo(row.age_days)}`,
      link: `/tickets?ticket=${row.id}`,
    })),
  };
};

const ticketsToConfirm = async (user) => {
  const { rows } = await pool.query(`
    SELECT t.id, t.title, t.updated_at, COUNT(*) OVER ()::int AS total
    FROM tickets t
    WHERE t.employee_id = $1 AND t.status = 'resolved'
    ORDER BY t.updated_at ASC, t.id ASC
    LIMIT ${MAX_ENTRIES}
  `, [user.id]);
  if (rows.length === 0) return null;
  const count = rows[0].total;
  return {
    key: 'tickets_confirm',
    severity: 'medium',
    title: `${count} resolved ${plural(count, 'ticket needs', 'tickets need')} your confirmation`,
    count,
    link: '/tickets',
    entries: rows.map((row) => ({
      label: row.title,
      sublabel: 'Resolved · confirm it or reopen it',
      link: `/tickets?ticket=${row.id}`,
    })),
  };
};

const onboardingSoon = async (today) => {
  const { rows } = await pool.query(`
    SELECT o.id, o.new_hire_name, o.joining_date,
           (SELECT COUNT(*) FROM onboarding_request_items i
             WHERE i.onboarding_request_id = o.id AND i.fulfilled_asset_id IS NULL)::int AS to_arrange,
           COUNT(*) OVER ()::int AS total,
           BOOL_OR(o.joining_date <= $2::date) OVER () AS urgent
    FROM onboarding_requests o
    WHERE o.status NOT IN ('completed', 'cancelled', 'arranged')
      AND o.joining_date <= $1::date
    ORDER BY o.joining_date ASC, o.id ASC
    LIMIT ${MAX_ENTRIES}
  `, [addDays(today, 7), addDays(today, 2)]);
  if (rows.length === 0) return null;
  const count = rows[0].total;
  return {
    key: 'onboarding_soon',
    severity: rows[0].urgent ? 'high' : 'medium',
    title: `${count} new ${plural(count, 'hire', 'hires')} joining soon`,
    count,
    link: '/onboarding',
    entries: rows.map((row) => ({
      label: row.new_hire_name,
      sublabel: `Joins ${formatDate(row.joining_date)} · ${row.to_arrange} ${plural(row.to_arrange, 'item', 'items')} to arrange`,
      link: `/onboarding?request=${row.id}`,
    })),
  };
};


// Directors' exits and accounts are only actionable by a Director (offboarding
// and unlocking a Director are refused for everyone else), so other people's
// cards leave them out.
// COALESCE: for people with no role at all (role NULL), e.role = 'director'
// would be NULL, and NOT NULL is still NULL — which would wrongly hide them.
const NOT_A_DIRECTOR_SQL = `NOT (COALESCE(e.role, '') = 'director' OR EXISTS (
  SELECT 1 FROM roles dr WHERE dr.id = e.role_id AND dr.is_director))`;

const offboardingSoon = async (today, includeDirectors = true) => {
  const { rows } = await pool.query(`
    SELECT o.id, e.name AS employee_name, o.last_working_date, held.count AS held,
           COUNT(*) OVER ()::int AS total,
           BOOL_OR(o.last_working_date <= $2::date) OVER () AS urgent
    FROM offboarding_requests o
    JOIN employees e ON e.id = o.employee_id
    CROSS JOIN LATERAL (
      SELECT COUNT(*)::int AS count FROM assets a
      WHERE a.assigned_to = o.employee_id AND a.status = 'in-use'
    ) held
    WHERE o.status IN ('pending', 'in_progress')
      AND o.last_working_date <= $1::date
      AND held.count > 0
      AND (${includeDirectors ? 'TRUE' : NOT_A_DIRECTOR_SQL})
    ORDER BY o.last_working_date ASC, o.id ASC
    LIMIT ${MAX_ENTRIES}
  `, [addDays(today, 7), addDays(today, 2)]);
  if (rows.length === 0) return null;
  const count = rows[0].total;
  return {
    key: 'offboarding_soon',
    severity: rows[0].urgent ? 'high' : 'medium',
    title: `${count} ${plural(count, 'person', 'people')} leaving soon with assets to collect`,
    count,
    link: '/offboarding',
    entries: rows.map((row) => ({
      label: row.employee_name,
      sublabel: `Last day ${formatDate(row.last_working_date)} · ${row.held} ${plural(row.held, 'asset', 'assets')} to collect`,
      link: `/offboarding?request=${row.id}`,
    })),
  };
};

const warrantyExpiring = async (today) => {
  const { rows } = await pool.query(`
    SELECT a.id, a.name, a.warranty_expiry_date, COUNT(*) OVER ()::int AS total
    FROM assets a
    WHERE a.asset_type = 'company' AND a.status <> 'retired'
      AND a.warranty_expiry_date BETWEEN $1::date AND $2::date
    ORDER BY a.warranty_expiry_date ASC, a.id ASC
    LIMIT ${MAX_ENTRIES}
  `, [today, addDays(today, WARRANTY_DAYS)]);
  if (rows.length === 0) return null;
  const count = rows[0].total;
  return {
    key: 'warranty_expiring',
    severity: 'medium',
    title: `${count} ${plural(count, 'warranty expires', 'warranties expire')} in the next ${WARRANTY_DAYS} days`,
    count,
    link: WARRANTY_FILTER_LINK,
    entries: rows.map((row) => ({
      label: row.name,
      sublabel: `Expires ${formatDate(row.warranty_expiry_date)}`,
      link: `/inventory/${row.id}`,
    })),
  };
};

const lowStock = async () => {
  const { rows } = await pool.query(`
    SELECT id, name, location, total_quantity, in_stock, COUNT(*) OVER ()::int AS total
    FROM (
      SELECT s.id, s.name, s.location, s.total_quantity, s.low_stock_threshold,
             s.total_quantity - COALESCE((SELECT SUM(h.quantity) FROM stock_holdings h WHERE h.stock_item_id = s.id), 0) AS in_stock
      FROM stock_items s
      WHERE s.deleted_at IS NULL AND s.low_stock_threshold IS NOT NULL
    ) items
    WHERE in_stock <= low_stock_threshold
    ORDER BY in_stock ASC, name ASC, id ASC
    LIMIT ${MAX_ENTRIES}
  `);
  if (rows.length === 0) return null;
  const count = rows[0].total;
  return {
    key: 'low_stock',
    severity: 'medium',
    title: `${count} bulk ${plural(count, 'item is', 'items are')} running low`,
    count,
    link: '/inventory?view=bulk',
    entries: rows.map((row) => ({
      label: row.location ? `${row.name} (${row.location})` : row.name,
      sublabel: `${Number(row.in_stock)} of ${Number(row.total_quantity)} left`,
      link: '/inventory?view=bulk',
    })),
  };
};

const lockedAccounts = async (includeDirectors = true) => {
  const { rows } = await pool.query(`
    SELECT e.id, e.name, e.locked_until, COUNT(*) OVER ()::int AS total
    FROM employees e
    WHERE e.deleted_at IS NULL AND e.locked_until > NOW()
      AND (${includeDirectors ? 'TRUE' : NOT_A_DIRECTOR_SQL})
    ORDER BY e.locked_until DESC, e.id ASC
    LIMIT ${MAX_ENTRIES}
  `);
  if (rows.length === 0) return null;
  const count = rows[0].total;
  return {
    key: 'locked_accounts',
    severity: 'high',
    title: `${count} ${plural(count, 'account is', 'accounts are')} locked after failed sign-ins`,
    count,
    link: '/employees',
    entries: rows.map((row) => ({
      label: row.name,
      sublabel: `Locked until ${formatTime(row.locked_until)}`,
      // Opens that person on the Employees page (where Unlock is).
      link: row.id ? `/employees?employee=${row.id}` : '/employees',
    })),
  };
};

const passwordChangePending = async () => {
  const { rows: [{ count }] } = await pool.query(`
    SELECT COUNT(*)::int AS count FROM employees
    WHERE deleted_at IS NULL AND password_hash IS NOT NULL AND must_change_password = true
  `);
  if (count === 0) return null;
  return {
    key: 'password_change_pending',
    severity: 'low',
    title: `${count} ${plural(count, "person hasn't", "people haven't")} set their own password yet`,
    count,
    link: '/employees',
    entries: [],
  };
};

const getAttentionItems = async (user, now = new Date()) => {
  const today = todayISO(now);
  const isDirector = hasPermission(user, '*');
  const checks = [];
  if (hasPermission(user, 'tickets:resolve')) checks.push(ticketsQueue(user));
  if (hasPermission(user, 'tickets:read')) checks.push(ticketsToConfirm(user));
  if (hasPermission(user, 'onboarding:fulfill') || hasPermission(user, 'onboarding:read')) checks.push(onboardingSoon(today));
  if (hasPermission(user, 'offboarding:read')) checks.push(offboardingSoon(today, isDirector));
  if (hasPermission(user, 'assets:read')) {
    checks.push(warrantyExpiring(today));
    checks.push(lowStock());
  }
  if (hasPermission(user, 'employees:grant-access')) {
    checks.push(lockedAccounts(isDirector));
    checks.push(passwordChangePending());
  }
  const items = (await Promise.all(checks)).filter((item) => item && item.count > 0);
  items.sort((a, b) => (SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]) || (b.count - a.count));
  return items;
};

module.exports = { getAttentionItems, WARRANTY_FILTER_LINK, formatDate, addDays };
