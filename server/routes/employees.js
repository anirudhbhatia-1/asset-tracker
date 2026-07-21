const express = require('express');
const { body, param } = require('express-validator');
const validateRequest = require('../middleware/validateRequest');
const employeeService = require('../services/employeeService');

const router = express.Router();

// GET /api/employees — list all employees
router.get('/', (req, res, next) => {
  try {
    const employees = employeeService.getEmployees(req.query);
    res.status(200).json({
      data: employees,
      total: employees.length,
      message: 'OK',
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/employees/:id — get single employee
router.get('/:id', [
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  validateRequest,
], (req, res, next) => {
  try {
    const employee = employeeService.getEmployeeById(Number(req.params.id));
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
], (req, res, next) => {
  try {
    const assets = employeeService.getEmployeeAssets(Number(req.params.id));
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
  body('name').notEmpty().withMessage('Employee name is required').trim().isLength({ max: 150 }),
  body('email').notEmpty().withMessage('Email is required').isEmail().withMessage('Must be a valid email').normalizeEmail(),
  body('department').optional().isString().trim().isLength({ max: 100 }),
  body('location').optional().isString().trim().isLength({ max: 100 }),
  body('avatarUrl').optional().isURL().withMessage('Must be a valid URL'),
  validateRequest,
], (req, res, next) => {
  try {
    const created = employeeService.createEmployee(req.body);
    res.status(201).json({
      data: created,
      message: 'Employee created successfully',
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/employees/:id — update employee
router.put('/:id', [
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  body('name').optional().notEmpty().trim().isLength({ max: 150 }),
  body('email').optional().isEmail().withMessage('Must be a valid email').normalizeEmail(),
  body('department').optional().isString().trim().isLength({ max: 100 }),
  body('location').optional().isString().trim().isLength({ max: 100 }),
  body('avatarUrl').optional().isURL(),
  validateRequest,
], (req, res, next) => {
  try {
    const updated = employeeService.updateEmployee(Number(req.params.id), req.body);
    res.status(200).json({
      data: updated,
      message: 'Employee updated successfully',
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/employees/:id — soft delete employee
router.delete('/:id', [
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  validateRequest,
], (req, res, next) => {
  try {
    const result = employeeService.deleteEmployee(Number(req.params.id));
    res.status(200).json({
      data: result,
      message: 'Employee soft-deleted successfully',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
