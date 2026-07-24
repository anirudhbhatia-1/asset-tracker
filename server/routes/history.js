const express = require('express');
const { query } = require('express-validator');
const validateRequest = require('../middleware/validateRequest');
const historyService = require('../services/historyService');

const router = express.Router();

// GET /api/history — recent activity feed (default last 20 events)
router.get('/', [
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  validateRequest,
], async (req, res, next) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const history = await historyService.getRecentHistory(limit);
    res.status(200).json({
      data: history,
      total: history.length,
      message: 'OK',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
