const express = require('express');
const router = express.Router();

// Route stubs for Week 1 — implemented in Week 2
router.get('/', (req, res) => {
  res.status(200).json({ data: [], total: 0, message: 'Categories route stub' });
});

module.exports = router;
