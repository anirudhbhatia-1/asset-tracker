const express = require('express');
const { body, param } = require('express-validator');
const validateRequest = require('../middleware/validateRequest');
const assetService = require('../services/assetService');
const historyService = require('../services/historyService');

const { validateSession, requireRole } = require('../middleware/validateSession');

const router = express.Router();

router.use(validateSession, requireRole('admin'));

// GET /api/assets — list assets with optional filters
router.get('/', async (req, res, next) => {
  try {
    const assets = await assetService.getAssets(req.query);
    res.status(200).json({
      data: assets,
      total: assets.length,
      message: 'OK',
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/assets/:id — get single asset with history
router.get('/:id', [
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  validateRequest,
], async (req, res, next) => {
  try {
    const asset = await assetService.getAssetById(Number(req.params.id));
    res.status(200).json({
      data: asset,
      message: 'OK',
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/assets/:id/history — get full history for one asset
router.get('/:id/history', [
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  validateRequest,
], async (req, res, next) => {
  try {
    // Ensure asset exists first
    await assetService.getAssetById(Number(req.params.id));
    const history = await historyService.getAssetHistory(Number(req.params.id));
    res.status(200).json({
      data: history,
      total: history.length,
      message: 'OK',
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/assets — create asset
router.post('/', [
  body('name').notEmpty().withMessage('Asset name is required').trim().isLength({ max: 150 }),
  body('serialNumber').notEmpty().withMessage('Serial number is required').trim().isLength({ max: 100 }),
  body('categoryId').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }),
  body('model').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 150 }),
  body('status').optional({ nullable: true, checkFalsy: true }).isIn(['available', 'in-use', 'retired']).withMessage('Invalid status'),
  body('location').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 100 }),
  body('costCents').optional({ nullable: true, checkFalsy: true }).isInt({ min: 0 }).withMessage('Cost must be positive integer cents'),
  body('purchaseDate').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('Must be valid ISO date (YYYY-MM-DD)'),
  body('notes').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 1000 }),
  body('assignedTo').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }),
  body('assignedDate').optional({ nullable: true, checkFalsy: true }).isISO8601(),
  validateRequest,
], async (req, res, next) => {
  try {
    const created = await assetService.createAsset(req.body);
    res.status(201).json({
      data: created,
      message: 'Asset created successfully',
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/assets/:id — update asset
router.put('/:id', [
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  body('name').optional({ nullable: true, checkFalsy: true }).notEmpty().trim().isLength({ max: 150 }),
  body('serialNumber').optional({ nullable: true, checkFalsy: true }).notEmpty().trim().isLength({ max: 100 }),
  body('categoryId').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }),
  body('model').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 150 }),
  body('location').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 100 }),
  body('costCents').optional({ nullable: true, checkFalsy: true }).isInt({ min: 0 }),
  body('purchaseDate').optional({ nullable: true, checkFalsy: true }).isISO8601(),
  body('notes').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 1000 }),
  validateRequest,
], async (req, res, next) => {
  try {
    const updated = await assetService.updateAsset(Number(req.params.id), req.body);
    res.status(200).json({
      data: updated,
      message: 'Asset updated successfully',
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/assets/:id — delete asset (requires confirm: true)
router.delete('/:id', [
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  validateRequest,
], async (req, res, next) => {
  try {
    const result = await assetService.deleteAsset(Number(req.params.id), req.body?.confirm);
    res.status(200).json({
      data: result,
      message: 'Asset permanently deleted',
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/assets/:id/assign — assign asset to employee
router.post('/:id/assign', [
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  body('employeeId').notEmpty().withMessage('employeeId is required').isInt({ min: 1 }),
  body('assignedDate').optional().isISO8601().withMessage('Must be valid ISO date'),
  body('note').optional().isString().trim().isLength({ max: 500 }),
  validateRequest,
], async (req, res, next) => {
  try {
    const assigned = await assetService.assignAsset(
      Number(req.params.id),
      Number(req.body.employeeId),
      req.body.assignedDate,
      req.body.note
    );
    res.status(200).json({
      data: assigned,
      message: 'Asset assigned successfully',
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/assets/:id/return — return asset to stock
router.post('/:id/return', [
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  body('note').optional().isString().trim().isLength({ max: 500 }),
  validateRequest,
], async (req, res, next) => {
  try {
    const returned = await assetService.returnAsset(Number(req.params.id), req.body?.note);
    res.status(200).json({
      data: returned,
      message: 'Asset returned to stock successfully',
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/assets/:id/retire — retire asset (requires confirm: true)
router.post('/:id/retire', [
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  body('note').optional().isString().trim().isLength({ max: 500 }),
  validateRequest,
], async (req, res, next) => {
  try {
    const retired = await assetService.retireAsset(Number(req.params.id), req.body?.note, req.body?.confirm);
    res.status(200).json({
      data: retired,
      message: 'Asset decommissioned and retired successfully',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
