const { pool, withTransaction } = require('../db');
const mapEmployee = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    department: row.department || null,
    location: row.location || null,
    address: row.address || null,
    googleId: row.google_id || null,
    avatarUrl: row.avatar_url || null,
    isGoogleSynced: Boolean(row.is_google_synced),
    deletedAt: row.deleted_at || null,
    createdAt: row.created_at,
    assignedAssetsCount: row.assigned_assets_count !== undefined ? Number(row.assigned_assets_count) : undefined,
    role: row.role || null,
    hasLogin: row.has_login !== undefined ? Boolean(row.has_login) : (row.password_hash != null || row.google_id != null || Boolean(row.role)),
  };
};

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

const getEmployees = async (filters = {}) => {
  const conditions = [];
  const params = [];

  if (filters.includeDeleted !== 'true' && filters.includeDeleted !== true) {
    conditions.push('e.deleted_at IS NULL');
  }

  if (filters.location) {
    params.push(filters.location);
    conditions.push(`e.location = $${params.length}`);
  }

  if (filters.department) {
    params.push(filters.department);
    conditions.push(`e.department = $${params.length}`);
  }

  if (filters.q) {
    const likeQuery = `%${filters.q}%`;
    params.push(likeQuery);
    const pos = params.length;
    conditions.push(`(e.name ILIKE $${pos} OR e.email ILIKE $${pos})`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT e.id, e.name, e.email, e.department, e.location, e.address, e.google_id,
           e.avatar_url, e.is_google_synced, e.deleted_at, e.created_at,
           e.role,
           COUNT(CASE WHEN a.status = 'in-use' THEN a.id END) AS assigned_assets_count
    FROM employees e
    LEFT JOIN assets a ON e.id = a.assigned_to
    ${whereClause}
    GROUP BY e.id
    ORDER BY e.name ASC
  `;

  const result = await pool.query(sql, params);
  return result.rows.map(mapEmployee);
};

const getEmployeeById = async (id) => {
  const result = await pool.query(`
    SELECT e.id, e.name, e.email, e.department, e.location, e.address, e.google_id,
           e.avatar_url, e.is_google_synced, e.deleted_at, e.created_at,
           e.role,
           COUNT(CASE WHEN a.status = 'in-use' THEN a.id END) AS assigned_assets_count
    FROM employees e
    LEFT JOIN assets a ON e.id = a.assigned_to
    WHERE e.id = $1
    GROUP BY e.id
  `, [id]);

  if (result.rows.length === 0) {
    const err = new Error('Employee not found');
    err.statusCode = 404;
    throw err;
  }
  return mapEmployee(result.rows[0]);
};

const getDepartments = async () => {
  const result = await pool.query(`
    SELECT DISTINCT department
    FROM employees
    WHERE department IS NOT NULL AND department != ''
    ORDER BY department ASC
  `);
  return result.rows.map(row => row.department);
};

const getEmployeeAssets = async (id) => {
  await getEmployeeById(id);

  const result = await pool.query(`
    SELECT a.*, c.name AS category_name, c.badge_char AS category_badge_char, c.color AS category_color
    FROM assets a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.assigned_to = $1 AND a.status = 'in-use'
    ORDER BY a.assigned_date DESC, a.name ASC
  `, [id]);

  return result.rows.map(mapAssetMini);
};

const createEmployee = async (data) => {
  const { name, email, department, location, address, googleId, avatarUrl } = data;

  const existing = await pool.query('SELECT id FROM employees WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    const err = new Error('Employee email already exists');
    err.statusCode = 409;
    throw err;
  }

  const result = await pool.query(`
    INSERT INTO employees (name, email, department, location, address, google_id, avatar_url, is_google_synced, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, 0, NOW())
    RETURNING id
  `, [name, email, department ?? null, location ?? null, address ?? null, googleId ?? null, avatarUrl ?? null]);

  return getEmployeeById(result.rows[0].id);
};

const validateCorporateEmail = (email) => {
  const allowedDomains = ['@company.com', '@thinkvibes.com'];
  if (!email || !allowedDomains.some(domain => email.toLowerCase().endsWith(domain))) {
    const err = new Error('Login access can only be granted to corporate emails (@company.com or @thinkvibes.com)');
    err.statusCode = 403;
    throw err;
  }
};

/**
 * Creates an employee profile AND a login account in a single transaction.
 * Used when admin wants to provision login access at creation time.
 * Returns { employee, temporaryPassword }
 */
const createEmployeeWithAccess = async (data) => {
  const bcrypt = require('bcrypt');
  const crypto = require('crypto');
  const { name, email, department, location, address, role } = data;

  validateCorporateEmail(email);

  // Check duplicate before starting transaction
  const existing = await pool.query('SELECT id FROM employees WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    const err = new Error('Employee email already exists');
    err.statusCode = 409;
    throw err;
  }

  const temporaryPassword = crypto.randomBytes(6).toString('hex'); // 12 chars
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);

  const result = await pool.query(`
    INSERT INTO employees (name, email, department, location, address, google_id, avatar_url, is_google_synced, password_hash, role, created_at)
    VALUES ($1, $2, $3, $4, $5, NULL, NULL, 0, $6, $7, NOW())
    RETURNING id
  `, [name, email, department ?? null, location ?? null, address ?? null, passwordHash, role]);

  const employee = await getEmployeeById(result.rows[0].id);
  return { employee, temporaryPassword };
};

const updateEmployee = async (id, data) => {
  const current = await getEmployeeById(id);
  const { name, email, department, location, address, avatarUrl, role } = data;

  if (email && email !== current.email) {
    const existing = await pool.query('SELECT id FROM employees WHERE email = $1 AND id != $2', [email, id]);
    if (existing.rows.length > 0) {
      const err = new Error('Employee email already exists');
      err.statusCode = 409;
      throw err;
    }
  }

  await pool.query(`
    UPDATE employees
    SET name = $1,
        email = $2,
        department = $3,
        location = $4,
        address = $5,
        avatar_url = $6,
        role = $7
    WHERE id = $8
  `, [
    name !== undefined ? name : current.name,
    email !== undefined ? email : current.email,
    department !== undefined ? department : current.department,
    location !== undefined ? location : current.location,
    address !== undefined ? address : current.address,
    avatarUrl !== undefined ? avatarUrl : current.avatarUrl,
    role !== undefined ? role : current.role,
    id
  ]);

  return getEmployeeById(id);
};

const deleteEmployee = async (id) => {
  const current = await getEmployeeById(id);

  if (current.deletedAt) {
    return { id: Number(id), deleted: true };
  }

  // Soft delete
  await pool.query('UPDATE employees SET deleted_at = NOW() WHERE id = $1', [id]);
  return { id: Number(id), deleted: true };
};

const updateEmployeeRole = async (id, role) => {
  await pool.query(
    'UPDATE employees SET role = $1, updated_at = NOW() WHERE id = $2',
    [role, id]
  );
  // Return the full employee object, same as getEmployeeById
  const result = await pool.query(
    `SELECT e.*,
            (e.password_hash IS NOT NULL OR e.google_id IS NOT NULL OR e.role IS NOT NULL) AS has_login
     FROM employees e
     WHERE e.id = $1 AND e.deleted_at IS NULL`,
    [id]
  );
  if (result.rows.length === 0) throw Object.assign(new Error('Employee not found'), { statusCode: 404 });
  return mapEmployee(result.rows[0]);
};

const grantEmployeeAccess = async (id, role, passwordHash) => {
  const current = await getEmployeeById(id);

  validateCorporateEmail(current.email);

  if (current.hasLogin) {
    const err = new Error('Employee already has a login account');
    err.statusCode = 400;
    throw err;
  }

  await pool.query(
    'UPDATE employees SET password_hash = $1, role = $2 WHERE id = $3',
    [passwordHash, role, id]
  );

  return getEmployeeById(id);
};

// ============================================================
// TESTING ONLY — Grant Google login access (no password)
// WHEN GOING TO PRODUCTION: Remove this function.
// Google-login employees will be created via Workspace sync.
// ============================================================
const grantGoogleAccess = async (id) => {
  return withTransaction(async (client) => {
    const current = await getEmployeeById(id);

    validateCorporateEmail(current.email);

    if (current.hasLogin) {
      const err = new Error('Employee already has a login account');
      err.statusCode = 400;
      throw err;
    }
    // Set role to 'employee', leave password_hash as NULL (already nullable).
    // This account can ONLY log in via Google — not via email/password.
    await client.query(
      'UPDATE employees SET role = $1 WHERE id = $2',
      ['employee', id]
    );
    return getEmployeeById(id);
  });
};

module.exports = {
  getEmployees,
  getEmployeeById,
  getEmployeeAssets,
  getDepartments,
  createEmployee,
  createEmployeeWithAccess,
  updateEmployee,
  deleteEmployee,
  updateEmployeeRole,
  grantEmployeeAccess,
  grantGoogleAccess,
};
