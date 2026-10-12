const express = require('express');
const { validateSession } = require('../middleware/validateSession');
const attentionService = require('../services/attentionService');

const router = express.Router();

router.use(validateSession);

// GET /api/dashboard/attention — what needs acting on, limited to what the
// signed-in user may see. Each item checks its own permission.
router.get('/attention', async (req, res, next) => {
  try {
    const items = await attentionService.getAttentionItems(req.user);
    res.status(200).json({ data: { items }, message: 'OK' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
