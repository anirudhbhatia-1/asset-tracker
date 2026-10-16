const { pool, withTransaction } = require('../db');
const { escapeLike } = require('../utils/like');
const { hasPermission, expandPermissions, getDefaultPermissionsForRole } = require('../middleware/validateSession');
const auditService = require('./auditService');

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
    // A Director by system role or by a custom role with Director rights.
    isDirector: row.role === 'director' || Boolean(row.is_director),
    customRoleName: row.custom_role_name || row.role_name || row.role || null,
    adminType: row.admin_type || null,
    // The open exit, if one is in progress: { id, lastWorkingDate, status }.
    offboarding: row.offboarding || null,
    hasLogin: row.has_login !== undefined ? Boolean(row.has_login) : (row.password_hash != null || row.google_id != null || Boolean(row.role)),
    // Set while password sign-in is locked after repeated failures.
    lockedUntil: row.active_locked_until || null,
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
    assetType: row.asset_type || 'company',
    status: row.status,
    location: row.location || null,
    costCents: row.cost_cents || 0,
    purchaseDate: row.purchase_date || null,
    warrantyExpiryDate: row.warranty_expiry_date || null,
    notes: row.notes || null,
    assignedTo: row.assigned_to,
    assignedDate: row.assigned_date || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    brand: row.brand || null,
    processor: row.processor || null,
    ram: row.ram || null,
    storage: row.storage || null,
    screenSize: row.screen_size || null,
    graphicsCard: row.graphics_card || null,
    os: row.os || null,
    msOffice: row.ms_office || null,
    antiVirus: row.anti_virus || null,
    color: row.color || null,
    clientName: row.client_name || null,
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
    // Typed % and _ are searched for literally, not as wildcards.
    const likeQuery = `%${escapeLike(String(filters.q))}%`;
    params.push(likeQuery);
    const pos = params.length;
    conditions.push(`(e.name ILIKE $${pos} OR e.email ILIKE $${pos})`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT e.id, e.name, e.email, e.department, e.location, e.address, e.work_mode, e.google_id,
           e.avatar_url, e.is_google_synced, e.deleted_at, e.created_at,
           e.role, e.role_id, e.admin_type,
           (e.password_hash IS NOT NULL OR e.google_id IS NOT NULL OR e.role IS NOT NULL) AS has_login,
           CASE WHEN e.locked_until > NOW() THEN e.locked_until END AS active_locked_until,
           r.name as role_name, r.name as custom_role_name, r.is_director,
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

// `executor` — a transaction client, to read what that transaction has
// already changed (offboarding revokes access, then removes the employee).
const getEmployeeById = async (id, executor = pool) => {
  const result = await executor.query(`
    SELECT e.id, e.name, e.email, e.department, e.location, e.address, e.work_mode, e.google_id,
           e.avatar_url, e.is_google_synced, e.deleted_at, e.created_at,
           e.role, e.role_id, e.admin_type,
           (e.password_hash IS NOT NULL OR e.google_id IS NOT NULL OR e.role IS NOT NULL) AS has_login,
           CASE WHEN e.locked_until > NOW() THEN e.locked_until END AS active_locked_until,
           r.name as role_name, r.name as custom_role_name, r.is_director,
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

// `showCompanyCost` false (the person looking at their own things without
// asset access) hides what company assets cost; client assets keep their
// price, since the employee is answerable for it.
const getEmployeeAssets = async (id, { showCompanyCost = true } = {}) => {
  await getEmployeeById(id);

  const result = await pool.query(`
    SELECT a.*, c.name AS category_name, c.badge_char AS category_badge_char, c.color AS category_color,
      COALESCE((
        SELECT json_agg(json_build_object('id', ch.id, 'name', ch.name, 'serialNumber', ch.serial_number) ORDER BY ch.name)
        FROM assets ch WHERE ch.parent_id = a.id AND ch.assigned_to = a.assigned_to AND ch.status = 'in-use'
      ), '[]') AS accessories
    FROM assets a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.assigned_to = $1 AND a.status = 'in-use'
    ORDER BY a.assigned_date DESC, a.name ASC
  `, [id]);

  return result.rows.map((row) => {
    const asset = { ...mapAssetMini(row), accessories: row.accessories };
    if (!showCompanyCost) {
      if (asset.assetType !== 'client') asset.costCents = null;
      // Admin notes ("previously held by…", import remarks) are internal.
      asset.notes = null;
    }
    return asset;
  });
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
const createEmployee = async (data, actingUser = null) => {
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

  await auditEmployee(undefined, actingUser, 'employee.created', { id: result.rows[0].id, name, email }, {
    newValue: { department: department ?? null, workMode },
    details: { withLogin: false },
  });
  return getEmployeeById(result.rows[0].id);
};

const BASE_SYSTEM_ROLES = ['director', 'admin', 'hr', 'employee'];

const forbidden = (message) => {
  const err = new Error(message);
  err.statusCode = 403;
  return err;
};

// Access audit entries about one employee. `client` keeps the entry in the
// same transaction as the change.
// { role: display name, roleId }
const roleSnapshot = (role) => (role ? { role: role.name ?? null, roleId: role.id ?? null } : null);
const employeeRoleSnapshot = (employee) => (employee.role || employee.roleId
  ? { role: employee.roleName || employee.role || null, roleId: employee.roleId || null }
  : null);

const auditEmployee = (client, actingUser, eventType, employee, { oldValue, newValue, details } = {}) => (
  auditService.record(client, {
    eventType,
    actor: actingUser || null,
    targetType: 'employee',
    targetId: employee.id,
    targetName: employee.name,
    oldValue: oldValue ?? null,
    newValue: newValue ?? null,
    details: { email: employee.email, ...(details || {}) },
  })
);

// Resolves a role by id or name, including the permissions it effectively
// grants (roles without DB permissions fall back to the base-role defaults,
// mirroring validateSession).
const resolveRole = async (roleOrRoleId, executor = pool) => {
  const isNumeric = roleOrRoleId !== null && roleOrRoleId !== '' && !isNaN(Number(roleOrRoleId));
  const { rows } = await executor.query(`
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
    name: row.name,
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
const getCurrentRole = async (employee, executor = pool) => {
  if (employee.roleId) return resolveRole(employee.roleId, executor);
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
  const { hashPassword } = require('./passwordPolicy');
  const temporaryPassword = crypto.randomBytes(9).toString('base64url');
  const passwordHash = await hashPassword(temporaryPassword);

  const newId = await withTransaction(async (client) => {
    const result = await client.query(`
      INSERT INTO employees (name, email, department, location, address, work_mode, google_id, avatar_url, is_google_synced, password_hash, role, role_id, admin_type, must_change_password, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NULL, NULL, 0, $7, $8, $9, $10, true, NOW())
      RETURNING id
    `, [name, email, department ?? null, location ?? null, address ?? null, data.workMode || 'office', passwordHash, targetRole.baseRole, targetRole.id, targetRole.adminType]);
    const id = result.rows[0].id;
    await auditEmployee(client, actingUser, 'employee.created', { id, name, email }, {
      newValue: { department: department ?? null, workMode: data.workMode || 'office' },
      details: { withLogin: true },
    });
    await auditEmployee(client, actingUser, 'employee.access_granted', { id, name, email }, {
      newValue: { ...roleSnapshot(targetRole), method: 'password' },
      details: { newEmployee: true },
    });
    return id;
  });

  const employee = await getEmployeeById(newId);
  return { employee, temporaryPassword };
};

const CREDENTIAL_FIELDS = ['password', 'canLogin', 'role', 'roleId', 'role_id'];

// Removed employees keep their record for history, but nothing about them
// can be changed any more.
const assertNotRemoved = (employee) => {
  if (employee.deletedAt) {
    const err = new Error('This employee has been removed');
    err.statusCode = 400;
    throw err;
  }
};

const updateEmployee = async (id, data, actingUser) => {
  const current = await getEmployeeById(id);
  assertNotRemoved(current);
  // Only a Director edits a Director's profile (their own excepted).
  if (actingUser && Number(actingUser.id) !== Number(id)) {
    const currentRole = await getCurrentRole(current);
    if (currentRole?.isDirector) assertCanActOnRole(actingUser, currentRole, 'edit');
  }

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
      if (current.hasLogin) {
        await auditEmployee(client, actingUser, 'employee.email_changed', current, {
          oldValue: { email: current.email },
          newValue: { email },
        });
      }
    }
  });

  return getEmployeeById(id);
};

// Bulk items (bags, cables…) someone still holds, e.g. "Laptop Bag ×2".
const heldStockItems = async (reader, employeeId) => {
  const { rows } = await reader.query(
    `SELECT si.name, sh.quantity FROM stock_holdings sh JOIN stock_items si ON si.id = sh.stock_item_id
     WHERE sh.employee_id = $1 ORDER BY si.name`, [employeeId]
  );
  return rows.map((row) => `${row.name} ×${row.quantity}`);
};

const stockStillHeldError = (items) => Object.assign(
  new Error(`Take back or write off their bulk items first: ${items.join(', ')}`),
  { statusCode: 409, details: { stockItems: items } }
);

// options.client — run inside the caller's transaction (offboarding).
const inTransaction = (client, fn) => (client ? fn(client) : withTransaction(fn));

const deleteEmployee = async (id, actingUser, options = {}) => {
  // Inside an outer transaction, read through it so the audit entry reflects
  // what that transaction already changed (e.g. access revoked just before).
  const reader = options.client || pool;
  const current = await getEmployeeById(id, reader);

  if (current.deletedAt) {
    return { id: Number(id), deleted: true };
  }

  assertCanActOnRole(actingUser, await getCurrentRole(current, reader), 'remove');

  // Hardware must be handed back first, or it would stay assigned to a
  // hidden, removed account.
  const { rows: heldAssets } = await reader.query(
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
    const stock = await heldStockItems(client, id);
    if (stock.length > 0) throw stockStillHeldError(stock);
    await client.query('UPDATE employees SET deleted_at = NOW() WHERE id = $1', [id]);
    await client.query('DELETE FROM sessions WHERE employee_id = $1', [id]);
    await auditEmployee(client, actingUser, 'employee.removed', current, {
      oldValue: { ...employeeRoleSnapshot(current), hasLogin: current.hasLogin },
      details: options.auditDetails,
    });
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
  // Decision #2: the role's ticket queue (roles.admin_type) is copied onto the
  // employee. A role without a queue clears it, so someone moved out of IT
  // Admin stops seeing and working the IT queue.
  await client.query(
    'UPDATE employees SET role = $1, role_id = $2, admin_type = $3 WHERE id = $4',
    [targetRole.baseRole, targetRole.id, targetRole.adminType || null, id]
  );
};

const updateEmployeeRole = async (id, roleOrRoleId, actingUser) => {
  const current = await getEmployeeById(id);
  assertNotRemoved(current);
  // A role is what lets someone sign in (Google too): giving one to a person
  // without a login is granting access, which has its own permission and checks.
  if (!current.hasLogin) {
    const err = new Error('This employee has no login yet. Use Grant access to give them one with a role.');
    err.statusCode = 400;
    throw err;
  }
  const targetRole = await resolveRole(roleOrRoleId);
  assertCanActOnRole(actingUser, await getCurrentRole(current), 'change the role of');
  assertCanActOnRole(actingUser, targetRole, 'assign');

  await withTransaction(async (client) => {
    const { rows: [locked] } = await client.query(
      'SELECT role, role_id FROM employees WHERE id = $1 FOR UPDATE', [id]
    );
    // Assigning the role the employee already holds changes nothing: no
    // sign-out, no audit entry.
    if (locked && locked.role_id === targetRole.id && locked.role === targetRole.baseRole) return;
    if (!targetRole.isDirector) await assertNotLastDirector(client, id, 'demote');
    await applyRole(client, id, targetRole);
    // Role changes take effect on the next login.
    await client.query('DELETE FROM sessions WHERE employee_id = $1', [id]);
    await auditEmployee(client, actingUser, 'employee.role_changed', current, {
      oldValue: employeeRoleSnapshot(current),
      newValue: roleSnapshot(targetRole),
    });
  });

  return getEmployeeById(id);
};

const grantEmployeeAccess = async (id, roleOrRoleId, passwordHash, actingUser) => {
  const current = await getEmployeeById(id);
  assertNotRemoved(current);

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
      'UPDATE employees SET password_hash = $1, must_change_password = true, failed_login_count = 0, last_failed_login_at = NULL, locked_until = NULL WHERE id = $2',
      [passwordHash, id]
    );
    await applyRole(client, id, targetRole);
    await client.query('DELETE FROM sessions WHERE employee_id = $1', [id]);
    await auditEmployee(client, actingUser, 'employee.access_granted', current, {
      newValue: { ...roleSnapshot(targetRole), method: 'password' },
    });
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
    // A new temporary password also clears any lockout.
    await client.query(
      'UPDATE employees SET password_hash = $1, must_change_password = true, failed_login_count = 0, last_failed_login_at = NULL, locked_until = NULL WHERE id = $2',
      [passwordHash, id]
    );
    await client.query('DELETE FROM sessions WHERE employee_id = $1', [id]);
    await auditEmployee(client, actingUser, 'employee.password_reset', current, {
      details: { mustChangePassword: true, wasLocked: Boolean(current.lockedUntil) },
    });
  });
  return getEmployeeById(id);
};

// Removes the ability to log in (password and Google) while keeping the
// directory entry and its asset history.
const revokeEmployeeAccess = async (id, actingUser, options = {}) => {
  // Inside an exit's transaction, read through it (no second connection).
  const current = await getEmployeeById(id, options.client || pool);
  if (!current.role && !current.hasLogin) {
    const err = new Error('This employee has no login access');
    err.statusCode = 400;
    throw err;
  }
  assertCanActOnRole(actingUser, await getCurrentRole(current, options.client || pool), 'revoke access for');

  await inTransaction(options.client, async (client) => {
    await client.query('SELECT id FROM employees WHERE id = $1 FOR UPDATE', [id]);
    await assertNotLastDirector(client, id, 'revoke access for');
    await client.query(`
      UPDATE employees
      SET password_hash = NULL, role = NULL, role_id = NULL, admin_type = NULL, google_id = NULL, must_change_password = false,
          failed_login_count = 0, last_failed_login_at = NULL, locked_until = NULL
      WHERE id = $1`, [id]);
    await client.query('DELETE FROM sessions WHERE employee_id = $1', [id]);
    await auditEmployee(client, actingUser, 'employee.access_revoked', current, {
      oldValue: { ...employeeRoleSnapshot(current), hasLogin: current.hasLogin },
      details: options.auditDetails,
    });
  });
  return getEmployeeById(id);
};

const grantGoogleAccess = async (id, actingUser = null) => {
  const current = await getEmployeeById(id);
  assertNotRemoved(current);
  validateCorporateEmail(current.email);
  if (current.hasLogin) {
    const err = new Error('Employee already has a login account');
    err.statusCode = 400;
    throw err;
  }
  const targetRole = await resolveRole('employee');
  await withTransaction(async (client) => {
    await applyRole(client, id, targetRole);
    await auditEmployee(client, actingUser, 'employee.access_granted', current, {
      newValue: { ...roleSnapshot(targetRole), method: 'google' },
    });
  });
  return getEmployeeById(id);
};

// Lifts a lockout from repeated failed sign-ins (see authService.login).
const unlockEmployee = async (id, actingUser) => {
  const current = await getEmployeeById(id);
  if (current.deletedAt) {
    const err = new Error('This employee has been removed');
    err.statusCode = 400;
    throw err;
  }
  assertCanActOnRole(actingUser, await getCurrentRole(current), 'unlock');

  await withTransaction(async (client) => {
    const { rows: [before] } = await client.query(
      `SELECT locked_until, failed_login_count, (locked_until IS NOT NULL AND locked_until > NOW()) AS is_locked
       FROM employees WHERE id = $1 FOR UPDATE`, [id]
    );
    await client.query('UPDATE employees SET failed_login_count = 0, last_failed_login_at = NULL, locked_until = NULL WHERE id = $1', [id]);
    // Only lifting an active lock is an event worth recording; unlocking an
    // account that isn't locked just clears the failure count.
    if (!before.is_locked) return;
    await auditEmployee(client, actingUser, 'account.unlocked', current, {
      oldValue: { lockedUntil: before.locked_until, failedLoginCount: before.failed_login_count },
      newValue: { lockedUntil: null },
    });
  });
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
  heldStockItems,
  stockStillHeldError,
  grantEmployeeAccess,
  resolveRole,
  assertCanActOnRole,
  getCurrentRole,
  grantGoogleAccess,
  unlockEmployee,
};
