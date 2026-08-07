const express = require('express');
const { body, param } = require('express-validator');
const validateRequest = require('../middleware/validateRequest');
const assetService = require('../services/assetService');
const historyService = require('../services/historyService');
const { validateSession, requireRole, requirePermission } = require('../middleware/validateSession');
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
router.get('/', requirePermission('assets:read'), async (req, res, next) => {
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
router.get('/export', requirePermission('assets:export'), async (req, res, next) => {
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
router.post('/import', requirePermission('assets:import'), upload.single('file'), async (req, res, next) => {
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
    if (filePath) {
      fs.unlink(filePath, () => {});
    }
  }
});

// GET /api/assets/:id — get single asset with history
router.get('/:id', [
  requirePermission('assets:read'),
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
  requirePermission('assets:read'),
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  validateRequest,
], async (req, res, next) => {
  try {
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

// POST /api/assets — create new asset
router.post('/', [
  requirePermission('assets:create'),
  body('name').notEmpty().withMessage('Asset name is required').trim().isLength({ max: 150 }),
  body('serialNumber').notEmpty().withMessage('Serial number is required').trim().isLength({ max: 100 }),
  body('categoryId').notEmpty().withMessage('Category ID is required').isInt({ min: 1 }),
  body('status').optional().isIn(['available', 'in-use', 'maintenance', 'retired']).withMessage('Invalid status'),
  body('purchaseDate').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('Must be valid ISO date'),
  body('costCents').optional({ nullable: true }).isInt({ min: 0 }),
  body('location').optional({ nullable: true, checkFalsy: true }).isString().trim(),
  body('notes').optional({ nullable: true, checkFalsy: true }).isString().trim(),
  body('warrantyExpiryDate').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('Must be valid ISO date'),
  body('brand').optional({ nullable: true, checkFalsy: true }).isString().trim(),
  body('vendor').optional({ nullable: true, checkFalsy: true }).isString().trim(),
  body('processor').optional({ nullable: true, checkFalsy: true }).isString().trim(),
  body('ram').optional({ nullable: true, checkFalsy: true }).isString().trim(),
  body('storage').optional({ nullable: true, checkFalsy: true }).isString().trim(),
  body('screenSize').optional({ nullable: true, checkFalsy: true }).isString().trim(),
  body('graphicsCard').optional({ nullable: true, checkFalsy: true }).isString().trim(),
  body('os').optional({ nullable: true, checkFalsy: true }).isString().trim(),
  body('msOffice').optional({ nullable: true, checkFalsy: true }).isString().trim(),
  body('antiVirus').optional({ nullable: true, checkFalsy: true }).isString().trim(),
  body('warrantyPlan').optional({ nullable: true, checkFalsy: true }).isString().trim(),
  body('warrantyUpgrade').optional({ nullable: true, checkFalsy: true }).isString().trim(),
  body('color').optional({ nullable: true, checkFalsy: true }).isString().trim(),
  body('hardwareType').optional({ nullable: true, checkFalsy: true }).isString().trim(),
  body('clientName').optional({ nullable: true, checkFalsy: true }).isString().trim(),
  body('receivedOn').optional({ nullable: true, checkFalsy: true }).isISO8601(),
  body('assignToEmployeeId').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }),
  body('parentId').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }),
  validateRequest,
], async (req, res, next) => {
  try {
    const asset = await assetService.createAsset(req.body, req.user);
    res.status(201).json({
      data: asset,
      message: 'Asset created successfully',
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: true, message: 'Asset with this serial number already exists' });
    }
    next(err);
  }
});

// PATCH /api/assets/:id — update asset metadata
router.patch('/:id', [
  requirePermission('assets:update'),
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  body('name').optional().notEmpty().withMessage('Asset name cannot be empty').trim().isLength({ max: 150 }),
  body('serialNumber').optional().notEmpty().withMessage('Serial number cannot be empty').trim().isLength({ max: 100 }),
  body('categoryId').optional().isInt({ min: 1 }),
  body('status').optional().isIn(['available', 'in-use', 'maintenance', 'retired']).withMessage('Invalid status'),
  body('purchaseDate').optional({ nullable: true, checkFalsy: true }).isISO8601(),
  body('costCents').optional({ nullable: true }).isInt({ min: 0 }),
  body('location').optional({ nullable: true, checkFalsy: true }).isString().trim(),
  body('notes').optional({ nullable: true, checkFalsy: true }).isString().trim(),
  validateRequest,
], async (req, res, next) => {
  try {
    const asset = await assetService.updateAsset(Number(req.params.id), req.body, req.user);
    res.status(200).json({
      data: asset,
      message: 'Asset updated successfully',
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: true, message: 'Asset with this serial number already exists' });
    }
    next(err);
  }
});

// DELETE /api/assets/:id — delete asset (requires confirm: true)
router.delete('/:id', [
  requirePermission('assets:delete'),
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  body('confirm').equals('true').withMessage('Destructive action requires confirm: true'),
  validateRequest,
], async (req, res, next) => {
  try {
    const result = await assetService.deleteAsset(Number(req.params.id), true, req.user);
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
  requirePermission('assets:assign'),
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
  requirePermission('assets:assign'),
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  body('note').optional().isString().trim().isLength({ max: 500 }),
  validateRequest,
], async (req, res, next) => {
  try {
    const returned = await assetService.returnAsset(
      Number(req.params.id),
      req.body.note,
      req.user
    );
    res.status(200).json({
      data: returned,
      message: 'Asset returned to stock successfully',
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/assets/:id/retire — retire asset
router.post('/:id/retire', [
  requirePermission('assets:delete'),
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  body('note').optional().isString().trim().isLength({ max: 500 }),
  body('confirm').equals('true').withMessage('Destructive action requires confirm: true'),
  validateRequest,
], async (req, res, next) => {
  try {
    const retired = await assetService.retireAsset(
      Number(req.params.id),
      req.body.note,
      true,
      req.user
    );
    res.status(200).json({
      data: retired,
      message: 'Asset retired successfully',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
