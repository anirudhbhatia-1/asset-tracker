const express = require('express');
const { validateSession } = require('../middleware/validateSession');
const searchService = require('../services/searchService');

const router = express.Router();

router.use(validateSession);

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;

// GET /api/search?q=&limit= — global search. Each group appears only when
// the user may read that kind of record.
router.get('/', async (req, res, next) => {
  try {
    const repeated = Object.keys(req.query).filter((key) => Array.isArray(req.query[key]));
    if (repeated.length > 0) {
      return res.status(400).json({ error: true, message: `Parameter given more than once: ${repeated.join(', ')}`, code: 400 });
    }
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q.length < 2 || q.length > 100) {
      return res.status(400).json({ error: true, message: 'q: Search text must be 2 to 100 characters', code: 400 });
    }
    let limit = DEFAULT_LIMIT;
    if (req.query.limit !== undefined) {
      if (typeof req.query.limit !== 'string' || !/^\d{1,3}$/.test(req.query.limit) || Number(req.query.limit) < 1) {
        return res.status(400).json({ error: true, message: 'limit: must be a positive whole number', code: 400 });
      }
      limit = Math.min(Number(req.query.limit), MAX_LIMIT);
    }
    const data = await searchService.search(req.user, q, limit);
    res.status(200).json({ data, message: 'OK' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
