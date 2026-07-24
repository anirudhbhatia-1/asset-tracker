const express = require('express');
const { param } = require('express-validator');
const validateRequest = require('../middleware/validateRequest');
const assetService = require('../services/assetService');

const rateLimit = require('express-rate-limit');

const router = express.Router();

const scanLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 scan requests per `window` (here, per minute)
  message: { message: 'Too many scan requests from this IP, please try again after a minute' },
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
