const { pool, withTransaction } = require('../db');
const { hasPermission, expandPermissions, getDefaultPermissionsForRole } = require('../middleware/validateSession');

const OPEN_OFFBOARDING_SQL = `(
  SELECT json_build_object('id', o.id, 'lastWorkingDate', o.last_working_date, 'status', o.status)
  FROM offboarding_requests o
  WHERE o.employee_id = e.id AND o.status IN ('pending', 'in_progress')
  LIMIT 1)`;

const mapEmployee = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    department: row.department || null,
    location: row.location || null,
    address: row.address || null,
    workMode: row.work_mode || 'office',
    googleId: row.google_id || null,
    avatarUrl: row.avatar_url || null,
    isGoogleSynced: Boolean(row.is_google_synced),
    deletedAt: row.deleted_at || null,
    createdAt: row.created_at,
    assignedAssetsCount: row.assigned_assets_count !== undefined ? Number(row.assigned_assets_count) : undefined,
    role: row.role || null,
    roleId: row.role_id || null,
    roleName: row.role_name || row.role || null,
    customRoleName: row.custom_role_name || row.role_name || row.role || null,
    adminType: row.admin_type || null,
    // The open exit, if one is in progress: { id, lastWorkingDate, status }.
    offboarding: row.offboarding || null,
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

  if (filters.workMode) {
    params.push(filters.workMode);
    conditions.push(`e.work_mode = $${params.length}`);
  }

  if (filters.q) {
    const likeQuery = `%${filters.q}%`;
    params.push(likeQuery);
    const pos = params.length;
    conditions.push(`(e.name ILIKE $${pos} OR e.email ILIKE $${pos})`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT e.id, e.name, e.email, e.department, e.location, e.address, e.work_mode, e.google_id,
           e.avatar_url, e.is_google_synced, e.deleted_at, e.created_at,
           e.role, e.role_id, e.admin_type, e.password_hash,
           r.name as role_name, r.name as custom_role_name,
           COUNT(CASE WHEN a.status = 'in-use' THEN a.id END) AS assigned_assets_count,
           ${OPEN_OFFBOARDING_SQL} AS offboarding
    FROM employees e
    LEFT JOIN roles r ON e.role_id = r.id
    LEFT JOIN assets a ON e.id = a.assigned_to
    ${whereClause}
    GROUP BY e.id, r.id
    ORDER BY e.name ASC
  `;

  const result = await pool.query(sql, params);
  return result.rows.map(mapEmployee);
};

const getEmployeeById = async (id) => {
  const result = await pool.query(`
    SELECT e.id, e.name, e.email, e.department, e.location, e.address, e.work_mode, e.google_id,
           e.avatar_url, e.is_google_synced, e.deleted_at, e.created_at,
           e.role, e.role_id, e.admin_type, e.password_hash,
           r.name as role_name, r.name as custom_role_name,
           COUNT(CASE WHEN a.status = 'in-use' THEN a.id END) AS assigned_assets_count,
           ${OPEN_OFFBOARDING_SQL} AS offboarding
    FROM employees e
    LEFT JOIN roles r ON e.role_id = r.id
    LEFT JOIN assets a ON e.id = a.assigned_to
    WHERE e.id = $1
    GROUP BY e.id, r.id
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
    WHERE department IS NOT NULL AND department != '' AND deleted_at IS NULL
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

// Domains whose addresses may get a login, from LOGIN_EMAIL_DOMAINS
// (comma-separated); defaults to the original company.com and thinkvibes.com.
const getLoginEmailDomains = (environment = process.env) => (
  (environment.LOGIN_EMAIL_DOMAINS || 'company.com,thinkvibes.com')
    .split(',')
    .map((domain) => domain.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean)
);

const validateCorporateEmail = (email) => {
  const allowedDomains = getLoginEmailDomains();
  const emailDomain = String(email || '').toLowerCase().split('@')[1];
  if (!emailDomain || !allowedDomains.includes(emailDomain)) {
    const err = new Error(`Login access can only be granted to corporate emails (${allowedDomains.map((domain) => `@${domain}`).join(' or ')})`);
    err.statusCode = 403;
    throw err;
  }
};

// Directory entry only: no role means no login until access is granted.
// googleId is deliberately not accepted from callers.
const createEmployee = async (data) => {
  const { name, department, location, address, avatarUrl } = data;
  const workMode = data.workMode || 'office';
  const email = String(data.email).trim().toLowerCase();

  const existing = await pool.query('SELECT id FROM employees WHERE LOWER(email) = $1', [email]);
  if (existing.rows.length > 0) {
    const err = new Error('Employee email already exists');
    err.statusCode = 409;
    throw err;
  }

  const result = await pool.query(`
    INSERT INTO employees (name, email, department, location, address, avatar_url, work_mode, is_google_synced, role, role_id, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, 0, NULL, NULL, NOW())
    RETURNING id
  `, [name, email, department ?? null, location ?? null, address ?? null, avatarUrl ?? null, workMode]);

  return getEmployeeById(result.rows[0].id);
};

const BASE_SYSTEM_ROLES = ['director', 'admin', 'hr', 'employee'];

const forbidden = (message) => {
  const err = new Error(message);
  err.statusCode = 403;
  return err;
};

// Resolves a role by id or name, including the permissions it effectively
// grants (roles without DB permissions fall back to the base-role defaults,
// mirroring validateSession).
const resolveRole = async (roleOrRoleId) => {
  const isNumeric = roleOrRoleId !== null && roleOrRoleId !== '' && !isNaN(Number(roleOrRoleId));
  const { rows } = await pool.query(`
    SELECT r.id, r.name, r.admin_type, r.is_director, r.is_system,
           ARRAY_AGG(p.key) FILTER (WHERE p.key IS NOT NULL) AS permissions
    FROM roles r
    LEFT JOIN role_permissions rp ON rp.role_id = r.id
    LEFT JOIN permissions p ON p.id = rp.permission_id
    WHERE r.id = $1 OR LOWER(r.name) = LOWER($2)
    GROUP BY r.id
    ORDER BY (r.id = $1) DESC
    LIMIT 1
  `, [isNumeric ? Number(roleOrRoleId) : 0, String(roleOrRoleId ?? '')]);

  if (rows.length === 0) {
    const err = new Error(`Unknown role: ${roleOrRoleId}`);
    err.statusCode = 400;
    throw err;
  }

  const row = rows[0];
  const baseRole = BASE_SYSTEM_ROLES.includes(row.name.toLowerCase()) ? row.name.toLowerCase() : 'employee';
  const isDirector = Boolean(row.is_director) || baseRole === 'director';
  const permissions = (row.permissions || []).filter(Boolean);
  return {
    id: row.id,
    baseRole,
    adminType: row.admin_type,
    isDirector,
    // The built-in Employee role is the default self-service login every
    // staff member gets, so anyone allowed to create logins may grant it.
    isDefaultEmployeeRole: Boolean(row.is_system) && row.name.toLowerCase() === 'employee',
    permissions: isDirector ? ['*'] : expandPermissions(permissions),
  };
};

// The privileges an existing employee currently holds, or null if they have none.
const getCurrentRole = async (employee) => {
  if (employee.roleId) return resolveRole(employee.roleId);
  if (!employee.role) return null;
  const baseRole = BASE_SYSTEM_ROLES.includes(employee.role) ? employee.role : 'employee';
  return {
    baseRole,
    isDirector: baseRole === 'director',
    permissions: expandPermissions(getDefaultPermissionsForRole(baseRole)),
  };
};

// Nobody may hand out, or act on an account holding, privileges beyond their
// own. Only a Director can assign the Director role or manage a Director.
const assertCanActOnRole = (actingUser, role, action) => {
  if (!role || role.isDefaultEmployeeRole) return;
  if (!actingUser) throw forbidden(`Forbidden - cannot ${action} without an authenticated user`);
  if (hasPermission(actingUser, '*')) return;
  if (role.isDirector) {
    throw forbidden(`Forbidden - only a Director can ${action} a Director`);
  }
  const missing = role.permissions.filter((key) => !hasPermission(actingUser, key));
  if (missing.length > 0) {
    throw forbidden(`Forbidden - cannot ${action} a role with permissions you do not hold: ${missing.join(', ')}`);
  }
};

const createEmployeeWithAccess = async (data, actingUser) => {
  const { name, department, location, address, role, roleId } = data;
  const email = String(data.email).trim().toLowerCase();

  validateCorporateEmail(email);

  const existing = await pool.query('SELECT id FROM employees WHERE LOWER(email) = $1', [email]);
  if (existing.rows.length > 0) {
    const err = new Error('Employee email already exists');
    err.statusCode = 409;
    throw err;
  }

  const targetRole = await resolveRole(roleId || role || 'employee');
  assertCanActOnRole(actingUser, targetRole, 'assign');

  const crypto = require('crypto');
  const bcrypt = require('bcrypt');
  const temporaryPassword = crypto.randomBytes(9).toString('base64url');
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);

  const result = await pool.query(`
    INSERT INTO employees (name, email, department, location, address, work_mode, google_id, avatar_url, is_google_synced, password_hash, role, role_id, admin_type, must_change_password, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, NULL, NULL, 0, $7, $8, $9, $10, true, NOW())
    RETURNING id
  `, [name, email, department ?? null, location ?? null, address ?? null, data.workMode || 'office', passwordHash, targetRole.baseRole, targetRole.id, targetRole.adminType]);

  const employee = await getEmployeeById(result.rows[0].id);
  return { employee, temporaryPassword };
};

const CREDENTIAL_FIELDS = ['password', 'canLogin', 'role', 'roleId', 'role_id'];

const updateEmployee = async (id, data, actingUser) => {
  const current = await getEmployeeById(id);

  const touchedCredentialFields = CREDENTIAL_FIELDS.filter(
    (f) => data[f] !== undefined && data[f] !== null && data[f] !== ''
  );
  if (touchedCredentialFields.length > 0) {
    if (!actingUser || !hasPermission(actingUser, 'employees:grant-access')) {
      const err = new Error(
        `Forbidden - Requires 'employees:grant-access' to modify: ${touchedCredentialFields.join(', ')}`
      );
      err.statusCode = 403;
      throw err;
    }
  }
  
  // Explicitly strip role and role_id from routine profile update payload handling (Risk Audit #13)
  const { name, department, location, address, avatarUrl, workMode } = data;
  const email = data.email ? String(data.email).trim().toLowerCase() : undefined;

  const isEmailChange = Boolean(email) && email !== current.email.toLowerCase();
  if (isEmailChange && current.hasLogin) {
    // Login (including Google sign-in) is keyed on email, so changing it can
    // hand the account to someone else: treat it like a credential change.
    if (!actingUser || !hasPermission(actingUser, 'employees:grant-access')) {
      throw forbidden("Forbidden - Requires 'employees:grant-access' to change the email of an account that can log in");
    }
    assertCanActOnRole(actingUser, await getCurrentRole(current), 'change the email of');
  }

  if (isEmailChange) {
    const existing = await pool.query('SELECT id FROM employees WHERE LOWER(email) = $1 AND id != $2', [email, id]);
    if (existing.rows.length > 0) {
      const err = new Error('Employee email already exists');
      err.statusCode = 409;
      throw err;
    }
  }

  // Profile update and (for an email change) sign-out happen together.
  await withTransaction(async (client) => {
    await client.query(`
      UPDATE employees
      SET name = $1,
          email = $2,
          department = $3,
          location = $4,
          address = $5,
          avatar_url = $6,
          work_mode = $8
      WHERE id = $7
    `, [
      name !== undefined ? name : current.name,
      email !== undefined ? email : current.email,
      department !== undefined ? department : current.department,
      location !== undefined ? location : current.location,
      address !== undefined ? address : current.address,
      avatarUrl !== undefined ? avatarUrl : current.avatarUrl,
      id,
      workMode || current.workMode,
    ]);

    if (isEmailChange) {
      await client.query('DELETE FROM sessions WHERE employee_id = $1', [id]);
    }
  });

  return getEmployeeById(id);
};

// options.client — run inside the caller's transaction (offboarding).
const inTransaction = (client, fn) => (client ? fn(client) : withTransaction(fn));

const deleteEmployee = async (id, actingUser, options = {}) => {
  const current = await getEmployeeById(id);

  if (current.deletedAt) {
    return { id: Number(id), deleted: true };
  }

  assertCanActOnRole(actingUser, await getCurrentRole(current), 'remove');

  // Hardware must be handed back first, or it would stay assigned to a
  // hidden, removed account.
  const { rows: heldAssets } = await pool.query(
    `SELECT id, name, serial_number FROM assets WHERE assigned_to = $1 AND status = 'in-use' ORDER BY name`,
    [id]
  );
  if (heldAssets.length > 0) {
    const err = new Error(
      `Return ${heldAssets.length} assigned asset(s) before removing this employee (or start their offboarding): `
      + heldAssets.map((asset) => `${asset.name} (${asset.serial_number})`).join(', ')
    );
    err.statusCode = 409;
    err.details = { assets: heldAssets.map((asset) => ({ id: asset.id, name: asset.name, serialNumber: asset.serial_number })) };
    throw err;
  }

  await inTransaction(options.client, async (client) => {
    await client.query('SELECT id FROM employees WHERE id = $1 FOR UPDATE', [id]);
    await assertNotLastDirector(client, id, 'remove');
    // Re-check under the lock: an asset may have been assigned meanwhile.
    const { rows: stillHeld } = await client.query(
      "SELECT 1 FROM assets WHERE assigned_to = $1 AND status = 'in-use' LIMIT 1", [id]
    );
    if (stillHeld.length > 0) {
      const err = new Error('An asset was just assigned to this employee; return it before removing them');
      err.statusCode = 409;
      throw err;
    }
    await client.query('UPDATE employees SET deleted_at = NOW() WHERE id = $1', [id]);
    await client.query('DELETE FROM sessions WHERE employee_id = $1', [id]);
  });
  return { id: Number(id), deleted: true };
};

// Every change that could leave the company without a Director goes through
// this check (demote, revoke access, remove).
const assertNotLastDirector = async (client, employeeId, action) => {
  const { rows: [target] } = await client.query(`
    SELECT (e.role = 'director' OR COALESCE(r.is_director, false)) AS is_director
    FROM employees e LEFT JOIN roles r ON r.id = e.role_id
    WHERE e.id = $1`, [employeeId]);
  if (!target?.is_director) return;
  const { rows: [{ count }] } = await client.query(`
    SELECT COUNT(*)::int AS count
    FROM employees e LEFT JOIN roles r ON r.id = e.role_id
    WHERE e.deleted_at IS NULL AND e.password_hash IS NOT NULL
      AND (e.role = 'director' OR COALESCE(r.is_director, false))`);
  if (count <= 1) {
    const err = new Error(`Cannot ${action} the last Director; make someone else a Director first`);
    err.statusCode = 409;
    throw err;
  }
};

const applyRole = async (client, id, targetRole) => {
  // Decision #2: Copy roles.admin_type into employees.admin_type at assignment time if present
  if (targetRole.adminType) {
    await client.query(
      'UPDATE employees SET role = $1, role_id = $2, admin_type = $3 WHERE id = $4',
      [targetRole.baseRole, targetRole.id, targetRole.adminType, id]
    );
  } else {
    await client.query(
      'UPDATE employees SET role = $1, role_id = $2 WHERE id = $3',
      [targetRole.baseRole, targetRole.id, id]
    );
  }
};

const updateEmployeeRole = async (id, roleOrRoleId, actingUser) => {
  const current = await getEmployeeById(id);
  const targetRole = await resolveRole(roleOrRoleId);
  assertCanActOnRole(actingUser, await getCurrentRole(current), 'change the role of');
  assertCanActOnRole(actingUser, targetRole, 'assign');

  await withTransaction(async (client) => {
    await client.query('SELECT id FROM employees WHERE id = $1 FOR UPDATE', [id]);
    if (!targetRole.isDirector) await assertNotLastDirector(client, id, 'demote');
    await applyRole(client, id, targetRole);
    // Role changes take effect on the next login.
    await client.query('DELETE FROM sessions WHERE employee_id = $1', [id]);
  });

  return getEmployeeById(id);
};

const grantEmployeeAccess = async (id, roleOrRoleId, passwordHash, actingUser) => {
  const current = await getEmployeeById(id);

  validateCorporateEmail(current.email);

  if (current.hasLogin) {
    const err = new Error('Employee already has a login account');
    err.statusCode = 400;
    throw err;
  }

  const targetRole = await resolveRole(roleOrRoleId);
  assertCanActOnRole(actingUser, targetRole, 'assign');

  // Password and role together, so a failure never leaves a login without a
  // role. A temporary password must be replaced at first login.
  await withTransaction(async (client) => {
    await client.query(
      'UPDATE employees SET password_hash = $1, must_change_password = true WHERE id = $2',
      [passwordHash, id]
    );
    await applyRole(client, id, targetRole);
    await client.query('DELETE FROM sessions WHERE employee_id = $1', [id]);
  });

  return getEmployeeById(id);
};

// Issues a new temporary password (for a forgotten or leaked one); the user
// must change it at next login and is signed out everywhere now.
const resetEmployeePassword = async (id, passwordHash, actingUser) => {
  const current = await getEmployeeById(id);
  if (current.deletedAt || !current.role) {
    const err = new Error('This employee has no login access to reset');
    err.statusCode = 400;
    throw err;
  }
  assertCanActOnRole(actingUser, await getCurrentRole(current), 'reset the password of');

  await withTransaction(async (client) => {
    await client.query(
      'UPDATE employees SET password_hash = $1, must_change_password = true WHERE id = $2',
      [passwordHash, id]
    );
    await client.query('DELETE FROM sessions WHERE employee_id = $1', [id]);
  });
  return getEmployeeById(id);
};

// Removes the ability to log in (password and Google) while keeping the
// directory entry and its asset history.
const revokeEmployeeAccess = async (id, actingUser, options = {}) => {
  const current = await getEmployeeById(id);
  if (!current.role && !current.hasLogin) {
    const err = new Error('This employee has no login access');
    err.statusCode = 400;
    throw err;
  }
  assertCanActOnRole(actingUser, await getCurrentRole(current), 'revoke access for');

  await inTransaction(options.client, async (client) => {
    await client.query('SELECT id FROM employees WHERE id = $1 FOR UPDATE', [id]);
    await assertNotLastDirector(client, id, 'revoke access for');
    await client.query(`
      UPDATE employees
      SET password_hash = NULL, role = NULL, role_id = NULL, google_id = NULL, must_change_password = false
      WHERE id = $1`, [id]);
    await client.query('DELETE FROM sessions WHERE employee_id = $1', [id]);
  });
  return getEmployeeById(id);
};

const grantGoogleAccess = async (id) => {
  const current = await getEmployeeById(id);
  validateCorporateEmail(current.email);
  if (current.hasLogin) {
    const err = new Error('Employee already has a login account');
    err.statusCode = 400;
    throw err;
  }
  await applyRole(pool, id, await resolveRole('employee'));
  return getEmployeeById(id);
};

module.exports = {
  resetEmployeePassword,
  revokeEmployeeAccess,
  getLoginEmailDomains,
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
  resolveRole,
  assertCanActOnRole,
  grantGoogleAccess,
};
