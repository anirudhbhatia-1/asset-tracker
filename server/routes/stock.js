const express = require('express');
const { body, query } = require('express-validator');
const validateRequest = require('../middleware/validateRequest');
const { validateSession, requirePermission, hasPermission } = require('../middleware/validateSession');
const stockService = require('../services/stockService');

const router = express.Router();

router.use(validateSession);

const requireNumericParam = (req, res, next, value, name) => (
  /^[1-9]\d{0,9}$/.test(value)
    ? next()
    : res.status(400).json({ error: true, message: `${name} must be a positive integer`, code: 400 })
);
router.param('id', requireNumericParam);
router.param('employeeId', requireNumericParam);

const rejectRepeatedQuery = (req, res, next) => {
  const repeated = Object.keys(req.query).filter((key) => Array.isArray(req.query[key]));
  if (repeated.length > 0) {
    return res.status(400).json({ error: true, message: `Filter given more than once: ${repeated.join(', ')}`, code: 400 });
  }
  next();
};

const quantityField = (field) => field.isInt({ min: 1, max: 100000 }).withMessage('Quantity must be a whole number from 1 to 100000').toInt();
const itemFields = (optional) => [
  optional
    ? body('name').optional().isString().trim().notEmpty().withMessage('Name cannot be empty').isLength({ max: 150 })
    : body('name').isString().trim().notEmpty().withMessage('Name is required').isLength({ max: 150 }),
  body('categoryId').optional({ nullable: true }).isInt({ min: 1 }).toInt(),
  body('location').optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body('costCents').optional({ nullable: true }).isInt({ min: 0, max: 2147483647 }).withMessage('Cost must be between ₹0 and ₹21,474,836').toInt(),
  body('lowStockThreshold').optional({ nullable: true }).isInt({ min: 0, max: 100000 }).toInt(),
  body('notes').optional({ nullable: true }).isString().isLength({ max: 2000 }),
];

// GET /api/stock — bulk items with total / given out / in stock
router.get('/', [
  requirePermission('assets:read'),
  rejectRepeatedQuery,
  query('categoryId').optional().isInt({ min: 1 }),
  query('location').optional().isString(),
  query('q').optional().isString(),
  validateRequest,
], async (req, res, next) => {
  try {
    const items = await stockService.getItems(req.query);
    res.status(200).json({ data: items, total: items.length, message: 'OK' });
  } catch (err) {
    next(err);
  }
});

// GET /api/stock/mine — what the signed-in person holds
router.get('/mine', async (req, res, next) => {
  try {
    res.status(200).json({ data: await stockService.getHoldingsForEmployee(req.user.id), message: 'OK' });
  } catch (err) {
    next(err);
  }
});

// GET /api/stock/holdings/:employeeId — what one employee holds
router.get('/holdings/:employeeId', (req, res, next) => {
  const allowed = Number(req.params.employeeId) === Number(req.user.id)
    || hasPermission(req.user, 'employees:read') || hasPermission(req.user, 'assets:read');
  if (!allowed) return res.status(403).json({ error: true, message: "Forbidden - Requires 'employees:read' permission", code: 403 });
  next();
}, async (req, res, next) => {
  try {
    res.status(200).json({ data: await stockService.getHoldingsForEmployee(Number(req.params.employeeId)), message: 'OK' });
  } catch (err) {
    next(err);
  }
});

// GET /api/stock/:id — item with who has it and its history
router.get('/:id', requirePermission('assets:read'), async (req, res, next) => {
  try {
    res.status(200).json({ data: await stockService.getItemById(Number(req.params.id)), message: 'OK' });
  } catch (err) {
    next(err);
  }
});

// POST /api/stock — add a bulk item with its starting quantity
router.post('/', [
  requirePermission('assets:create'),
  ...itemFields(false),
  body('quantity').optional().isInt({ min: 0, max: 100000 }).withMessage('Quantity must be a whole number from 0 to 100000').toInt(),
  validateRequest,
], async (req, res, next) => {
  try {
    res.status(201).json({ data: await stockService.createItem(req.body, req.user), message: 'Bulk item added' });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/stock/:id — edit details (not quantities)
router.patch('/:id', [
  requirePermission('assets:update'),
  ...itemFields(true),
  body('quantity').not().exists().withMessage('Use "Add / remove stock" to change quantities'),
  body('totalQuantity').not().exists().withMessage('Use "Add / remove stock" to change quantities'),
  validateRequest,
], async (req, res, next) => {
  try {
    res.status(200).json({ data: await stockService.updateItem(Number(req.params.id), req.body, req.user), message: 'Bulk item updated' });
  } catch (err) {
    next(err);
  }
});

// POST /api/stock/:id/adjust { change: +20 | -3, note } — delivery or shelf loss
router.post('/:id/adjust', [
  requirePermission('assets:update'),
  body('change').isInt({ min: -100000, max: 100000 }).withMessage('Change must be a whole number').toInt(),
  body('note').optional({ nullable: true }).isString().isLength({ max: 500 }),
  validateRequest,
], async (req, res, next) => {
  try {
    res.status(200).json({
      data: await stockService.adjustStock(Number(req.params.id), req.body.change, req.body.note, req.user),
      message: 'Stock updated',
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/stock/:id/assign { employeeId, quantity, note, assignedDate }
router.post('/:id/assign', [
  requirePermission('assets:assign'),
  body('employeeId').isInt({ min: 1 }).withMessage('Choose an employee').toInt(),
  quantityField(body('quantity').optional()),
  body('note').optional({ nullable: true }).isString().isLength({ max: 500 }),
  body('assignedDate').optional({ nullable: true, checkFalsy: true }).isISO8601({ strict: true, strictSeparator: true }).withMessage('Use a YYYY-MM-DD date'),
  validateRequest,
], async (req, res, next) => {
  try {
    const item = await stockService.assign(
      Number(req.params.id), req.body.employeeId, req.body.quantity ?? 1, req.body.note, req.user, req.body.assignedDate || null
    );
    res.status(200).json({ data: item, message: 'Assigned' });
  } catch (err) {
    next(err);
  }
});

// POST /api/stock/:id/return { employeeId, quantity, note } — back on the shelf
router.post('/:id/return', [
  requirePermission('assets:assign'),
  body('employeeId').isInt({ min: 1 }).toInt(),
  quantityField(body('quantity').optional()),
  body('note').optional({ nullable: true }).isString().isLength({ max: 500 }),
  validateRequest,
], async (req, res, next) => {
  try {
    const item = await stockService.takeBack(Number(req.params.id), req.body.employeeId, req.body.quantity ?? 1, req.body.note, req.user);
    res.status(200).json({ data: item, message: 'Returned to stock' });
  } catch (err) {
    next(err);
  }
});

// POST /api/stock/:id/write-off { employeeId, quantity, note } — lost or broken
router.post('/:id/write-off', [
  requirePermission('assets:delete'),
  body('employeeId').isInt({ min: 1 }).toInt(),
  quantityField(body('quantity').optional()),
  body('note').optional({ nullable: true }).isString().isLength({ max: 500 }),
  validateRequest,
], async (req, res, next) => {
  try {
    const item = await stockService.takeBack(
      Number(req.params.id), req.body.employeeId, req.body.quantity ?? 1, req.body.note, req.user, { writeOff: true }
    );
    res.status(200).json({ data: item, message: 'Written off' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/stock/:id — remove from the list (history is kept)
router.delete('/:id', requirePermission('assets:delete'), async (req, res, next) => {
  try {
    res.status(200).json({ data: await stockService.deleteItem(Number(req.params.id), req.user), message: 'Bulk item removed' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
