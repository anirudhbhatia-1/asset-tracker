const express = require('express');
const { body, param } = require('express-validator');
const { pool, withTransaction } = require('../db');
const validateRequest = require('../middleware/validateRequest');
const { validateSession, requirePermission, hasPermission } = require('../middleware/validateSession');

const router = express.Router();

router.use(validateSession);

// GET /api/roles — list all roles with permissions catalog
router.get('/', requirePermission('roles:read'), async (req, res, next) => {
  try {
    const rolesRes = await pool.query(`
      SELECT r.*,
             COALESCE(
               JSON_AGG(
                 JSON_BUILD_OBJECT('id', p.id, 'key', p.key, 'module', p.module, 'description', p.description)
               ) FILTER (WHERE p.id IS NOT NULL),
               '[]'::json
             ) as permissions,
             COUNT(DISTINCT e.id) as active_user_count
      FROM roles r
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      LEFT JOIN permissions p ON rp.permission_id = p.id
      LEFT JOIN employees e ON (e.role_id = r.id OR e.role = LOWER(r.name)) AND e.deleted_at IS NULL
      GROUP BY r.id
      ORDER BY r.is_director DESC, r.is_system DESC, r.name ASC
    `);

    const permissionsRes = await pool.query(`
      SELECT * FROM permissions ORDER BY module ASC, key ASC
    `);

    res.status(200).json({
      data: rolesRes.rows.map(r => ({
        id: r.id,
        name: r.name,
        description: r.description,
        isSystem: r.is_system,
        isDirector: r.is_director,
        adminType: r.admin_type,
        activeUserCount: Number(r.active_user_count || 0),
        permissions: r.permissions || []
      })),
      permissionsCatalog: permissionsRes.rows.map(p => ({
        id: p.id,
        key: p.key,
        module: p.module,
        description: p.description
      })),
      message: 'OK'
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/roles/:id — single role details
router.get('/:id', [
  requirePermission('roles:read'),
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  validateRequest
], async (req, res, next) => {
  try {
    const roleId = Number(req.params.id);
    const roleRes = await pool.query(`
      SELECT r.*,
             COALESCE(
               JSON_AGG(p.key) FILTER (WHERE p.key IS NOT NULL),
               '[]'::json
             ) as permission_keys
      FROM roles r
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      LEFT JOIN permissions p ON rp.permission_id = p.id
      WHERE r.id = $1
      GROUP BY r.id
    `, [roleId]);

    if (roleRes.rows.length === 0) {
      return res.status(404).json({ error: true, message: 'Role not found' });
    }

    const r = roleRes.rows[0];
    res.status(200).json({
      data: {
        id: r.id,
        name: r.name,
        description: r.description,
        isSystem: r.is_system,
        isDirector: r.is_director,
        adminType: r.admin_type,
        permissionKeys: r.permission_keys || []
      },
      message: 'OK'
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/roles — create a new role
router.post('/', [
  requirePermission('roles:manage'),
  body('name').notEmpty().withMessage('Role name is required').trim().isLength({ max: 100 }),
  body('description').optional().isString().trim(),
  body('adminType').optional({ nullable: true }).isIn(['it', 'hardware', 'hr', null]).withMessage('Invalid adminType'),
  body('permissionKeys').optional().isArray().withMessage('permissionKeys must be an array'),
  validateRequest
], async (req, res, next) => {
  try {
    const { name, description, adminType, permissionKeys } = req.body;

    const existing = await pool.query('SELECT id FROM roles WHERE LOWER(name) = LOWER($1)', [name]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: true, message: 'Role with this name already exists' });
    }

    let createdRole;
    await withTransaction(async (client) => {
      const insRes = await client.query(`
        INSERT INTO roles (name, description, is_system, is_director, admin_type)
        VALUES ($1, $2, false, false, $3)
        RETURNING *
      `, [name, description || null, adminType || null]);

      createdRole = insRes.rows[0];

      if (Array.isArray(permissionKeys) && permissionKeys.length > 0) {
        const permRes = await client.query(`
          SELECT id, key FROM permissions WHERE key = ANY($1)
        `, [permissionKeys]);

        for (const p of permRes.rows) {
          await client.query(`
            INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING
          `, [createdRole.id, p.id]);
        }
      }
    });

    res.status(201).json({
      data: {
        id: createdRole.id,
        name: createdRole.name,
        description: createdRole.description,
        isSystem: createdRole.is_system,
        isDirector: createdRole.is_director,
        adminType: createdRole.admin_type,
        permissionKeys: permissionKeys || []
      },
      message: 'Role created successfully'
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/roles/:id — update a role
router.put('/:id', [
  requirePermission('roles:manage'),
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  body('name').optional().notEmpty().withMessage('Role name cannot be empty').trim().isLength({ max: 100 }),
  body('description').optional().isString().trim(),
  body('adminType').optional({ nullable: true }).isIn(['it', 'hardware', 'hr', null]).withMessage('Invalid adminType'),
  body('permissionKeys').optional().isArray().withMessage('permissionKeys must be an array'),
  validateRequest
], async (req, res, next) => {
  try {
    const roleId = Number(req.params.id);
    const roleRes = await pool.query('SELECT * FROM roles WHERE id = $1', [roleId]);
    if (roleRes.rows.length === 0) {
      return res.status(404).json({ error: true, message: 'Role not found' });
    }

    const currentRole = roleRes.rows[0];
    const { name, description, adminType, permissionKeys } = req.body;

    // System roles name & director status cannot be mutated
    if (currentRole.is_system && name && name !== currentRole.name) {
      return res.status(400).json({ error: true, message: 'Cannot rename system role' });
    }

    await withTransaction(async (client) => {
      await client.query(`
        UPDATE roles
        SET name = $1,
            description = $2,
            admin_type = $3
        WHERE id = $4
      `, [
        name && !currentRole.is_system ? name : currentRole.name,
        description !== undefined ? description : currentRole.description,
        adminType !== undefined ? adminType : currentRole.admin_type,
        roleId
      ]);

      if (Array.isArray(permissionKeys)) {
        // Clear existing permissions and re-insert
        await client.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);

        if (permissionKeys.length > 0) {
          const permRes = await client.query('SELECT id, key FROM permissions WHERE key = ANY($1)', [permissionKeys]);
          for (const p of permRes.rows) {
            await client.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [roleId, p.id]);
          }
        }
      }
    });

    res.status(200).json({
      data: {
        id: roleId,
        name: name || currentRole.name,
        description: description !== undefined ? description : currentRole.description,
        isSystem: currentRole.is_system,
        isDirector: currentRole.is_director,
        adminType: adminType !== undefined ? adminType : currentRole.admin_type,
        permissionKeys: permissionKeys || []
      },
      message: 'Role updated successfully'
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/roles/:id — delete a custom role
router.delete('/:id', [
  requirePermission('roles:manage'),
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  validateRequest
], async (req, res, next) => {
  try {
    const roleId = Number(req.params.id);
    const roleRes = await pool.query('SELECT * FROM roles WHERE id = $1', [roleId]);
    if (roleRes.rows.length === 0) {
      return res.status(404).json({ error: true, message: 'Role not found' });
    }

    const currentRole = roleRes.rows[0];
    if (currentRole.is_system) {
      return res.status(400).json({ error: true, message: 'Cannot delete protected system role' });
    }

    // Active assignment check: Cannot delete role if any active employee is assigned to it
    const empCheck = await pool.query('SELECT COUNT(*) as count FROM employees WHERE (role_id = $1 OR role = LOWER($2)) AND deleted_at IS NULL', [roleId, currentRole.name]);
    if (Number(empCheck.rows[0].count) > 0) {
      return res.status(409).json({
        error: true,
        message: `Cannot delete role: currently assigned to ${empCheck.rows[0].count} active employee(s)`
      });
    }

    await pool.query('DELETE FROM roles WHERE id = $1', [roleId]);

    res.status(200).json({
      data: { id: roleId, deleted: true },
      message: 'Role deleted successfully'
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
