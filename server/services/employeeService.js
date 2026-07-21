const db = require('../db');

const mapEmployee = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    department: row.department || null,
    location: row.location || null,
    googleId: row.google_id || null,
    avatarUrl: row.avatar_url || null,
    isGoogleSynced: Boolean(row.is_google_synced),
    deletedAt: row.deleted_at || null,
    createdAt: row.created_at,
    assignedAssetsCount: row.assigned_assets_count !== undefined ? Number(row.assigned_assets_count) : undefined,
  };
};

// Helper to map assets when returning getEmployeeAssets
const mapAssetMini = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    categoryId: row.category_id,
    categoryName: row.category_name || null,
    categoryBadgeChar: row.category_badge_char || null,
    categoryColor: row.category_color || null,
    model: row.model || null,
    serialNumber: row.serial_number,
    status: row.status,
    location: row.location || null,
    costCents: row.cost_cents || 0,
    purchaseDate: row.purchase_date || null,
    notes: row.notes || null,
    assignedTo: row.assigned_to,
    assignedDate: row.assigned_date || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const getEmployees = (filters = {}) => {
  const conditions = [];
  const params = [];

  // Default: exclude soft-deleted unless explicitly requested
  if (filters.includeDeleted !== 'true' && filters.includeDeleted !== true) {
    conditions.push('e.deleted_at IS NULL');
  }

  if (filters.location) {
    conditions.push('e.location = ?');
    params.push(filters.location);
  }

  if (filters.department) {
    conditions.push('e.department = ?');
    params.push(filters.department);
  }

  if (filters.q) {
    conditions.push('(e.name LIKE ? OR e.email LIKE ?)');
    const likeQuery = `%${filters.q}%`;
    params.push(likeQuery, likeQuery);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT e.id, e.name, e.email, e.department, e.location, e.google_id,
           e.avatar_url, e.is_google_synced, e.deleted_at, e.created_at,
           COUNT(CASE WHEN a.status = 'in-use' THEN a.id END) AS assigned_assets_count
    FROM employees e
    LEFT JOIN assets a ON e.id = a.assigned_to
    ${whereClause}
    GROUP BY e.id
    ORDER BY e.name ASC
  `;

  const rows = db.prepare(sql).all(...params);
  return rows.map(mapEmployee);
};

const getEmployeeById = (id) => {
  const row = db.prepare(`
    SELECT e.id, e.name, e.email, e.department, e.location, e.google_id,
           e.avatar_url, e.is_google_synced, e.deleted_at, e.created_at,
           COUNT(CASE WHEN a.status = 'in-use' THEN a.id END) AS assigned_assets_count
    FROM employees e
    LEFT JOIN assets a ON e.id = a.assigned_to
    WHERE e.id = ?
    GROUP BY e.id
  `).get(id);

  if (!row) {
    const err = new Error('Employee not found');
    err.statusCode = 404;
    throw err;
  }
  return mapEmployee(row);
};

const getEmployeeAssets = (id) => {
  getEmployeeById(id); // throws 404 if employee does not exist

  const rows = db.prepare(`
    SELECT a.*, c.name AS category_name, c.badge_char AS category_badge_char, c.color AS category_color
    FROM assets a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.assigned_to = ? AND a.status = 'in-use'
    ORDER BY a.assigned_date DESC, a.name ASC
  `).all(id);

  return rows.map(mapAssetMini);
};

const createEmployee = (data) => {
  const { name, email, department, location, googleId, avatarUrl } = data;

  // Check unique email
  const existing = db.prepare('SELECT id FROM employees WHERE email = ?').get(email);
  if (existing) {
    const err = new Error('Employee email already exists');
    err.statusCode = 409;
    throw err;
  }

  const result = db.prepare(`
    INSERT INTO employees (name, email, department, location, google_id, avatar_url, is_google_synced, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'))
  `).run(name, email, department ?? null, location ?? null, googleId ?? null, avatarUrl ?? null);

  return getEmployeeById(result.lastInsertRowid);
};

const updateEmployee = (id, data) => {
  const current = getEmployeeById(id);
  const { name, email, department, location, avatarUrl } = data;

  if (email && email !== current.email) {
    const existing = db.prepare('SELECT id FROM employees WHERE email = ? AND id != ?').get(email, id);
    if (existing) {
      const err = new Error('Employee email already exists');
      err.statusCode = 409;
      throw err;
    }
  }

  db.prepare(`
    UPDATE employees
    SET name = ?,
        email = ?,
        department = ?,
        location = ?,
        avatar_url = ?
    WHERE id = ?
  `).run(
    name !== undefined ? name : current.name,
    email !== undefined ? email : current.email,
    department !== undefined ? department : current.department,
    location !== undefined ? location : current.location,
    avatarUrl !== undefined ? avatarUrl : current.avatarUrl,
    id
  );

  return getEmployeeById(id);
};

const deleteEmployee = (id) => {
  const current = getEmployeeById(id); // throws 404 if not found
  if (current.deletedAt !== null) {
    const err = new Error('Employee is already deleted');
    err.statusCode = 400;
    throw err;
  }

  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  db.prepare('UPDATE employees SET deleted_at = ? WHERE id = ?').run(timestamp, id);

  return { id: Number(id), deleted: true, deletedAt: timestamp };
};

module.exports = {
  getEmployees,
  getEmployeeById,
  getEmployeeAssets,
  createEmployee,
  updateEmployee,
  deleteEmployee,
};
