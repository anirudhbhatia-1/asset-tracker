const express = require('express');
const { body, param } = require('express-validator');
const validateRequest = require('../middleware/validateRequest');
const { validateSession, requirePermission } = require('../middleware/validateSession');
const locationService = require('../services/locationService');

const router = express.Router();

router.use(validateSession);

// GET /api/locations
router.get('/', requirePermission('locations:read'), async (req, res, next) => {
  try {
    const locations = await locationService.getLocations();
    res.status(200).json({
      data: locations,
      message: 'OK'
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/locations
router.post('/', [
  requirePermission('locations:manage'),
  body('name').notEmpty().withMessage('Location name is required').trim(),
  validateRequest
], async (req, res, next) => {
  try {
    const location = await locationService.createLocation(req.body.name);
    res.status(201).json({
      data: location,
      message: 'Location created'
    });
  } catch (err) {
    if (err.code === '23505') { // unique violation in pg
      return res.status(409).json({ error: true, message: 'Location already exists' });
    }
    next(err);
  }
});

// PUT /api/locations/:id/addresses
router.put('/:id/addresses', [
  requirePermission('locations:manage'),
  param('id').isInt({ min: 1 }),
  body('addresses').isArray().withMessage('Addresses must be an array'),
  body('addresses.*').isString().trim(),
  validateRequest
], async (req, res, next) => {
  try {
    const location = await locationService.updateLocationAddresses(Number(req.params.id), req.body.addresses);
    if (!location) {
      return res.status(404).json({ error: true, message: 'Location not found' });
    }
    res.status(200).json({
      data: location,
      message: 'Addresses updated'
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
