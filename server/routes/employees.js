const express = require('express');
const { body, param } = require('express-validator');
const validateRequest = require('../middleware/validateRequest');
const employeeService = require('../services/employeeService');

const { validateSession, requireRole } = require('../middleware/validateSession');

const router = express.Router();

router.use(validateSession);

// GET /api/employees — list all employees
router.get('/', requireRole('admin', 'hr'), async (req, res, next) => {
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
router.get('/departments', requireRole('admin', 'hr'), async (req, res, next) => {
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

// GET /api/employees/:id — get single employee
router.get('/:id', [
  requireRole('admin', 'hr'),
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
    if (req.user.role !== 'admin' && req.user.id !== requestedId) {
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
  requireRole('admin', 'hr'),
  body('name').notEmpty().withMessage('Employee name is required').trim().isLength({ max: 150 }),
  body('email').notEmpty().withMessage('Email is required').isEmail().withMessage('Must be a valid email').normalizeEmail(),
  body('department').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 100 }),
  body('location').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 100 }),
  body('address').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 500 }),
  body('avatarUrl').optional({ nullable: true, checkFalsy: true }).isURL().withMessage('Must be a valid URL'),
  // Optional: grant login access at creation time
  body('grantAccess').optional().isBoolean(),
  body('role').optional().isIn(['admin', 'employee', 'hr']).withMessage('Invalid role'),
  validateRequest,
], async (req, res, next) => {
  try {
    const { grantAccess, role, ...employeeData } = req.body;
    
    // HR can only create employees, not admins or other HRs
    let effectiveRole = role || 'employee';
    if (req.user.role === 'hr' && effectiveRole !== 'employee') {
      effectiveRole = 'employee'; // Force to employee role
    }

    if (grantAccess) {
      const { employee, temporaryPassword } = await employeeService.createEmployeeWithAccess({
        ...employeeData,
        role: effectiveRole,
      });
      return res.status(201).json({ data: employee, temporaryPassword, message: 'Employee created with login access' });
    }

    const created = await employeeService.createEmployee(req.body);
    res.status(201).json({ data: created, message: 'Employee created successfully' });
  } catch (err) {
    next(err);
  }
});

// PUT /api/employees/:id — update employee
router.put('/:id', [
  requireRole('admin', 'hr'),
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  body('name').optional({ nullable: true, checkFalsy: true }).notEmpty().trim().isLength({ max: 150 }),
  body('email').optional({ nullable: true, checkFalsy: true }).isEmail().withMessage('Must be a valid email').normalizeEmail(),
  body('department').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 100 }),
  body('location').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 100 }),
  body('address').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 500 }),
  body('avatarUrl').optional({ nullable: true, checkFalsy: true }).isURL(),
  validateRequest,
], async (req, res, next) => {
  try {
    if (req.user.role === 'hr') {
      delete req.body.role;
    }
    const updated = await employeeService.updateEmployee(Number(req.params.id), req.body);
    res.status(200).json({ data: updated, message: 'Employee updated successfully' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/employees/:id — soft delete employee
router.delete('/:id', [
  requireRole('admin'),
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
  requireRole('admin'),
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  body('role').isIn(['admin', 'employee', 'hr']).withMessage('Invalid role'),
  validateRequest,
], async (req, res, next) => {
  try {
    const updated = await employeeService.updateEmployeeRole(Number(req.params.id), req.body.role);
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
  requireRole('admin'),
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  body('role').isIn(['admin', 'employee', 'hr']).withMessage('Invalid role'),
  validateRequest,
], async (req, res, next) => {
  try {
    const bcrypt = require('bcrypt');
    const crypto = require('crypto');
    
    // Generate a secure temporary password
    const temporaryPassword = crypto.randomBytes(6).toString('hex'); // 12 chars
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    
    const updated = await employeeService.grantEmployeeAccess(Number(req.params.id), req.body.role, passwordHash);
    
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
// WHEN GOING TO PRODUCTION: Remove this route.
router.post('/:id/grant-google-access', [
  requireRole('admin'),
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  validateRequest,
], async (req, res, next) => {
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
// PATCH /api/employees/:id — update employee details (admin only)
router.patch('/:id', [
  requireRole('admin', 'hr'),
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('email').optional().isEmail().withMessage('Invalid email format'),
  body('department').optional().trim(),
  body('location').optional().trim(),
  body('address').optional().trim(),
  body('role').optional().isIn(['admin', 'employee', 'hr']).withMessage('Invalid role'),
  validateRequest,
], async (req, res, next) => {
  try {
    if (req.user.role === 'hr') {
      delete req.body.role;
    }
    const updated = await employeeService.updateEmployee(Number(req.params.id), req.body);
    res.status(200).json({ data: updated, message: 'Employee updated successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
