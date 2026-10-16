const express = require('express');
const { param } = require('express-validator');
const validateRequest = require('../middleware/validateRequest');
const assetService = require('../services/assetService');

const rateLimit = require('express-rate-limit');

const { validateSession, requirePermission } = require('../middleware/validateSession');

const router = express.Router();

router.use(validateSession, requirePermission('scanner:read'));

// Per signed-in user (every request here is authenticated), at stocktake
// pace: two scans a second. Counting by IP would make everyone in the office
// share one small budget; the global per-IP limiter still caps floods.
const SCANS_PER_MINUTE = 120;
const scanLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: SCANS_PER_MINUTE,
  keyGenerator: (req) => `user:${req.user.id}`,
  message: { message: 'Too many scans in a minute. Wait a moment and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /api/serial/scan/:serial — look up asset by serial number
router.get('/scan/:serial', scanLimiter, [
  param('serial').notEmpty().withMessage('Serial number parameter is required').trim(),
  validateRequest,
], async (req, res, next) => {
  try {
    const asset = await assetService.getAssetBySerial(req.params.serial);
    res.status(200).json({
      data: asset,
      message: 'OK',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
