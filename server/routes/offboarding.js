const express = require('express');
const { body, query } = require('express-validator');
const validateRequest = require('../middleware/validateRequest');
const { validateSession, requirePermission } = require('../middleware/validateSession');
const offboardingService = require('../services/offboardingService');
const { parsePagination } = require('../utils/pagination');

const router = express.Router();

router.use(validateSession);

const requireNumericParam = (req, res, next, value, name) => (
  /^[1-9]\d{0,9}$/.test(value)
    ? next()
    : res.status(400).json({ error: true, message: `${name} must be a positive integer`, code: 400 })
);
router.param('id', requireNumericParam);
router.param('itemId', requireNumericParam);

const strictDate = (field) => field.isISO8601({ strict: true, strictSeparator: true })
  .withMessage('Use a YYYY-MM-DD date');

// GET /api/offboarding?status=open|pending|in_progress|completed|cancelled&employeeId=
router.get('/', [
  requirePermission('offboarding:read'),
  query('status').optional().isIn(['open', 'pending', 'in_progress', 'completed', 'cancelled']),
  query('employeeId').optional().isInt({ min: 1 }),
  validateRequest,
], async (req, res, next) => {
  try {
    const repeated = Object.keys(req.query).filter((key) => Array.isArray(req.query[key]));
    if (repeated.length > 0) {
      return res.status(400).json({ error: true, message: `Filter given more than once: ${repeated.join(', ')}`, code: 400 });
    }
    // Optional paging (?limit=&offset=); without it, the full list as before.
    const page = parsePagination(req.query);
    const filters = { status: req.query.status, employeeId: req.query.employeeId };
    if (page) {
      const { rows, total } = await offboardingService.getRequests(filters, page);
      return res.status(200).json({ data: rows, total, limit: page.limit, offset: page.offset, message: 'OK' });
    }
    const requests = await offboardingService.getRequests(filters);
    res.status(200).json({ data: requests, total: requests.length, message: 'OK' });
  } catch (err) {
    next(err);
  }
});

// GET /api/offboarding/:id — request with its asset checklist
router.get('/:id', requirePermission('offboarding:read'), async (req, res, next) => {
  try {
    const request = await offboardingService.getRequestById(Number(req.params.id));
    if (!request) return res.status(404).json({ error: true, message: 'Offboarding request not found', code: 404 });
    res.status(200).json({ data: request, message: 'OK' });
  } catch (err) {
    next(err);
  }
});

// POST /api/offboarding — start an exit for an employee
router.post('/', [
  requirePermission('offboarding:create'),
  body('employeeId').isInt({ min: 1 }).withMessage('Choose an employee'),
  strictDate(body('lastWorkingDate')),
  body('reason').optional({ nullable: true, checkFalsy: true }).isIn(offboardingService.REASONS),
  body('notes').optional({ nullable: true }).isString().isLength({ max: 2000 }),
  body('revokeAccess').optional().isBoolean({ strict: true }),
  validateRequest,
], async (req, res, next) => {
  try {
    const request = await offboardingService.createRequest(req.user, req.body);
    res.status(201).json({ data: request, message: 'Offboarding started' });
  } catch (err) {
    next(err);
  }
});

// PUT /api/offboarding/:id — edit date, reason, notes, access setting
router.put('/:id', [
  requirePermission('offboarding:update'),
  strictDate(body('lastWorkingDate').optional()),
  body('reason').optional({ nullable: true, checkFalsy: true }).isIn(offboardingService.REASONS),
  body('notes').optional({ nullable: true }).isString().isLength({ max: 2000 }),
  body('revokeAccess').optional().isBoolean({ strict: true }),
  validateRequest,
], async (req, res, next) => {
  try {
    const request = await offboardingService.updateRequest(Number(req.params.id), req.body, req.user);
    res.status(200).json({ data: request, message: 'Offboarding updated' });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/offboarding/:id/items/:itemId — mark an asset returned or missing
router.patch('/:id/items/:itemId', [
  requirePermission('offboarding:collect'),
  body('outcome').isIn(['returned', 'missing']),
  body('condition').optional({ nullable: true }).isIn(['good', 'damaged']),
  body('notes').optional({ nullable: true }).isString().isLength({ max: 1000 }),
  validateRequest,
], async (req, res, next) => {
  try {
    const request = await offboardingService.resolveItem(
      Number(req.params.id), Number(req.params.itemId), req.body, req.user
    );
    res.status(200).json({ data: request, message: 'Checklist updated' });
  } catch (err) {
    next(err);
  }
});

// POST /api/offboarding/:id/complete
router.post('/:id/complete', [
  requirePermission('offboarding:update'),
  body('revokeAccess').optional().isBoolean({ strict: true }),
  body('deactivateEmployee').optional().isBoolean({ strict: true }),
  validateRequest,
], async (req, res, next) => {
  try {
    const request = await offboardingService.completeRequest(Number(req.params.id), req.body, req.user);
    res.status(200).json({ data: request, message: 'Offboarding completed' });
  } catch (err) {
    next(err);
  }
});

// POST /api/offboarding/:id/cancel
router.post('/:id/cancel', requirePermission('offboarding:update'), async (req, res, next) => {
  try {
    const request = await offboardingService.cancelRequest(Number(req.params.id), req.user);
    res.status(200).json({ data: request, message: 'Offboarding cancelled' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
