const express = require('express');
const router = express.Router();

// Route stubs for Week 1 — implemented in Phase 2
router.get('/config', (req, res) => {
  res.status(200).json({ data: { client_id: '', domain: '' }, message: 'Google config route stub' });
});

module.exports = router;
