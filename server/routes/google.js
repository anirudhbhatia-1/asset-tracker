// ============================================================
// TESTING ONLY — See googleService.js for removal instructions
// ============================================================
const express = require('express');
const { body } = require('express-validator');
const validateRequest = require('../middleware/validateRequest');
const googleService = require('../services/googleService');
const router = express.Router();
// Original placeholder — kept as-is
router.get('/config', (req, res) => {
  res.status(200).json({ data: { client_id: '', domain: '' }, message: 'Google config route stub' });
});
// POST /api/google/login — Testing-only Google Sign-In endpoint
// Accepts a Google ID token (credential) from the frontend Google button.
// Verifies it server-side, looks up the employee, creates a session.
//
// WHEN GOING TO PRODUCTION: Remove this route. Replace with a proper
// Workspace OAuth flow that enforces the hd (hosted domain) claim.
router.post('/login', [
  body('credential').notEmpty().withMessage('Google credential is required'),
  validateRequest,
], async (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: true, message: 'Route not found', code: 404 });
  }
  try {
    const result = await googleService.loginWithGoogleTestingFlow(req.body.credential);
    res.status(200).json({ data: result, message: 'Logged in successfully' });
  } catch (err) {
    next(err);
  }
});
module.exports = router;
