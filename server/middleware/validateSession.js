const { pool } = require('../db');

// This is only used for employees with role_id IS NULL (pre-role-assignment). It is NOT a live mirror of the role_permissions table — do not treat it as authoritative once a Director has customized a system role via the Role Matrix.
const DEFAULT_ROLE_PERMISSIONS = {
  director: ['*'],
  admin: [
    'roles:read', 'roles:manage', 'history:read',
    'assets:read', 'assets:create', 'assets:update', 'assets:assign', 'assets:delete', 'assets:export', 'assets:import',
    'categories:read', 'categories:manage',
    'employees:read', 'employees:create', 'employees:manage', 'employees:delete', 'employees:grant-access', 'employees:assign-assets',
    'onboarding:read', 'onboarding:create', 'onboarding:update', 'onboarding:fulfill',
    'tickets:read', 'tickets:create', 'tickets:update', 'tickets:resolve',
    'locations:read', 'locations:manage',
    'scanner:read', 'settings:read', 'settings:manage'
  ],
  hr: [
    'categories:read',
    'employees:read', 'employees:create', 'employees:manage',
    'onboarding:read', 'onboarding:create', 'onboarding:update',
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
  'assets:create': ['assets:read'],
  'assets:update': ['assets:read'],
  'assets:assign': ['assets:read'],
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
  'employees:assign-assets': ['employees:read'],
  'onboarding:create': ['onboarding:read'],
  'onboarding:update': ['onboarding:read'],
  // Fulfillment presents the available-asset selector, whose endpoint is
  // protected by assets:read.
  'onboarding:fulfill': ['onboarding:read', 'assets:read'],
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
  if (!user.permissions || !Array.isArray(user.permissions) || user.permissions.length === 0) {
    const fallback = DEFAULT_ROLE_PERMISSIONS[user.role] || [];
    if (fallback.includes('*')) return true;
    return expandPermissions(fallback).includes(permissionKey);
  }
  return expandPermissions(user.permissions).includes(permissionKey);
};

const validateSession = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: true, message: 'Unauthorized - No token provided', code: 401 });
    }

    const token = authHeader.split(' ')[1];
    const result = await pool.query(`
      SELECT s.employee_id, e.name, e.email, e.role, e.role_id, e.admin_type, s.expires_at,
             r.name as role_name, r.is_director,
             ARRAY_AGG(p.key) FILTER (WHERE p.key IS NOT NULL) as permissions
      FROM sessions s
      JOIN employees e ON s.employee_id = e.id
      LEFT JOIN roles r ON e.role_id = r.id
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      LEFT JOIN permissions p ON rp.permission_id = p.id
      WHERE s.token = $1 AND s.expires_at > NOW() AND e.deleted_at IS NULL
      GROUP BY s.employee_id, e.id, r.id, s.expires_at
    `, [token]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: true, message: 'Unauthorized - Invalid or expired session token', code: 401 });
    }

    const sessionUser = result.rows[0];
    const userPermissions = sessionUser.permissions && sessionUser.permissions[0] !== null
      ? sessionUser.permissions
      : getDefaultPermissionsForRole(sessionUser.role);

    req.user = {
      id: sessionUser.employee_id,
      name: sessionUser.name,
      email: sessionUser.email,
      role: sessionUser.role,
      roleId: sessionUser.role_id,
      roleName: sessionUser.role_name,
      isDirector: sessionUser.is_director || sessionUser.role === 'director',
      adminType: sessionUser.admin_type,
      permissions: expandPermissions(userPermissions)
    };

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
