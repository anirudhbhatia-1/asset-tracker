const express = require('express');
const { param } = require('express-validator');
const validateRequest = require('../middleware/validateRequest');
const assetService = require('../services/assetService');

const router = express.Router();

// GET /api/serial/scan/:serial — look up asset by serial number
router.get('/scan/:serial', [
  param('serial').notEmpty().withMessage('Serial number parameter is required').trim(),
  validateRequest,
], (req, res, next) => {
  try {
    const asset = assetService.getAssetBySerial(req.params.serial);
    res.status(200).json({
      data: asset,
      message: 'OK',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
