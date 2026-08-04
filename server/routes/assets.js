const express = require('express');
const { body, param } = require('express-validator');
const validateRequest = require('../middleware/validateRequest');
const assetService = require('../services/assetService');
const historyService = require('../services/historyService');
const { validateSession, requireRole } = require('../middleware/validateSession');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exportAssetsToExcel, importAssetsFromExcel } = require('../services/importExportService');

const upload = multer({
  dest: path.join(__dirname, '../tmp/'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.originalname.endsWith('.xlsx')) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx files are accepted'));
    }
  }
});

const router = express.Router();

router.use(validateSession);

// GET /api/assets — list assets with optional filters
router.get('/', requireRole('admin', 'hr'), async (req, res, next) => {
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

// GET /api/assets/export — download all assets as .xlsx
router.get('/export', requireRole('admin', 'hr'), async (req, res, next) => {
  try {
    const workbook = await exportAssetsToExcel();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=AssetTrack_Export_${new Date().toISOString().substring(0,10)}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
});

// POST /api/assets/import — upload .xlsx and import rows
router.post('/import', requireRole('admin', 'hr'), upload.single('file'), async (req, res, next) => {
  const filePath = req.file?.path;
  try {
    if (!filePath) {
      return res.status(400).json({ error: true, message: 'No file uploaded' });
    }
    const results = await importAssetsFromExcel(filePath, req.user);
    res.status(200).json({
      data: results,
      message: `Import complete: ${results.imported} imported, ${results.skipped.length} skipped`
    });
  } catch (err) {
    next(err);
  } finally {
    // Always delete the temp file
    if (filePath) {
      fs.unlink(filePath, () => {});
    }
  }
});

// GET /api/assets/:id — get single asset with history
router.get('/:id', [
  requireRole('admin', 'hr', 'employee'),
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
  requireRole('admin', 'hr', 'employee'),
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
  requireRole('admin'),
  body('name').notEmpty().withMessage('Asset name is required').trim().isLength({ max: 150 }),
  body('serialNumber').notEmpty().withMessage('Serial number is required').trim().isLength({ max: 100 }),
  body('categoryId').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }),
  body('model').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 150 }),
  body('status').optional({ nullable: true, checkFalsy: true }).isIn(['available', 'in-use', 'retired']).withMessage('Invalid status'),
  body('assetType').optional({ nullable: true, checkFalsy: true }).isIn(['company', 'client']).withMessage('Invalid asset type'),
  body('location').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 100 }),
  body('address').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 500 }),
  body('costCents').optional({ nullable: true, checkFalsy: true }).isInt({ min: 0 }).withMessage('Cost must be positive integer cents'),
  body('purchaseDate').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('Must be valid ISO date (YYYY-MM-DD)'),
  body('notes').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 1000 }),
  body('warrantyExpiryDate').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('Must be valid ISO date (YYYY-MM-DD)'),
  body('assignedTo').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }),
  body('assignedDate').optional({ nullable: true, checkFalsy: true }).isISO8601(),
  validateRequest,
], async (req, res, next) => {
  try {
    const created = await assetService.createAsset(req.body, req.user);
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
  requireRole('admin'),
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  body('name').optional({ nullable: true, checkFalsy: true }).notEmpty().trim().isLength({ max: 150 }),
  body('serialNumber').optional({ nullable: true, checkFalsy: true }).notEmpty().trim().isLength({ max: 100 }),
  body('categoryId').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }),
  body('model').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 150 }),
  body('assetType').optional({ nullable: true, checkFalsy: true }).isIn(['company', 'client']).withMessage('Invalid asset type'),
  body('location').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 100 }),
  body('address').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 500 }),
  body('costCents').optional({ nullable: true, checkFalsy: true }).isInt({ min: 0 }),
  body('purchaseDate').optional({ nullable: true, checkFalsy: true }).isISO8601(),
  body('notes').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 1000 }),
  body('warrantyExpiryDate').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('Must be valid ISO date (YYYY-MM-DD)'),
  validateRequest,
], async (req, res, next) => {
  try {
    const updated = await assetService.updateAsset(Number(req.params.id), req.body, req.user);
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
  requireRole('admin'),
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  validateRequest,
], async (req, res, next) => {
  try {
    const result = await assetService.deleteAsset(Number(req.params.id), req.body?.confirm, req.user);
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
  requireRole('admin'),
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
      req.body.note,
      req.user
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
  requireRole('admin'),
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  body('note').optional().isString().trim().isLength({ max: 500 }),
  validateRequest,
], async (req, res, next) => {
  try {
    const returned = await assetService.returnAsset(Number(req.params.id), req.body?.note, req.user);
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
  requireRole('admin'),
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  body('note').optional().isString().trim().isLength({ max: 500 }),
  validateRequest,
], async (req, res, next) => {
  try {
    const retired = await assetService.retireAsset(Number(req.params.id), req.body?.note, req.body?.confirm, req.user);
    res.status(200).json({
      data: retired,
      message: 'Asset decommissioned and retired successfully',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
