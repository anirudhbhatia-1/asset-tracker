const express = require('express');
const router = express.Router();

// Route stubs for Week 1 — implemented in Week 2/8
router.get('/scan/:serial', (req, res) => {
  res.status(200).json({ data: null, message: 'Serial scan route stub' });
});

module.exports = router;
