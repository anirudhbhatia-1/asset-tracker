const express = require('express');
const { body, param } = require('express-validator');
const validateRequest = require('../middleware/validateRequest');
const assetService = require('../services/assetService');
const historyService = require('../services/historyService');
const ticketService = require('../services/ticketService');
const { validateSession, requireRole, requirePermission, hasPermission } = require('../middleware/validateSession');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exportAssetsToExcel, importAssetsFromExcel } = require('../services/importExportService');
const { importAssetsFromCsv } = require('../services/csvImportService');
const auditService = require('../services/auditService');

// data.exported / data.imported entries; recorded after the work is done and
// never able to fail the request.
const auditData = (req, eventType, details) => auditService.record(undefined, {
  eventType,
  actor: req.user,
  targetType: 'system',
  targetName: 'Assets',
  details,
});

const upload = multer({
  dest: path.join(__dirname, '../tmp/'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.originalname.toLowerCase().endsWith('.xlsx')) {
      cb(null, true);
    } else {
      const err = new Error('Only .xlsx files are accepted');
      err.statusCode = 400;
      cb(err);
    }
  }
});

const csvUpload = multer({
  dest: path.join(__dirname, '../tmp/'),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    if (file.originalname.toLowerCase().endsWith('.csv')) {
      cb(null, true);
    } else {
      const err = new Error('Only .csv files are accepted');
      err.statusCode = 400;
      cb(err);
    }
  }
});

const router = express.Router();

router.use(validateSession);

// GET /api/assets — list assets with optional filters
router.get('/', requirePermission('assets:read'), async (req, res, next) => {
  try {
    // Filters take one value each; ?status=a&status=b would reach SQL as an array.
    const repeated = Object.keys(req.query).filter((key) => Array.isArray(req.query[key]));
    if (repeated.length > 0) {
      return res.status(400).json({ error: true, message: `Filter given more than once: ${repeated.join(', ')}`, code: 400 });
    }
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

// GET /api/assets/serial-exists?serial=… — uniqueness check for the Add Asset
// form (auto-generated serials). Needs only assets:create, unlike the
// rate-limited scanner lookup.
router.get('/serial-exists', requirePermission('assets:create'), async (req, res, next) => {
  try {
    const serial = typeof req.query.serial === 'string' ? req.query.serial.trim() : '';
    if (!serial) {
      return res.status(400).json({ error: true, message: 'serial query parameter is required' });
    }
    const exists = await assetService.serialExists(serial);
    res.status(200).json({ data: { exists }, message: 'OK' });
  } catch (err) {
    next(err);
  }
});

// GET /api/assets/available?categoryId= — company stock that can be handed
// out, for the ticket-resolution and fulfilment pickers. Deliberately narrow
// (no costs or holders) so resolvers don't need full inventory access.
router.get('/available', (req, res, next) => {
  const allowed = ['assets:read', 'tickets:resolve', 'onboarding:fulfill', 'employees:assign-assets']
    .some((key) => hasPermission(req.user, key));
  return allowed ? next() : res.status(403).json({ error: true, message: 'Forbidden', code: 403 });
}, async (req, res, next) => {
  try {
    const categoryId = /^\d+$/.test(String(req.query.categoryId || '')) ? Number(req.query.categoryId) : null;
    const assets = await assetService.getAvailableCompanyAssets(categoryId);
    res.status(200).json({ data: assets, total: assets.length, message: 'OK' });
  } catch (err) {
    next(err);
  }
});

// Bulk actions take 1–200 distinct positive integer asset ids.
const BULK_MAX = 200;
const EXPORT_IDS_MAX = 1000;
const isPositiveId = (value) => (Number.isSafeInteger(value) && value > 0)
  || (typeof value === 'string' && /^[1-9]\d{0,9}$/.test(value) && Number(value) <= 2147483647);
const assetIdsField = body('assetIds').custom((value) => {
  if (!Array.isArray(value) || value.length < 1 || value.length > BULK_MAX) {
    throw new Error(`must be a list of 1 to ${BULK_MAX} asset ids`);
  }
  if (!value.every(isPositiveId) || value.some((v) => Number(v) > 2147483647)) {
    throw new Error('each asset id must be a positive integer');
  }
  if (new Set(value.map(Number)).size !== value.length) {
    throw new Error('asset ids must not repeat');
  }
  return true;
});
const assetIdsOf = (req) => req.body.assetIds.map(Number);

// GET /api/assets/export — download assets as .xlsx: everything, or only
// ?ids=1,2,3 (the Inventory selection).
router.get('/export', requirePermission('assets:export'), async (req, res, next) => {
  try {
    const repeated = Object.keys(req.query).filter((key) => Array.isArray(req.query[key]));
    if (repeated.length > 0) {
      return res.status(400).json({ error: true, message: `Filter given more than once: ${repeated.join(', ')}`, code: 400 });
    }
    let ids = null;
    if (req.query.ids !== undefined) {
      const parts = String(req.query.ids).split(',').map((part) => part.trim());
      if (parts.length === 0 || parts.length > EXPORT_IDS_MAX || !parts.every((part) => isPositiveId(part))) {
        return res.status(400).json({ error: true, message: `ids must be a comma-separated list of 1 to ${EXPORT_IDS_MAX} asset ids`, code: 400 });
      }
      ids = [...new Set(parts.map(Number))];
    }
    const workbook = await exportAssetsToExcel({}, { ids });
    // The workbook is built, so the export has happened: record it before
    // streaming, or a dropped download (or an immediate look at the access
    // history) would miss it.
    await auditData(req, 'data.exported', {
      entity: 'assets',
      format: 'xlsx',
      // The export ignores list filters (it is everything, or a selection);
      // a selection is recorded by size, not by listing every id.
      filters: ids ? { ids: ids.length } : null,
      count: workbook.exportedAssetCount ?? null,
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=AssetTrack_Export_${new Date().toISOString().substring(0,10)}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
});

// POST /api/assets/import — upload .xlsx and import rows.
// ?dryRun=true runs the whole import in a transaction and rolls it back.
router.post('/import', requirePermission('assets:import'), upload.single('file'), async (req, res, next) => {
  const filePath = req.file?.path;
  try {
    if (!filePath) {
      return res.status(400).json({ error: true, message: 'No file uploaded' });
    }
    const dryRun = req.query.dryRun === 'true';
    const results = await importAssetsFromExcel(filePath, req.user, {}, { dryRun });
    if (!dryRun) {
      await auditData(req, 'data.imported', {
        entity: 'assets',
        format: 'xlsx',
        fileName: req.file.originalname,
        count: results.imported,
        total: results.total,
        skipped: results.skipped.length,
        errors: results.errors.length,
      });
    }
    const counts = `${results.skipped.length} skipped, ${results.errors.length} with errors`;
    res.status(200).json({
      data: results,
      message: dryRun
        ? `Check complete: ${results.imported} ready to import, ${counts}`
        : `Import complete: ${results.imported} imported, ${counts}`,
    });
  } catch (err) {
    next(err);
  } finally {
    if (filePath) {
      fs.unlink(filePath, () => {});
    }
  }
});

// POST /api/assets/import-csv — bulk add assets from the CSV template.
// ?dryRun=true validates and simulates the import without saving anything.
router.post('/import-csv', requirePermission('assets:import'), csvUpload.single('file'), async (req, res, next) => {
  const filePath = req.file?.path;
  try {
    if (!filePath) {
      return res.status(400).json({ error: true, message: 'No file uploaded' });
    }
    const dryRun = req.query.dryRun === 'true';
    const results = await importAssetsFromCsv(filePath, req.user, { dryRun });
    if (!dryRun) {
      await auditData(req, 'data.imported', {
        entity: 'assets',
        format: 'csv',
        fileName: req.file.originalname,
        count: results.imported,
        total: results.total,
        errors: results.errors.length,
      });
    }
    res.status(200).json({
      data: results,
      message: dryRun
        ? `Check complete: ${results.imported} ready to import, ${results.errors.length} with errors`
        : `Import complete: ${results.imported} imported, ${results.errors.length} with errors`,
    });
  } catch (err) {
    next(err);
  } finally {
    if (filePath) {
      fs.unlink(filePath, () => {});
    }
  }
});

// POST /api/assets/bulk/assign — hand several available company assets to
// one employee. All or nothing.
router.post('/bulk/assign', [
  requirePermission('assets:assign'),
  assetIdsField,
  body('employeeId').notEmpty().withMessage('employeeId is required').isInt({ min: 1, max: 2147483647 }),
  body('note').optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
  validateRequest,
], async (req, res, next) => {
  try {
    const result = await assetService.bulkAssignAssets(
      Number(req.body.employeeId), assetIdsOf(req), req.body.note || null, req.user, { companyOnly: true }
    );
    res.status(200).json({ data: { assigned: result.assigned }, message: `${result.assigned} asset(s) assigned` });
  } catch (err) {
    next(err);
  }
});

// POST /api/assets/bulk/return — return every selected in-use asset; the
// rest are reported as skipped.
router.post('/bulk/return', [
  requirePermission('assets:assign'),
  assetIdsField,
  body('note').optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
  validateRequest,
], async (req, res, next) => {
  try {
    const result = await assetService.bulkReturnAssets(assetIdsOf(req), req.body.note || null, req.user);
    const skippedText = result.skipped.length ? `, ${result.skipped.length} skipped` : '';
    res.status(200).json({ data: result, message: `${result.returned} asset(s) returned${skippedText}` });
  } catch (err) {
    next(err);
  }
});

// POST /api/assets/bulk/update — set location and/or category on several assets.
router.post('/bulk/update', [
  requirePermission('assets:update'),
  assetIdsField,
  body('changes').custom((changes) => {
    if (!changes || typeof changes !== 'object' || Array.isArray(changes)) throw new Error('must be an object');
    const keys = Object.keys(changes);
    const unknown = keys.filter((key) => !['location', 'categoryId'].includes(key));
    if (unknown.length) throw new Error(`unknown field(s): ${unknown.join(', ')}`);
    if (keys.length === 0) throw new Error('choose at least one change (location or categoryId)');
    if ('location' in changes && changes.location !== null) {
      if (typeof changes.location !== 'string') throw new Error('location must be text or null');
      if (changes.location.trim().length > 100) throw new Error('location must be at most 100 characters');
    }
    if ('categoryId' in changes && changes.categoryId !== null && !isPositiveId(changes.categoryId)) {
      throw new Error('categoryId must be a positive integer or null');
    }
    return true;
  }),
  validateRequest,
], async (req, res, next) => {
  try {
    const result = await assetService.bulkUpdateAssets(assetIdsOf(req), req.body.changes, req.user);
    res.status(200).json({ data: result, message: `${result.updated} asset(s) updated` });
  } catch (err) {
    next(err);
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

// GET /api/assets/:id/tickets — tickets linked to this asset (timeline)
router.get('/:id/tickets', [
  requirePermission('assets:read'),
  // Lists other people's tickets about the device: for those who work tickets.
  requirePermission('tickets:resolve'),
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  validateRequest,
], async (req, res, next) => {
  try {
    const tickets = await ticketService.getTicketsForAsset(Number(req.params.id));
    res.status(200).json({ data: tickets, total: tickets.length, message: 'OK' });
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
  body('status').optional().isIn(['available', 'in-use', 'retired', 'returned']).withMessage('Invalid status'),
  body('purchaseDate').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('Must be valid ISO date'),
  body('costCents').optional({ nullable: true }).isInt({ min: 0, max: 2147483647 }),
  body('location').optional({ nullable: true, checkFalsy: true }).isString().trim(),
  body('notes').optional({ nullable: true, checkFalsy: true }).isString().trim(),
  body('warrantyExpiryDate').optional({ nullable: true, checkFalsy: true }).isISO8601({ strict: true }).withMessage('Must be valid ISO date'),
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
  body('receivedOn').optional({ nullable: true, checkFalsy: true }).isISO8601({ strict: true }),
  body('returnDate').optional({ nullable: true, checkFalsy: true }).isISO8601({ strict: true }),
  body('assetType').optional().isIn(['company', 'client']).withMessage('assetType must be company or client'),
  body('assignedTo').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }),
  body('parentId').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }),
  // Accessories registered with the asset (charger, bag…).
  body('subAssets').optional({ nullable: true }).isArray({ max: 20 }).withMessage('subAssets must be a list of at most 20 items'),
  body('subAssets.*').isObject().withMessage('Each accessory must be an object'),
  body('subAssets.*.serialNumber').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 100 }),
  body('subAssets.*.name').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 150 }),
  body('subAssets.*.model').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 150 }),
  body('subAssets.*.categoryId').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }),
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
  body('categoryId').optional({ nullable: true }).isInt({ min: 1 }),
  // Status only changes through assign/return/retire so history stays right.
  body('status').not().exists().withMessage('Change status with the assign, return or retire actions'),
  body('assetType').optional().isIn(['company', 'client']).withMessage('assetType must be company or client'),
  body('purchaseDate').optional({ nullable: true, checkFalsy: true }).isISO8601({ strict: true }),
  body('warrantyExpiryDate').optional({ nullable: true, checkFalsy: true }).isISO8601({ strict: true }),
  body('receivedOn').optional({ nullable: true, checkFalsy: true }).isISO8601({ strict: true }),
  body('returnDate').optional({ nullable: true, checkFalsy: true }).isISO8601({ strict: true }),
  body('costCents').optional({ nullable: true }).isInt({ min: 0, max: 2147483647 }),
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
      req.user,
      // The asset page's Assign/Reassign action may move it from its holder.
      { reassign: true }
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
