const express = require('express');
const { body, param } = require('express-validator');
const validateRequest = require('../middleware/validateRequest');
const { validateSession, requireRole } = require('../middleware/validateSession');
const onboardingService = require('../services/onboardingService');

const router = express.Router();

router.use(validateSession);

// GET /api/onboarding — admin and hr can view all
router.get('/', requireRole('admin', 'hr'), async (req, res, next) => {
  try {
    const requests = await onboardingService.getRequests();
    res.status(200).json({
      data: requests,
      total: requests.length,
      message: 'OK'
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/onboarding/hr-metrics
router.get('/hr-metrics', requireRole('hr'), async (req, res, next) => {
  try {
    const metrics = await onboardingService.getHrMetrics();
    res.status(200).json({
      data: metrics,
      message: 'OK'
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/onboarding/:id
router.get('/:id', [
  requireRole('admin', 'hr'),
  param('id').isInt({ min: 1 }),
  validateRequest
], async (req, res, next) => {
  try {
    const request = await onboardingService.getRequestById(req.params.id);
    if (!request) {
      return res.status(404).json({ error: true, message: 'Request not found', code: 404 });
    }
    res.status(200).json({
      data: request,
      message: 'OK'
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/onboarding — hr creates request
router.post('/', [
  requireRole('hr'),
  body('newHireName').notEmpty().withMessage('Name is required').trim(),
  body('newHireEmail').optional({ nullable: true, checkFalsy: true }).isEmail(),
  body('department').optional({ nullable: true, checkFalsy: true }).isString(),
  body('location').optional({ nullable: true, checkFalsy: true }).isString(),
  body('joiningDate').isISO8601().withMessage('Valid date required'),
  body('notes').optional({ nullable: true, checkFalsy: true }).isString(),
  body('items').optional().isArray(),
  body('items.*.categoryId').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }),
  body('items.*.quantity').optional().isInt({ min: 1 }),
  body('items.*.notes').optional().isString(),
  validateRequest
], async (req, res, next) => {
  try {
    const request = await onboardingService.createRequest(req.user, req.body);
    res.status(201).json({
      data: request,
      message: 'Onboarding request created'
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/onboarding/:id/status — admin updates status
router.put('/:id/status', [
  requireRole('admin'),
  param('id').isInt({ min: 1 }),
  body('status').isIn(['pending', 'in_progress', 'arranged', 'completed', 'cancelled']),
  validateRequest
], async (req, res, next) => {
  try {
    const request = await onboardingService.updateRequestStatus(req.params.id, req.body.status, req.user);
    if (!request) {
      return res.status(404).json({ error: true, message: 'Request not found', code: 404 });
    }
    res.status(200).json({
      data: request,
      message: 'Status updated'
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/onboarding/:id/items/:itemId/fulfill — admin links an asset to a requested item
router.patch('/:id/items/:itemId/fulfill', [
  requireRole('admin'),
  param('id').isInt({ min: 1 }),
  param('itemId').isInt({ min: 1 }),
  body('assetId').optional({ nullable: true }).isInt({ min: 1 }),
  validateRequest
], async (req, res, next) => {
  try {
    const item = await onboardingService.fulfillItem(req.params.id, req.params.itemId, req.body.assetId || null);
    if (!item) {
      return res.status(404).json({ error: true, message: 'Item not found in this request', code: 404 });
    }
    // Return updated full request for convenience
    const request = await onboardingService.getRequestById(req.params.id);
    res.status(200).json({
      data: request,
      message: 'Item fulfilled'
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
