const { pool } = require('../db');
const { hashSessionToken } = require('../services/sessionToken');

// This is only used for employees with role_id IS NULL (pre-role-assignment). It is NOT a live mirror of the role_permissions table — do not treat it as authoritative once a Director has customized a system role via the Role Matrix.
const DEFAULT_ROLE_PERMISSIONS = {
  director: ['*'],
  admin: [
    'roles:read', 'history:read',
    'assets:read', 'assets:create', 'assets:update', 'assets:assign', 'assets:delete', 'assets:export', 'assets:import',
    'categories:read', 'categories:manage',
    'employees:read', 'employees:create', 'employees:manage', 'employees:delete', 'employees:grant-access', 'employees:assign-assets',
    'onboarding:read', 'onboarding:create', 'onboarding:update', 'onboarding:fulfill',
    'offboarding:read', 'offboarding:create', 'offboarding:update', 'offboarding:collect',
    'tickets:read', 'tickets:create', 'tickets:update', 'tickets:resolve',
    'locations:read', 'locations:manage',
    'scanner:read', 'settings:read', 'settings:manage'
  ],
  hr: [
    'categories:read',
    'employees:read', 'employees:create', 'employees:manage',
    'onboarding:read', 'onboarding:create', 'onboarding:update',
    'offboarding:read', 'offboarding:create', 'offboarding:update',
    'tickets:read', 'tickets:create', 'tickets:update',
    'locations:read'
  ],
  employee: [
    'categories:read',
    'tickets:read', 'tickets:create',
    'locations:read'
  ]
};

const getDefaultPermissionsForRole = (role) => DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.employee;

// Write-oriented permissions are not useful without the corresponding page
// and read endpoint. Treat the read permission as an effective dependency so
// custom roles behave consistently in the API, router, and UI.
const PERMISSION_DEPENDENCIES = {
  // The Add Asset form needs its category and office dropdowns.
  'assets:create': ['assets:read', 'categories:read', 'locations:read'],
  'assets:update': ['assets:read'],
  // Assigning means choosing an employee.
  'assets:assign': ['assets:read', 'employees:read'],
  'assets:delete': ['assets:read'],
  'assets:export': ['assets:read'],
  'assets:import': ['assets:read'],
  'categories:manage': ['categories:read'],
  'locations:manage': ['locations:read'],
  'roles:manage': ['roles:read'],
  'settings:manage': ['settings:read'],
  'employees:create': ['employees:read'],
  'employees:manage': ['employees:read'],
  'employees:delete': ['employees:read'],
  'employees:grant-access': ['employees:read'],
  // Bulk assign lists the available assets to pick from.
  'employees:assign-assets': ['employees:read', 'assets:read'],
  // Onboarding forms need the category, office and department dropdowns.
  'onboarding:create': ['onboarding:read', 'categories:read', 'locations:read', 'employees:read'],
  'onboarding:update': ['onboarding:read', 'categories:read', 'locations:read', 'employees:read'],
  // Fulfillment presents the available-asset selector, whose endpoint is
  // protected by assets:read.
  'onboarding:fulfill': ['onboarding:read', 'assets:read'],
  // Starting an exit means picking the employee.
  'offboarding:create': ['offboarding:read', 'employees:read'],
  'offboarding:update': ['offboarding:read'],
  'offboarding:collect': ['offboarding:read'],
  'tickets:create': ['tickets:read'],
  'tickets:update': ['tickets:read'],
  'tickets:resolve': ['tickets:read'],
};

const expandPermissions = (permissions = []) => {
  const effective = new Set(permissions);
  for (const permission of permissions) {
    for (const dependency of PERMISSION_DEPENDENCIES[permission] || []) {
      effective.add(dependency);
    }
  }
  return Array.from(effective);
};

const hasPermission = (user, permissionKey) => {
  if (!user) return false;
  if (user.role === 'director' || user.isDirector || (user.permissions && user.permissions.includes('*'))) {
    return true;
  }
  // Defaults apply only to accounts with no role record; a role that has
  // had every permission removed grants nothing.
  if (user.roleId == null && (!Array.isArray(user.permissions) || user.permissions.length === 0)) {
    const fallback = DEFAULT_ROLE_PERMISSIONS[user.role] || [];
    if (fallback.includes('*')) return true;
    return expandPermissions(fallback).includes(permissionKey);
  }
  return expandPermissions(user.permissions).includes(permissionKey);
};

const PASSWORD_CHANGE_ALLOWED_PATHS = new Set(['/api/auth/me', '/api/auth/change-password']);

const validateSession = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: true, message: 'Unauthorized - No token provided', code: 401 });
    }

    const token = authHeader.split(' ')[1];
    const result = await pool.query(`
      SELECT s.employee_id, e.name, e.email, e.role, e.role_id, e.admin_type, e.must_change_password, s.expires_at,
             r.name as role_name, r.is_director,
             ARRAY_AGG(p.key) FILTER (WHERE p.key IS NOT NULL) as permissions
      FROM sessions s
      JOIN employees e ON s.employee_id = e.id
      LEFT JOIN roles r ON e.role_id = r.id
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      LEFT JOIN permissions p ON rp.permission_id = p.id
      WHERE s.token = $1 AND s.expires_at > NOW() AND e.deleted_at IS NULL
      GROUP BY s.employee_id, e.id, r.id, s.expires_at
    `, [hashSessionToken(token)]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: true, message: 'Unauthorized - Invalid or expired session token', code: 401 });
    }

    const sessionUser = result.rows[0];
    const storedPermissions = (sessionUser.permissions || []).filter(Boolean);
    const userPermissions = sessionUser.role_id == null
      ? getDefaultPermissionsForRole(sessionUser.role)
      : storedPermissions;

    req.user = {
      id: sessionUser.employee_id,
      name: sessionUser.name,
      email: sessionUser.email,
      role: sessionUser.role,
      roleId: sessionUser.role_id,
      roleName: sessionUser.role_name,
      isDirector: sessionUser.is_director || sessionUser.role === 'director',
      adminType: sessionUser.admin_type,
      permissions: expandPermissions(userPermissions),
      mustChangePassword: Boolean(sessionUser.must_change_password),
    };

    // Until a temporary or shared password is replaced, only allow what the
    // change-password screen needs.
    if (req.user.mustChangePassword && !PASSWORD_CHANGE_ALLOWED_PATHS.has(`${req.baseUrl}${req.path}`)) {
      return res.status(403).json({
        error: true,
        code: 403,
        reason: 'PASSWORD_CHANGE_REQUIRED',
        message: 'You must set a new password before continuing.',
      });
    }

    next();
  } catch (err) {
    next(err);
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: true, message: 'Unauthorized', code: 401 });
    }
    if (
      req.user.role === 'director' ||
      req.user.isDirector ||
      req.user.permissions?.includes('*') ||
      roles.includes(req.user.role)
    ) {
      return next();
    }
    return res.status(403).json({ error: true, message: 'Forbidden - Insufficient permissions', code: 403 });
  };
};

const requirePermission = (permissionKey) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: true, message: 'Unauthorized', code: 401 });
    }
    if (!hasPermission(req.user, permissionKey)) {
      return res.status(403).json({ error: true, message: `Forbidden - Requires '${permissionKey}' permission`, code: 403 });
    }
    next();
  };
};

module.exports = {
  validateSession,
  requireRole,
  requirePermission,
  hasPermission,
  DEFAULT_ROLE_PERMISSIONS,
  expandPermissions,
  getDefaultPermissionsForRole
};
