const express = require('express');
const { body, param } = require('express-validator');
const validateRequest = require('../middleware/validateRequest');
const employeeService = require('../services/employeeService');
const assetService = require('../services/assetService');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const { validateSession, requireRole, requirePermission, hasPermission } = require('../middleware/validateSession');

const router = express.Router();

router.use(validateSession);

// GET /api/employees — list all employees
router.get('/', requirePermission('employees:read'), async (req, res, next) => {
  try {
    const employees = await employeeService.getEmployees(req.query);
    res.status(200).json({
      data: employees,
      total: employees.length,
      message: 'OK',
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/employees/departments — list distinct departments
router.get('/departments', requirePermission('employees:read'), async (req, res, next) => {
  try {
    const departments = await employeeService.getDepartments();
    res.status(200).json({ data: departments, message: 'OK' });
  } catch (err) {
    next(err);
  }
});

// GET /api/employees/me — returns the logged-in user's own profile (all roles)
router.get('/me', async (req, res, next) => {
  try {
    const employee = await employeeService.getEmployeeById(req.user.id);
    res.status(200).json({ data: employee, message: 'OK' });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/employees/me — update own profile (all authenticated roles)
router.patch('/me', [
  body('name')
    .notEmpty().withMessage('Name is required')
    .trim()
    .isLength({ max: 150 }).withMessage('Name must be 150 characters or less'),
  validateRequest,
], async (req, res, next) => {
  try {
    const { name } = req.body;
    const updated = await employeeService.updateEmployee(req.user.id, { name }, req.user);
    res.status(200).json({ data: updated, message: 'Profile updated successfully' });
  } catch (err) {
    next(err);
  }
});

// GET /api/employees/:id — get single employee
router.get('/:id', [
  requirePermission('employees:read'),
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  validateRequest,
], async (req, res, next) => {
  try {
    const employee = await employeeService.getEmployeeById(Number(req.params.id));
    res.status(200).json({
      data: employee,
      message: 'OK',
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/employees/:id/assets — get assets currently assigned to employee
router.get('/:id/assets', [
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  validateRequest,
], async (req, res, next) => {
  try {
    const requestedId = Number(req.params.id);
    if (!hasPermission(req.user, 'employees:read') && req.user.id !== requestedId) {
      return res.status(403).json({ error: true, message: 'Forbidden - Can only view own assets', code: 403 });
    }
    const assets = await employeeService.getEmployeeAssets(requestedId);
    res.status(200).json({
      data: assets,
      total: assets.length,
      message: 'OK',
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/employees — create employee
router.post('/', [
  requirePermission('employees:create'),
  body('name').notEmpty().withMessage('Employee name is required').trim().isLength({ max: 150 }),
  body('email').notEmpty().withMessage('Email is required').isEmail().withMessage('Must be a valid email').normalizeEmail(),
  body('department').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 100 }),
  body('location').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 100 }),
  body('address').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 500 }),
  body('avatarUrl').optional({ nullable: true, checkFalsy: true }).isURL().withMessage('Must be a valid URL'),
  body('grantAccess').optional().isBoolean(),
  body('role').optional().isString().trim(),
  body('roleId').optional().isInt({ min: 1 }),
  validateRequest,
], async (req, res, next) => {
  try {
    const { grantAccess, role, roleId, ...employeeData } = req.body;
    
    let effectiveRoleOrId = roleId || role || 'employee';

    if (grantAccess) {
      const { employee, temporaryPassword } = await employeeService.createEmployeeWithAccess({
        ...employeeData,
        roleId: typeof effectiveRoleOrId === 'number' ? effectiveRoleOrId : null,
        role: typeof effectiveRoleOrId === 'string' ? effectiveRoleOrId : null,
      });
      return res.status(201).json({ data: employee, temporaryPassword, message: 'Employee created with login access' });
    }

    const created = await employeeService.createEmployee(req.body);
    res.status(201).json({ data: created, message: 'Employee created successfully' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/employees/:id — soft delete employee
router.delete('/:id', [
  requirePermission('employees:delete'),
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  validateRequest,
], async (req, res, next) => {
  try {
    const result = await employeeService.deleteEmployee(Number(req.params.id));
    res.status(200).json({
      data: result,
      message: 'Employee soft-deleted successfully',
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/employees/:id/role — change user role
router.patch('/:id/role', [
  requirePermission('roles:manage'),
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  body('role').optional().isString().trim(),
  body('roleId').optional().isInt({ min: 1 }),
  validateRequest,
], async (req, res, next) => {
  try {
    const roleOrId = req.body.roleId || req.body.role;
    if (!roleOrId) {
      return res.status(400).json({ error: true, message: 'role or roleId is required' });
    }
    const updated = await employeeService.updateEmployeeRole(Number(req.params.id), roleOrId);
    res.status(200).json({
      data: updated,
      message: 'Employee role updated successfully',
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/employees/:id/grant-access — create login account for employee
router.post('/:id/grant-access', [
  requirePermission('employees:grant-access'),
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  body('role').optional().isString().trim(),
  body('roleId').optional().isInt({ min: 1 }),
  validateRequest,
], async (req, res, next) => {
  try {
    const roleOrId = req.body.roleId || req.body.role || 'employee';
    const temporaryPassword = crypto.randomBytes(6).toString('hex');
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    
    const updated = await employeeService.grantEmployeeAccess(Number(req.params.id), roleOrId, passwordHash);
    
    res.status(200).json({
      data: updated,
      temporaryPassword,
      message: 'Login access granted successfully',
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/employees/:id/grant-google-access — Grant Google-only login (TESTING ONLY)
router.post('/:id/grant-google-access', [
  requirePermission('employees:grant-access'),
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  validateRequest,
], async (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: true, message: 'Granting testing Google access is disabled in production environment.' });
  }
  try {
    const updated = await employeeService.grantGoogleAccess(Number(req.params.id));
    res.status(200).json({
      data: updated,
      message: 'Google login access granted successfully',
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/employees/:id — update employee details
router.patch('/:id', [
  requirePermission('employees:manage'),
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('email').optional().isEmail().withMessage('Invalid email format'),
  body('department').optional().trim(),
  body('location').optional().trim(),
  body('address').optional().trim(),
  validateRequest,
], async (req, res, next) => {
  try {
    const updated = await employeeService.updateEmployee(Number(req.params.id), req.body, req.user);
    res.status(200).json({ data: updated, message: 'Employee updated successfully' });
  } catch (err) {
    next(err);
  }
});

// POST /api/employees/:id/assign-assets — bulk assign available assets to employee
router.post('/:id/assign-assets', [
  requirePermission('employees:assign-assets'),
  param('id').isInt({ min: 1 }).withMessage('Employee ID must be a positive integer'),
  body('assetIds').isArray({ min: 1 }).withMessage('assetIds must be a non-empty array'),
  body('assetIds.*').isInt({ min: 1 }).withMessage('Each assetId must be a positive integer'),
  body('note').optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
  validateRequest,
], async (req, res, next) => {
  try {
    const result = await assetService.bulkAssignAssets(
      Number(req.params.id),
      req.body.assetIds,
      req.body.note || null,
      req.user
    );
    res.status(200).json({ data: result, message: `${result.assigned} asset(s) assigned successfully` });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
